# Product Brief

## One-liner

Otobun turns voices, videos, and recordings into clean, searchable transcripts.

## Positioning

Otobun is a local-first transcript workspace and archive. It should feel friendly enough for non-developers, but have a reliable engine that can also be driven from a CLI.

## Principles

- Local-first and private by default.
- File pipeline before cloud features.
- Transcript quality and export usefulness over decorative AI features.
- CLI and desktop should share the same core pipeline.
- Thai/English mixed-language workflows are first-class.
- Do not hide rough model/ffmpeg failures; make them understandable and recoverable.

## Primary Users

- people with meeting recordings who want searchable notes
- creators with audio/video material to turn into captions or articles
- developers/operators who want a CLI batch transcript tool
- Mahiro-style local workflow users who prefer private tools over SaaS uploads

## First User Stories

- As a user, I can drag a video into Otobun and get a timestamped transcript.
- As a user, I can export the transcript as Markdown, SRT, VTT, or JSON.
- As a CLI user, I can run `otobun transcribe file.mp4 --format md,srt`.
- As a user, I can search my local transcript history.
- As a Thai/English speaker, I can select a mixed Thai-English mode.

## Brand Notes

`oto` 音 means sound. `bun` 文 means sentence/text. The name also hints at a cute bunny/mascot direction without making the product childish.
