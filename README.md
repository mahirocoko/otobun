<div align="center">
  <img src="assets/brand/otobun-logo-selected.png" alt="Otobun logo" width="128" />

# Otobun

**Local-first transcript workspace สำหรับแปลงเสียงและวิดีโอให้กลายเป็นข้อความที่อ่านต่อได้จริง**

`oto` 音 = sound · `bun` 文 = text / sentence

</div>

Otobun คือแอปถอดเสียงแบบ local-first สำหรับคนที่อยากโยนไฟล์เสียงหรือวิดีโอเข้าไป แล้วได้ transcript ที่เก็บ อ่าน คัดลอก และ export ต่อได้ โดยไม่ต้องเริ่มจาก cloud account หรือส่งไฟล์ส่วนตัวออกไปนอกเครื่องตั้งแต่แรก

ตัวแอปตอนนี้โฟกัสที่ macOS desktop ก่อน ใช้ `whisper.cpp`/`whisper-cli` เป็น local engine, `ffmpeg` สำหรับจัดการ media และมี Rust core กลางที่ CLI กับ desktop ใช้ร่วมกัน

## ทำอะไรได้แล้วตอนนี้

- Import ไฟล์เสียง/วิดีโอจากเครื่อง เช่น `.mp3`, `.wav`, `.m4a`, `.mp4`, `.mov`, `.webm`, `.mkv`
- Preview ไฟล์ก่อนถอดเสียงด้วย waveform แบบ compact พร้อมปุ่ม play/pause, seek, elapsed time และ duration
- เลือกภาษาและ title ของ transcript
- เลือกโหมดถอดเสียง
  - **Single pass** — context ต่อเนื่องที่สุด เหมาะกับไฟล์สั้น/งานที่ต้องการความนิ่ง
  - **Smart chunks** — แบ่งไฟล์ยาวจากช่วงเงียบเท่าที่หาได้ แล้ว fallback เป็น fixed chunk เพื่อให้เห็น progress ชัดขึ้น
- จัดการ whisper model ในแอป
  - download model จาก `ggerganov/whisper.cpp`
  - ใช้ model ที่ติดตั้งแล้ว
  - remove model ที่โหลดไว้
  - เลือก custom `.bin` / `.gguf` model file ได้
- ตรวจ engine readiness ว่าเจอ `whisper-cli` local หรือยัง
- แสดง progress ระหว่าง normalize audio, run whisper.cpp, chunking, merge และ export
- อ่านผลลัพธ์ใน Reader view หรือ Raw view
- export เป็น `md`, `txt`, `srt`, `vtt`, `json`
- default export ไปที่ `~/Downloads/Otobun/<filename>` เพื่อไม่ให้ไฟล์กระจัดกระจายใน Downloads

## Brand direction

Otobun เป็นเครื่องมือ local-first ที่ตั้งใจให้รู้สึกเป็น desktop companion มากกว่า SaaS dashboard

ภาพจำตอนนี้คือ pixel/blocky bunny-device mascot: พื้น deep teal, ตัว mascot สี cream, accent coral/red-orange และ audio bars แบบเรียบ ๆ อ่านเป็น app icon ได้ชัด รายละเอียด brand asset อยู่ที่ [`assets/brand/README.md`](assets/brand/README.md)

## Requirements

ต้องมีเครื่องมือเหล่านี้ในเครื่องก่อนใช้งานจริง:

- macOS
- `pnpm@10.33.0`
- Rust toolchain
- `ffmpeg`
- `whisper-cli` จาก whisper.cpp
- whisper model เช่น `ggml-base.bin`, `ggml-large-v3-turbo.bin`

Otobun จะพยายามหา `whisper-cli` จาก:

1. `MAHIRO_WHISPER_CLI`
2. `/opt/homebrew/bin/whisper-cli`
3. `/usr/local/bin/whisper-cli`
4. `whisper-cli` จาก runtime path

ถ้าใช้ Homebrew แล้วมี `whisper-cli` อยู่ที่ `/opt/homebrew/bin/whisper-cli` หน้า Settings ควรขึ้น `Engine Ready · whisper.cpp local`

## Install desktop app

```bash
pnpm install
pnpm desktop:install
open /Applications/Otobun.app
```

`pnpm desktop:install` จะ build Tauri app แล้วติดตั้งไปที่ `/Applications/Otobun.app` ค่าเริ่มต้น ถ้าต้องการเปลี่ยนปลายทาง ใช้:

```bash
OTOBUN_INSTALL_DIR=/path/to/dir pnpm desktop:install
```

## Model storage

Model ที่โหลดจากหน้า Models จะอยู่ใน app data ไม่ได้อยู่ใน app bundle:

```bash
~/Library/Application Support/com.mahirocoko.otobun/models
```

การลบ `/Applications/Otobun.app` จะไม่ลบ model ที่โหลดไว้ ถ้าต้องการลบ model ให้ใช้ปุ่ม Remove ในหน้า Models หรือค่อยลบ folder นี้เอง

## CLI usage

CLI ใช้ core เดียวกับ desktop เหมาะกับการทดสอบ pipeline หรือ batch workflow

```bash
# Export sample transcript
cargo run -q -p otobun -- export-sample --format md
cargo run -q -p otobun -- export-sample --format srt

# Transcribe แบบ single pass
cargo run -q -p otobun -- transcribe ./meeting.mp4 \
  --model /path/to/ggml-base.bin \
  --format md

# Transcribe แบบ smart chunks สำหรับไฟล์ยาว
cargo run -q -p otobun -- transcribe ./meeting.mp4 \
  --model /path/to/ggml-large-v3-turbo.bin \
  --format vtt \
  --chunk-mode smart
```

Override binary path ได้ผ่าน env:

```bash
OTOBUN_FFMPEG_BIN=/path/to/ffmpeg \
OTOBUN_WHISPER_BIN=/path/to/whisper-cli \
cargo run -q -p otobun -- transcribe ./meeting.mp4 \
  --model /path/to/ggml-base.bin \
  --format json
```

## Development

```bash
pnpm install
pnpm check
pnpm desktop:dev
pnpm desktop:install
```

Useful scripts:

```bash
pnpm biome:check      # check formatting/lint
pnpm biome:write      # apply Biome fixes
cargo test --workspace
pnpm desktop:check    # TypeScript check for desktop app
pnpm desktop:build    # Tauri build
```

## Current architecture

```text
crates/core/      # media normalization, whisper.cpp pipeline, chunk planning, export formats
crates/cli/       # command-line wrapper over the Rust core
apps/desktop/     # Tauri 2 + React desktop app
assets/brand/     # selected logo and brand notes
```

Runtime shape:

```text
local media file
  -> ffmpeg normalize / preview peaks
  -> whisper.cpp model
  -> transcript segments
  -> Reader / Raw preview
  -> export to Downloads/Otobun or chosen path
```

## Non-goals for the first slice

- cloud transcription by default
- accounts, billing, sync, or team workspace
- AI summaries before transcript/export basics are solid
- heavy diarization as a default path
- pretending recording is live before native capture is actually ready

## Roadmap ideas

- cancel/pause long transcribe jobs
- smarter overlap + dedupe for chunk boundaries
- clickable Reader timestamps that seek the source preview
- local transcript library and search
- URL import through a user-provided downloader
- optional summary/chapter generation using local or bring-your-own-key models
- better setup assistant for ffmpeg, whisper.cpp, and models

Otobun is still young, but the direction is clear: keep the transcript workflow private, local, readable, and calm enough to use with real files.
