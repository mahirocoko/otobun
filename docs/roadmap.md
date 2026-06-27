# Roadmap

## Milestone 0 — Repo Seed

- [x] Pick name: Otobun
- [x] Create initial GitHub repo
- [x] Write product brief and architecture notes

## Milestone 1 — CLI/Core Spike

- [ ] Create Rust workspace
- [ ] Implement media probe command
- [ ] Normalize audio through `ffmpeg`
- [ ] Call local whisper backend with a user-provided model path
- [ ] Emit transcript JSON with timestamp segments
- [ ] Export Markdown, TXT, SRT, and VTT

## Milestone 2 — Desktop MVP

- [ ] Create Tauri 2 + React app
- [ ] Drag-and-drop local audio/video files
- [ ] Show transcription progress and errors
- [ ] Transcript viewer with timestamps
- [ ] Copy/export actions
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
