# Architecture Notes

## Current Reality

This repository is an empty incubation repo with initial product docs only. No runtime scaffold has been committed yet.

## Preferred Direction

Build a shared Rust core that powers both CLI and desktop UI.

```text
input media
  -> probe/normalize with ffmpeg
  -> transcribe with local whisper backend
  -> segment model
  -> transcript document
  -> exports/search/library
```

## Proposed Packages

```text
crates/core/
  media probing
  job orchestration
  whisper backend adapter
  transcript model
  exporters

crates/cli/
  transcribe command
  export command
  model diagnostics

apps/desktop/
  Tauri commands wrapping core
  React transcript viewer
  local library UI
```

## Early Technical Decisions

- Rust owns media and transcription orchestration.
- React owns desktop interaction and transcript reading/editing surfaces.
- The core should not assume Tauri; it should be callable from CLI tests.
- Keep model/download management simple at first: detect user-provided model paths before building a model manager.
- Keep diarization and summary as later optional layers, not core MVP requirements.

## Open Questions

- SQLite vs filesystem JSON for transcript library.
- Whether to vendor or detect `ffmpeg` / `whisper-cli`.
- Whether the first desktop version should be full window, menu bar helper, or both.
- How much editing should v1 transcript viewer support.
