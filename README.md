# Otobun

Otobun is a local-first transcript workspace for turning audio, video, meetings, and URLs into clean, searchable, exportable text.

> `oto` 音 = sound · `bun` 文 = sentence/text

Otobun operates as a native, private-by-default local transcription workspace: utilizing native macOS UX, Rust-powered media processing, local Whisper models, and local history.

## Product Shape

Otobun is a comprehensive transcript workspace: import audio/video files, record direct inputs, produce structured transcripts, search them later, and export them into multiple target formats.

Initial inputs:
- local audio files (`.wav`, `.mp3`, `.m4a`)
- local video files (`.mp4`, `.mov`, `.webm`)
- direct microphone recordings
- URL inputs such as YouTube/podcast links (planned)

Initial outputs:
- readable transcript text (formatted Reader View)
- timestamped segments
- Markdown export
- subtitles (`.srt`, `.vtt`)
- structured JSON for downstream pipelines

## MVP

The first milestone is a local-file transcription flow with shared core logic and two front doors:

1. **CLI first for the engine**
   - prove the transcription pipeline
   - make batch/export tests easy
   - keep native app work honest

2. **macOS desktop for end users**
   - drag-and-drop file import
   - direct recording interface
   - local model manager
   - transcript reader with formatted timeline
   - search and local library
   - copy/export actions

## Planned Stack

- Rust core for media/transcription pipeline
- Tauri 2 + React for the macOS desktop app
- CLI wrapper over the same Rust core
- local `whisper.cpp` / `whisper-cli` integration
- `ffmpeg` for media probing/conversion
- local filesystem or SQLite transcript library

Possible repo layout:
```text
crates/core/      # media probing, transcription jobs, export formats
crates/cli/       # otobun CLI
apps/desktop/     # Tauri + React desktop app
```

## Desktop + CLI Spike

The desktop app is the primary interface for end users, styled around a retro pixel mascot aesthetic.

Install the macOS app locally:

```bash
pnpm install
pnpm desktop:install
open /Applications/Otobun.app
```

Desktop features:
- **Import File Tab** — drag & drop or browse local files using the native file picker.
- **Record Audio Tab** — direct live recording workflow.
- **Model Manager** — select from recommended sizes or load a custom model file.
- **Preview & Export** — formatted timeline reader or raw text view. Export as Notes/Markdown, text, SRT, VTT, or JSON.

The CLI is useful for engine testing and batch-friendly workflows. It can export a built-in sample transcript and run a local file transcription pipeline through `ffmpeg` and `whisper-cli`.

```bash
# Export a built-in sample transcript
cargo run -q -p otobun -- export-sample --format md
cargo run -q -p otobun -- export-sample --format srt

# Transcribe a local media file using a whisper.cpp model
cargo run -q -p otobun -- transcribe ./meeting.mp4 --model /path/to/ggml-base.bin --format md

# Optional binary overrides
OTOBUN_FFMPEG_BIN=/path/to/ffmpeg \
OTOBUN_WHISPER_BIN=/path/to/whisper-cli \
cargo run -q -p otobun -- transcribe ./meeting.mp4 --model /path/to/ggml-base.bin --format vtt
```

The transcription command expects a `whisper-cli` compatible with whisper.cpp's `-oj -of` JSON output flags.

## Development

```bash
pnpm install
pnpm check
cargo test --workspace
pnpm desktop:check
pnpm desktop:install
```

`pnpm desktop:install` builds the Tauri app bundle and installs it to `/Applications/Otobun.app` by default. Override the destination with `OTOBUN_INSTALL_DIR=/path/to/dir`.

## Non-goals for the first slice

- cloud transcription by default
- user accounts or billing
- heavy speaker diarization
- AI summaries/action items before transcript/export basics work

## Future Ideas

- URL import via `yt-dlp` or a user-provided downloader
- speaker diarization as an optional advanced pipeline
- local or bring-your-own-key summary/chapter generation
- transcript search across a local library
- project/folder organization
- mascot/brand system around a small `bun`/scribe character
