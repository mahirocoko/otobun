# Otobun

Otobun is a local-first transcript workspace for turning audio, video, meetings, and URLs into clean, searchable, exportable text.

> `oto` 音 = sound · `bun` 文 = sentence/text

Otobun is a new product direction separate from Murmur, but it can reuse Murmur's local transcription DNA: native macOS UX, Rust-powered media processing, local whisper models, and private-by-default history.

## Product Shape

Murmur is for quick dictation: speak now, paste text now.

Otobun is for transcript workspaces: bring in media, produce structured transcripts, search them later, and export them for real use.

Initial inputs:

- local audio files (`.wav`, `.mp3`, `.m4a`)
- local video files (`.mp4`, `.mov`, `.webm`)
- meeting recordings
- URL inputs such as YouTube/podcast links after the local file pipeline is stable

Initial outputs:

- readable transcript text
- timestamped segments
- Markdown export
- subtitles (`.srt`, `.vtt`)
- structured JSON for future processing

## MVP

The first milestone is a local-file transcription flow with shared core logic and two front doors:

1. **CLI first for the engine**
   - prove the transcription pipeline
   - make batch/export tests easy
   - keep native app work honest

2. **macOS desktop for end users**
   - drag-and-drop files
   - progress and model status
   - transcript viewer
   - search and local library
   - copy/export actions

## Planned Stack

Preferred starting point:

- Rust core for media/transcription pipeline
- Tauri 2 + React for the macOS desktop app
- CLI wrapper over the same Rust core
- local `whisper.cpp` / `whisper-cli` integration first
- `ffmpeg` for media probing/conversion
- local filesystem or SQLite transcript library

Possible repo layout:

```text
crates/core/      # media probing, transcription jobs, export formats
crates/cli/       # otobun CLI
apps/desktop/     # Tauri + React desktop app
```

This may be simplified during the first implementation if it creates too much ceremony.

## Non-goals for the first slice

- cloud transcription by default
- user accounts or billing
- heavy speaker diarization
- AI summaries/action items before transcript/export basics work
- replacing Murmur's live dictation UX

## Future Ideas

- URL import via `yt-dlp` or a user-provided downloader
- speaker diarization as an optional advanced pipeline
- local or bring-your-own-key summary/chapter generation
- transcript search across a local library
- project/folder organization
- mascot/brand system around a small `bun`/scribe character
