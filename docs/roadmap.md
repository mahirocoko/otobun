# Roadmap

## Milestone 0 — Repo Seed

- [x] Pick name: Otobun
- [x] Create initial GitHub repo
- [x] Write product brief and architecture notes

## Milestone 1 — CLI/Core Spike

- [x] Create Rust workspace
- [ ] Implement media probe command
- [x] Normalize audio through `ffmpeg`
- [x] Call local whisper backend with a user-provided model path
- [x] Emit transcript JSON with timestamp segments
- [x] Export Markdown, TXT, SRT, and VTT

## Milestone 1.5 — End-user Desktop Shell

- [x] Add Tauri 2 + React desktop shell
- [x] Add end-user transcript form and preview
- [x] Add `pnpm desktop:install` flow to install `/Applications/Otobun.app`
- [x] Add Biome for frontend formatting/linting

## Milestone 2 — Desktop MVP

- [x] Create Tauri 2 + React app
- [ ] Drag-and-drop local audio/video files
- [ ] Show transcription progress and errors
- [x] Transcript viewer with timestamps
- [x] Copy/export actions
- [ ] Local transcript history

## Milestone 3 — Library and Search

- [ ] Store transcript metadata
- [ ] Search transcripts locally
- [ ] Filter by date/source/type
- [ ] Re-export old transcripts

## Milestone 4 — URL and Smart Layers

- [ ] Optional URL import flow
- [ ] Optional chapter/summary generation
- [ ] Investigate diarization pipeline
- [ ] Polish macOS packaging and onboarding
