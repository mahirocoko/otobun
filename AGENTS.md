# Agent Notes

## Project

Otobun is a local-first transcript workspace for audio, video, meeting recordings, and later URL sources. It is its own product brand, separate from Murmur, but can reuse local transcription lessons where they fit.

## Current Reality

Otobun now has a committed runtime stack:

- Rust workspace core + CLI under `crates/`
- Tauri 2 + React desktop app under `apps/desktop/`
- `pnpm` workspace scripts for frontend/Tauri work
- `ffmpeg` normalization/media preview and `whisper-cli` transcription orchestration
- app-managed whisper.cpp model downloads under macOS app data
- desktop UI with form → progress → result transcription flow

Do not treat the repo as docs-only anymore. Inspect current code before applying older architecture notes.

## Workflow

- Preserve repo reality first.
- Use `pnpm` for frontend/Tauri scripts.
- Use Rust/Cargo for core/CLI/backend checks.
- Keep CLI/core behavior testable outside the desktop app.
- Run `pnpm check` before handoff when code changes.
- For native desktop changes, run `pnpm desktop:install` before judging the installed app.
- Use `ccc index` after meaningful code/doc changes.
- Keep generated/local state ignored: `.agent-state/`, `.playwright-cli/`, `.pids/`, `.letta/`, `.cocoindex_code/`.

## Frontend Structure Direction

Current React code is young and owner-local. Prefer small owner-local hooks/components before introducing broad shared abstractions.

- `app.tsx` should orchestrate app state and route high-level sections only.
- Long-running job logic belongs in hooks such as `use-transcription-job`.
- Native/runtime state belongs in focused hooks such as `use-engine-status`, `use-installed-models`, and `use-media-preview`.
- Transcription UX is a step flow: form → progress → result.
- Use explicit `I...Props` interfaces in components.
- Keep files kebab-case.
- Avoid generic SaaS UI patterns; Otobun should feel like a calm desktop tool.

## Product Guardrails

- Murmur is live dictation; Otobun is media-to-transcript workspace.
- Start with local files before URL import.
- Transcript/export basics come before AI summaries.
- Speaker diarization is advanced/optional, not MVP. Until real diarization exists, label single-speaker output as `Transcript`, not `Speaker 1`.
- Thai/English mixed-language transcription should be treated as first-class.
- Do not imply live recording exists until native capture is actually connected.

## RTK

Mahiro's global RTK doctrine lives at `~/.agents/RTK.md`. Preserve the repo-native command shape first, then prepend `rtk` for noisy shell commands when exact raw output is not required.
