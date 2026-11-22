#!/usr/bin/env bash
set -Eeuo pipefail
APP="webrtc-new"
mkdir -p "$RUNNER_TEMP/fly-readonly"
cd "$GITHUB_WORKSPACE"
echo "Read deployed images from Fly.io for $APP"
fly machine list -a "$APP" --json > "$RUNNER_TEMP/fly-readonly/machines.json"
python3 - <<'PY'
import json,os,sys
from pathlib import Path
data=json.loads(Path(os.environ['RUNNER_TEMP'],'fly-readonly','machines.json').read_text())
if isinstance(data,dict):
    machines=data.get('machines') or data.get('items') or []
else:
    machines=data
refs=[]
for m in machines:
    if not isinstance(m,dict): continue
    config=m.get('config') or {}
    ref=config.get('image') or m.get('image') or m.get('image_ref')
    if isinstance(ref,dict): ref=ref.get('ref') or ref.get('name')
    if ref: refs.append(str(ref))
refs=list(dict.fromkeys(refs))
Path(os.environ['RUNNER_TEMP'],'fly-readonly','images.txt').write_text('\n'.join(refs))
print('Machines: %d; distinct image references identified: %d'%(len(machines),len(refs)))
PY

# If machine list excludes image refs, optionally accept a manually verified image.
IMAGE_REF="$(head -n 1 "$RUNNER_TEMP/fly-readonly/images.txt")"
REF_COUNT="$(grep -c '^.' "$RUNNER_TEMP/fly-readonly/images.txt" || true)"
if [[ "$REF_COUNT" -ne 1 ]]; then
  echo "::error::Expected one unique actual machine image. Found $REF_COUNT. Refusing to guess the deployed image."
  exit 1
fi
if [[ "$IMAGE_REF" != registry.fly.io/"$APP":* && "$IMAGE_REF" != registry.fly.io/"$APP"@sha256:* ]]; then
  echo "::error::Image is not Fly registry image for the expected app. Refusing."
  exit 1
fi
export FLY_IMAGE_REF="$IMAGE_REF" FLY_APP="$APP"
echo "Selected running image: $IMAGE_REF"
fly auth docker
docker pull "$IMAGE_REF"
docker image inspect "$IMAGE_REF" --format '{{.Id}}'
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
