# HITEL Fly.io webrtc-new server backup

**Scope:** Deployed Fly.io `webrtc-new` **server only**. No client code.

**Status (2026-11-22):** Repository initialized. Live Fly.io machine image/source has **not yet been captured or verified**. No claim of a completed backup.

Use [tools/capture-fly-webrtc-new.ps1](tools/capture-fly-webrtc-new.ps1) on the Windows computer with `fly` and Docker installed. This read-only helper pulls the exact deployed image into a local TAR and extracts a server-only review ZIP from a stopped image container. It does not change Fly.io, and it does not upload files to GitHub.

The public backup will be populated **only after** the actual deployed server files are retrieved and inspected for sensitive contents. Do not upload the Docker image TAR or unreviewed files to a public repository. Stateful volumes, external databases, and Fly secret values are separate from the image and require separate preservation.
