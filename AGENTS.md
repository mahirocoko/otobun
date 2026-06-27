# Agent Notes

## Project

Otobun is a local-first transcript workspace for audio, video, meeting recordings, and URL sources. It is a new brand separate from Murmur, but may reuse Murmur's local transcription lessons.

## Current State

This repo is in incubation. It currently contains product and architecture notes only. Do not assume a runtime stack is already established until it is committed here.

## Workflow

- Preserve repo reality first.
- Use `pnpm` for frontend/Tauri work if a JS workspace is introduced.
- Use Rust/Cargo for core/CLI work once the Rust workspace exists.
- Keep CLI/core behavior testable outside the desktop app.
- Do not introduce cloud auth, billing, or SaaS assumptions for the MVP.
- Prefer local-first/private-by-default choices.

## RTK

Mahiro's global RTK doctrine lives at `~/.agents/RTK.md`. Preserve the repo-native command shape first, then prepend `rtk` for noisy shell commands when exact raw output is not required.

## Product Guardrails

- Murmur is live dictation; Otobun is media-to-transcript workspace.
- Start with local files before URL import.
- Transcript/export basics come before AI summaries.
- Speaker diarization is advanced/optional, not MVP.
- Thai/English mixed-language transcription should be treated as first-class.
