#!/usr/bin/env python3
"""Prepare a reviewed, server-only PUBLIC snapshot from a stopped Fly image.
Never execute software from the image or publish raw image layers/credentials.
"""
import hashlib, json, os, re, shutil, sys
from pathlib import Path

origin = Path(os.environ["SOURCE_ROOT"]).resolve()
target = Path("server-snapshot").resolve()
image_ref = os.environ["FLY_IMAGE_REF"]
app = os.environ.get("FLY_APP", "webrtc-new")

directories = {"src", "dist", "build", "server", "sql", "migrations", "prisma", "config"}
top_files = {
    "Dockerfile", "fly.toml", "package.json", "package-lock.json",
    "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock",
    "tsconfig.json", "tsconfig.build.json", "nest-cli.json",
    "README.md", "server.js", "index.js", "main.js", "main.ts",
    ".eslintrc.js", ".prettierrc"
}
extensions = {
    ".ts", ".tsx", ".js", ".cjs", ".mjs", ".json", ".toml",
    ".yaml", ".yml", ".md", ".sql", ".graphql", ".gql", ".txt",
    ".sh", ".py", ".xml", ".properties", ".html"
}
blocked_parts = {
    "node_modules", ".git", ".github", ".env", "secrets", "secret",
    "credentials", "credential", ".ssh", "private", "certs", "certificates",
    "test-results", ".next", "coverage", "__pycache__", ".cache"
}
blocked_name = re.compile(
    r"(?i)(^\.env($|\.)|\.pem$|\.key$|\.p12$|\.pfx$|\.jks$|"
    r"\.keystore$|^\.npmrc$|id_rsa|id_ed25519|credential|secret|"
    r"adminsdk|service[-_.]?account|firebase.*\.json$)"
)
sensitive = [
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"(?i)github_pat_[a-zA-Z0-9_]{20,}"),
    re.compile(r"(?i)gh[pousr]_[A-Za-z0-9]{30,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"(?i)xox[baprs]-[0-9a-zA-Z-]{20,}"),
    re.compile(r"(?i)(?:password|secret|private_key|api_key|client_secret)\s*[:=]\s*[\"'][^\"'\r\n]{12,}[\"']"),
]
if not origin.is_dir():
    sys.exit("FAIL: image filesystem export missing")

if target.exists():
    shutil.rmtree(target)
target.mkdir(parents=True)
staged = []
skipped = []
flagged = []
for file in sorted(origin.rglob("*")):
    if not file.is_file() or file.is_symlink():
        continue
    rel = file.relative_to(origin)
    parts = rel.parts
    if any(p.lower() in blocked_parts or p.lower().startswith(".env") for p in parts):
        skipped.append(rel.as_posix())
        continue
    if blocked_name.search(file.name):
        skipped.append(rel.as_posix())
        continue
    if not ((len(parts) == 1 and file.name in top_files)
            or (len(parts) > 1 and parts[0] in directories and file.suffix.lower() in extensions)):
        continue
    if file.stat().st_size > 10 * 1024 * 1024:
        skipped.append(rel.as_posix())
        continue
    try:
        data = file.read_bytes()
        content = data.decode("utf-8")
    except (UnicodeDecodeError, OSError):
        skipped.append(rel.as_posix())
        continue
    if any(p.search(content) for p in sensitive):
        flagged.append(rel.as_posix())
        continue
    dest = target / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    staged.append(rel.as_posix())

if flagged:
    shutil.rmtree(target)
    print("BLOCKED: potentially sensitive content in these files (values are not printed):")
    print("\n".join(flagged))
    sys.exit("FAIL: no public commit; inspect files privately")

if not any(p.startswith(("src/", "dist/", "build/", "server/")) for p in staged):
    shutil.rmtree(target)
    sys.exit("FAIL: no application server source/build content found inside image")

manifest = []
for rel in staged:
    data = (target / rel).read_bytes()
    manifest.append({
        "path": rel,
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data)
    })
(target / "SERVER_FILES_SHA256.json").write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
)
(target / "PROVENANCE.md").write_text(
    "# Captured Fly.io server-only file snapshot\n\n"
    f"- App: \`{app}\`\n"
    f"- Deployed image reference: \`{image_ref}\`\n"
    f"- File count: {len(manifest)}\n"
    "- This is a **filtered public source/build snapshot**, not a full Docker image backup.\n"
    "- Original TypeScript is present only if the deployed image contained it.\n"
    "- The exact running image and non-image state (Fly volumes, databases, secrets) "
    "are not copied into this public repository.\n"
    "- Source files were extracted from a stopped local Docker container; "
    "the Fly.io machine was not touched.\n",
    encoding="utf-8"
)
print(f"Safe server files prepared: {len(manifest)}; excluded: {len(skipped)}")
