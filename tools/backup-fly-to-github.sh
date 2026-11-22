#!/usr/bin/env bash
set -Eeuo pipefail
APP="webrtc-new"
# GitHub setup-flyctl installs flyctl, not necessarily the Windows-style fly alias.
if command -v flyctl >/dev/null 2>&1; then
  FLYCTL="$(command -v flyctl)"
elif command -v fly >/dev/null 2>&1; then
  FLYCTL="$(command -v fly)"
else
  echo "::error::Fly CLI not found after installation"; exit 127
fi
"$FLYCTL" version
mkdir -p "$RUNNER_TEMP/fly-readonly"
cd "$GITHUB_WORKSPACE"
echo "Read deployed images from Fly.io for $APP"
"$FLYCTL" machine list -a "$APP" --json > "$RUNNER_TEMP/fly-readonly/machines.json"
python3 - <<'PY'
import json,os,sys
from pathlib import Path
data=json.loads(Path(os.environ['RUNNER_TEMP'],'fly-readonly','machines.json').read_text())
if isinstance(data,dict):
    machines=data.get('machines') or data.get('items') or []
else:
    machines=data
import re
refs=[]
for m in machines:
    if not isinstance(m,dict): raise SystemExit("Unexpected machine response")
    if m.get("state") in ("destroyed","destroying"): continue
    config=m.get("config") or {}
    image=m.get("image_ref") or config.get("image_ref") or {}
    ref=None
    if isinstance(image,dict):
        digest=image.get("digest") or ""
        registry=image.get("registry") or ""
        repository=image.get("repository") or ""
        if registry == "registry.fly.io" and repository == "webrtc-new" and re.fullmatch(r"sha256:[0-9a-fA-F]{64}",digest):
            ref=f"{registry}/{repository}@{digest}"
    if not ref:
        value=config.get("image") or m.get("image") or ""
        if isinstance(value,str):
            match=re.fullmatch(r"registry\.fly\.io/webrtc-new(?::[^@]+)?@(sha256:[0-9a-fA-F]{64})",value)
            if match: ref="registry.fly.io/webrtc-new@"+match.group(1)
    if not ref:
        raise SystemExit("No confirmed immutable image digest for a machine; refusing to guess or pull a mutable tag.")
    refs.append(ref)
refs=list(dict.fromkeys(refs))
Path(os.environ["RUNNER_TEMP"],"fly-readonly","images.txt").write_text("\n".join(refs))
print("Machines: %d; distinct confirmed image digests: %d"%(len(machines),len(refs)))
PY

# Require the actual deployed digest and reject an ambiguous multi-image state.
IMAGE_REF="$(head -n 1 "$RUNNER_TEMP/fly-readonly/images.txt")"
REF_COUNT="$(grep -c '^.' "$RUNNER_TEMP/fly-readonly/images.txt" || true)"
if [[ "$REF_COUNT" -ne 1 ]]; then
  echo "::error::Expected one unique actual machine image. Found $REF_COUNT. Refusing to guess the deployed image."
  exit 1
fi
if [[ "$IMAGE_REF" != registry.fly.io/"$APP"@sha256:* ]]; then
  echo "::error::Image is not Fly registry image for the expected app. Refusing."
  exit 1
fi
export FLY_IMAGE_REF="$IMAGE_REF" FLY_APP="$APP"
echo "Selected running image: $IMAGE_REF"
"$FLYCTL" auth docker
docker pull "$IMAGE_REF"
docker image inspect "$IMAGE_REF" --format '{{.Id}}'
docker image inspect "$IMAGE_REF" --format '{{range .RepoDigests}}{{println .}}{{end}}' | grep -Fx "$IMAGE_REF" >/dev/null
echo "Verified pulled image matches Fly machine digest."
WORKDIR="$(docker image inspect "$IMAGE_REF" --format '{{.Config.WorkingDir}}')"
[[ -n "$WORKDIR" && "$WORKDIR" != "/" ]] || WORKDIR="/app"
CID="$(docker create "$IMAGE_REF")"
cleanup(){ docker rm -f "$CID" >/dev/null 2>&1 || :; }
trap cleanup EXIT
STAGE="$RUNNER_TEMP/fly-readonly/server"
mkdir -p "$STAGE"
for path in src dist build server sql migrations prisma config package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock tsconfig.json tsconfig.build.json nest-cli.json Dockerfile fly.toml README.md server.js index.js main.js main.ts .eslintrc.js .prettierrc; do
    docker cp "$CID:$WORKDIR/$path" "$STAGE/$path" 2>/dev/null || true
done
export SOURCE_ROOT="$STAGE"
python3 tools/prepare_public_backup.py
# Scan filtered files BEFORE publication. No raw data is uploaded as an artifact.
docker run --rm -v "$GITHUB_WORKSPACE/server-snapshot:/scan:ro" \
    ghcr.io/gitleaks/gitleaks:latest dir /scan --redact --exit-code 1
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A server-snapshot
if git diff --cached --quiet; then
  echo "Server snapshot matches prior commit."
else
  git commit -m "backup: capture read-only Fly.io webrtc-new deployed server files"
  git push origin "HEAD:$GITHUB_REF_NAME"
fi
echo "Server snapshot committed to GitHub (filtered source/build files only)."
