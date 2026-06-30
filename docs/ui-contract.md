# Otobun UI Contract

## Purpose

This contract defines the target UI behavior and visual language for the next Otobun desktop revamp. It is planning guidance only; it does not replace the current working Tauri/React app.

## Current Reality

- Desktop UI lives in `apps/desktop/src/` with owner-local React components, local CSS tokens in `styles.css`, and small shadcn-style primitives under `components/ui/`.
- The active product flow is already real: Import File and Record input modes, native recording review, model manager, engine readiness, waveform preview, form -> progress -> result transcription, Reader/Raw preview, and local History.
- Brand assets live in `assets/brand/` and `apps/desktop/src/assets/`. The current public brand direction is flat retro pixel/blocky, deep teal/cream/coral, and product-owned.

## Product Boundaries

Otobun is a local-first media-to-transcript workspace. It is not Murmur, not a live dictation app, and not a SaaS analytics dashboard.

The UI must make these truths obvious:

- Files, recordings, models, transcripts, and history are local-first.
- Transcription work is a clear step flow: source -> local processing -> transcript result.
- Transcript quality, recoverable errors, and useful exports are more important than decorative AI features.
- Thai/English mixed-language workflows are first-class.

## Information Architecture

Primary navigation remains compact and workspace-like:

1. **Transcribe** — active workspace with Import File / Record tabs, source preview, options, and transcribe action.
2. **History** — local transcript records, open/reveal/export/delete actions, and later search/filter.
3. **Models** — installed model state, downloads/removal, selected model, custom model file escape hatch.
4. **Permissions** — microphone/access readiness and native setup guidance.
5. **Settings** — engine binaries, output defaults, cleanup, and advanced options.

Do not split these into separate app brands or marketing sections. Keep the desktop shell focused.

## Visual Language

### Tokens

Use a restrained token set before adding new component-specific colors:

- Background: near-black deep teal.
- Surfaces: layered teal/charcoal panels.
- Text: warm cream foreground with muted teal-gray support text.
- Accent: coral for primary actions and active states.
- Success/ready: muted green, used sparingly for local readiness.
- Warning/error: clear but non-alarming; avoid neon.

### Shape and texture

- Prefer crisp blocky geometry, pixel-inspired corners, and deliberate borders.
- Keep the retro/Game Boy influence as a subtle product language, not novelty chrome.
- Use double-border or inset-panel motifs only where they clarify grouping.
- Avoid glassmorphism, glows, blob gradients, fake depth, and generic AI/SaaS decoration.

### Typography

- Use the existing system sans for app text unless a local display face is intentionally added later.
- Monospace is appropriate for transcript raw output, paths, timestamps, model names, and logs.
- Pixel-like type is allowed only for small brand/panel accents after readability checks.

## Interaction Contract

### Source selection

- Import File and Record are peer tabs, not hidden advanced modes.
- Import File must support path visibility, remove/replace, and waveform preview when available.
- Record must show real device selection, live level feedback, stop/save state, full-width playback review, and explicit “Use recording”.

### Model readiness

- The selected model and engine readiness must be visible near the transcribe action.
- Missing `whisper-cli`, missing model, unsupported language/model mismatch, and model download progress must be understandable without opening Settings.
- Custom Model File stays available as the backend-ready escape hatch, but catalog models should be the easiest path.

### Transcription flow

- Preserve the current state machine: **form -> progress -> result**.
- Progress should replace the form rather than stacking over it.
- Smart chunks should expose chunk count/current chunk only when relevant.
- Cancellation must be visible and safe.

### Result and History

- Result should switch to transcript content after completion, with Reader/Raw preview and practical actions: copy, reveal/open output, new transcript.
- History is local transcript memory, not a metrics panel. It should privilege title, source/output path, date, duration, model, language, format, and actions.
- Empty states should teach the next action in one sentence.

## Accessibility and Native Desktop Contract

- All controls must keep semantic buttons, inputs, selects, tabs, and focus states.
- Focus rings must remain visible on dark/pixel-styled controls.
- Text contrast must pass practical reading checks on current macOS displays.
- Scroll containers must not trap the whole app; long filenames, paths, and transcripts need safe overflow behavior.
- Browser/Vite checks can catch layout problems, but native Tauri behavior still needs `pnpm desktop:install` before judgment.

## Non-goals for This Revamp

- No cloud account, billing, workspace sharing, or web SaaS dashboard framing.
- No AI summary-first layout before transcript/export basics are reliable.
- No speaker diarization UI until the pipeline is real.
- No separate settings window unless Mahiro explicitly asks.
