# Architecture Notes

## Current Reality

Otobun is a local-first desktop transcription workspace with a shared Rust core and a Tauri/React desktop shell.

```text
local media file
  -> ffmpeg normalize / preview peaks
  -> whisper.cpp model via whisper-cli
  -> transcript segments
  -> Reader / Raw preview
  -> export to Downloads/Otobun or chosen path
```

## Packages

```text
crates/core/
  transcript model
  ffmpeg normalization
  whisper.cpp invocation
  progress callbacks
  smart chunk planning
  exporters for md/txt/srt/vtt/json

crates/cli/
  command-line wrapper over the shared core
  sample export and local file transcription

apps/desktop/
  Tauri commands wrapping core/runtime tasks
  React desktop UI
  app-managed model downloads
  source preview waveform
  form -> progress -> result transcription flow
```

## Desktop Runtime Shape

The desktop app owns interaction and local user preferences:

- form state: selected media, title, language, format, output location, transcribe mode
- model state: catalog installs, custom model path, last-used model preference in `localStorage`
- engine state: `whisper-cli` detection and status display
- media preview: ffmpeg-generated waveform peaks plus local asset playback
- job state: Tauri progress events drive the progress screen

The UI intentionally separates the flow into:

1. **Form** — choose source/model/options
2. **Progress** — hide the form and show transcription stage/progress
3. **Result** — show Reader/Raw output and new transcript action

## Core Runtime Shape

The Rust core remains Tauri-independent where possible. It accepts `TranscribeOptions`, normalizes media via `ffmpeg`, invokes `whisper-cli`, parses JSON, and exports transcript documents.

Current chunking behavior:

- `Single` mode uses one normalized file pass.
- `Smart` mode uses ffmpeg silence detection to plan chunks for long files.
- Chunking is sequential and conservative; overlap/deduplication is not enabled yet.

## Local Files and Storage

- Downloaded whisper.cpp models live under macOS app data: `~/Library/Application Support/com.mahirocoko.otobun/models`.
- Finished exports default to `~/Downloads/Otobun/<filename>`.
- Temporary transcription folders use the system temp directory with `otobun-*` names and are removed after normal jobs.
- Desktop startup removes stale `otobun-*` temp folders older than 24 hours.

## Current Non-goals

- Cloud transcription by default.
- Accounts, billing, sync, or team workspaces.
- AI summaries before transcript/export basics are reliable.
- Speaker diarization as a default MVP feature.
- Pretending recording is live before native capture is connected.

## Open Questions

- Whether transcript history should use SQLite or filesystem JSON.
- How to expose cancellation for long jobs.
- Whether speaker diarization should use whisper.cpp stereo diarization, a separate diarization model, or stay out of v1.
- How much transcript editing should v1 include.
