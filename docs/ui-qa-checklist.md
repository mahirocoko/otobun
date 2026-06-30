# Otobun UI QA Checklist

Use this checklist for any implementation slice of the UI revamp.

## Pre-change

- [ ] Confirm `git status --short` and preserve unrelated dirty files.
- [ ] Re-read `AGENTS.md`, `docs/ui-contract.md`, and the relevant section of `docs/ui-revamp-plan.md`.
- [ ] Identify touched components before editing; keep changes owner-local unless reuse pressure is real.
- [ ] Confirm generated reference images remain ignored under `.agent-state/` and are not staged.

## Visual contract

- [ ] UI still reads as Otobun: local transcript workspace, not Murmur/live dictation and not SaaS analytics.
- [ ] Dark teal / warm cream / muted coral token direction is used through shared CSS variables.
- [ ] Pixel/blocky details are subtle and production-safe; no novelty game UI copy leaks into the product.
- [ ] No glassmorphism, neon glow, decorative blobs, fake metrics, or generic AI dashboard cards.
- [ ] Primary actions are obvious without making every control coral.

## Flow coverage

- [ ] Import File remains usable: select, display filename/path, remove/replace, waveform/preview where available.
- [ ] Record remains usable: device selection, live level feedback, stop/save, playback review, use/delete/record-again actions.
- [ ] Model readiness is visible near the transcribe decision point.
- [ ] Missing engine, missing model, model download, and language/model mismatch states are clear.
- [ ] Form -> progress -> result transition is preserved.
- [ ] Progress screen supports cancel and chunk visibility where relevant.
- [ ] Result screen supports Reader/Raw, copy, reveal/open output, and new transcript.
- [ ] History supports local records, open/reveal/delete/refresh, empty state, and long path overflow.

## Accessibility and ergonomics

- [ ] Buttons, tabs, selects, and inputs keep semantic elements/primitives.
- [ ] Keyboard navigation reaches all actions in a sensible order.
- [ ] Focus rings are visible on dark and coral surfaces.
- [ ] Text contrast is readable on inactive, muted, active, error, and success states.
- [ ] Long filenames, model names, transcript lines, and filesystem paths do not break layout.
- [ ] Scroll areas are intentional and do not hide primary actions.
- [ ] Reduced-motion users are not forced through decorative animation.

## Responsive/native checks

- [ ] Check at minimum desktop widths around 1024px, 1280px, and the default Tauri window size.
- [ ] Check long filenames and long output paths.
- [ ] Check empty states: no file, no recording, no model, no history.
- [ ] Check busy states: recording, model download, transcribing, cancelling.
- [ ] Browser/Vite visual checks are treated as layout smoke only.
- [ ] Native Tauri behavior is verified after `pnpm desktop:install` when desktop shell/layout changes are touched.

## Commands

Use repo-native commands, with `rtk` if output may be noisy:

```bash
pnpm check
pnpm desktop:install
```

For code-only TypeScript slices, `pnpm desktop:check` can be used before the full check, but it does not replace the final gate.

## Handoff evidence

- [ ] List files changed.
- [ ] List commands run and their result.
- [ ] Note any visual/manual checks and what viewport/native surface was used.
- [ ] Note known risks or skipped checks explicitly.
