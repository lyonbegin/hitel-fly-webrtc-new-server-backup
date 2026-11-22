# HITEL Fly.io webrtc-new server backup

**Target:** Actual deployed Fly.io application **webrtc-new**, server only. No iPhone, Android, browser, or other HITEL client files.

## Direct Fly.io -> GitHub Actions backup (no Docker on your PC)

1. While logged into Fly.io on your PC, issue a short-lived read-only token:
   `fly tokens create readonly --name "github-server-backup" --expiry 48h`
   Choose the organization that owns `webrtc-new` if prompted.
2. Open repository **Settings > Secrets and variables > Actions > New repository secret**.
   Name: `FLY_API_TOKEN`. Value: the token from step 1. Never put the token in a commit, issue, or chat.
3. Open [the backup workflow](../../actions/workflows/backup-fly-webrtc-new.yml), select **Run workflow**, and review its run logs.

The workflow uses a GitHub-hosted runner, reads actual Fly.io Machine image references, pulls the exact deployed container image, extracts server files **without starting a container**, checks for secret patterns, and commits permitted files under `server-snapshot/` in this public repository. It does **not** use `fly deploy`, stop, restart, or update any Fly Machine.

**Status:** The workflow is published, but no Fly.io server data has been backed up yet. A successful workflow run is required to mark the source snapshot complete.

**Important scope limitation:** The public repository contains only filtered source/build files that are actually present inside the deployed image. It is not a byte-for-byte backup of the complete Docker image, Fly.io volumes, secrets, or external databases. If the deployed image does not contain original sources or a safe snapshot cannot be produced, the job fails rather than inventing or publishing substitute code. For exact whole-image restoration, a separate protected full-image backup is required.

An earlier optional PC-local capture helper remains under `tools/capture-fly-webrtc-new.ps1`, but it is **not required** for the GitHub-only flow.
