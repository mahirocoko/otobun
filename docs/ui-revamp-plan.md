# Otobun UI Revamp Plan

## Goal

Plan a focused desktop UI revamp for Otobun without touching runtime code yet. The revamp should make the app feel like a calm local transcript workspace with a product-owned retro/blocky identity, while preserving the working transcription pipeline.

## External Reference Board Lanes

Generated images are intentionally **not committed**. They live under ignored `.agent-state/` paths or Codex's local generated-images directory. The docs record prompts, paths, synthesis, and next implementation goals only.

### Shared prompt constraints

Both lanes were given the same product guardrails: Otobun is a local-first media-to-transcript workspace, separate from Murmur; the target look is a dark calm desktop tone with retro pixel/blocky Game Boy-inspired brand language, deep teal/cream/coral colors, and shadcn/Radix-like practical controls; the boards should explore Import File and Record tabs, model manager, engine readiness, waveform source/review preview, form -> progress -> result, Reader/Raw preview, and History; they must avoid fake metrics, glass, glows, and generic SaaS dashboard chrome.

### Gemini imagegen/reference lane

- Lane: Antigravity CLI `Gemini 3.5 Flash (High)` in tmux pane `direct-otobun-ui-ref:0.1`.
- Prompt file: `.agent-state/otobun-ui-revamp-reference-boards/prompts/gemini-imagegen.prompt.md`.
- Prompt text: “Generate 2-3 external visual reference board images for a future desktop UI revamp plan, not implementation. If this CLI cannot render images, create a board-spec markdown plus exact image prompts and mark the limitation clearly. Create a report containing prompts used, artifact paths, what each board explores, useful UI ideas, rejected ideas, and implementation risks.”
- Report: `.agent-state/otobun-ui-revamp-reference-boards/gemini/report.md`.
- Artifacts:
  - `.agent-state/otobun-ui-revamp-reference-boards/gemini/model_manager_board.jpg`
  - `.agent-state/otobun-ui-revamp-reference-boards/gemini/workspace_flow_board.jpg`
  - `.agent-state/otobun-ui-revamp-reference-boards/gemini/history_hub_board.jpg`

### Codex imagegen lane

- Lane: Codex CLI `gpt-5.5` in tmux pane `direct-otobun-ui-ref:0.0`.
- Prompt files:
  - `.agent-state/otobun-ui-revamp-reference-boards/prompts/codex-imagegen.prompt.md`
  - `.agent-state/otobun-ui-revamp-reference-boards/prompts/codex-imagegen-narrow.prompt.md`
  - `.agent-state/otobun-ui-revamp-reference-boards/prompts/codex-history-single.prompt.md`
- Successful prompt text: “Create a high-resolution external visual reference board for a future desktop UI revamp of Otobun. Board 1 theme: main workspace composition. Show import/record tabs, local file import panel, engine readiness status, model manager chip/list, waveform source preview, transcription form -> progress -> result flow, Reader and Raw preview split, and History rail. Use shadcn/Radix-like primitives with local tokens: precise spacing, thin borders, practical controls, restrained surfaces. Include small labeled callouts for Import File, Record, Engine Ready, Model Manager, Waveform, Reader, Raw, and History.”
- Report: `.agent-state/otobun-ui-revamp-reference-boards/codex/report.md`.
- Successful artifact:
  - Original: `/Users/mahiro/.codex/generated_images/019f16ab-47e3-74e3-b65d-d6c57354dca1/ig_0d8b59a79ec18913016a433efa7e348191b56337f980e78a7b.png`
  - Ignored repo-local review copy: `.agent-state/otobun-ui-revamp-reference-boards/codex/workspace-composition-board.png`
- Note: Codex produced one strong workspace-composition board. Follow-up requests for extra boards stalled in the pane and are not treated as evidence.

## Reference Synthesis

### Keep

- **One cohesive workspace surface.** Codex's board is useful because it shows Import/Record, engine readiness, model state, waveform, result preview, and History as parts of one product surface.
- **Blocky readiness language.** Gemini's model-manager board suggests battery/power-meter style local engine readiness. Use this for model/engine state, not CPU dashboards.
- **Cartridge-like tabs and panels.** Gemini's Import/Record tabs are a useful direction if toned down into production controls.
- **Reader/Raw split.** Both lanes reinforce keeping a formatted Reader view and raw/export view close together.
- **Local-first callout.** A small “local first / your data stays on this device” panel is useful for onboarding and trust.

### Reject or tone down

- **Literal game UI labels.** Generated terms like `CUBE.OPS`, menu bars, and fake game controls are reference-only. Production copy must stay Otobun-specific.
- **Oversized pixel typography.** Large all-caps pixel text is charming in boards but too hard to read for transcript workflows.
- **Toy-like icons and decorative sprites in core controls.** Mascot accents can exist around brand/onboarding, not inside every model card.
- **Permanent callout overlays.** Use callouts for docs/onboarding, not normal app chrome.
- **Fake system metrics.** Readiness is okay; CPU/load dashboards are not part of Otobun MVP.

## Phased Plan

### Phase 0 — Contract and inventory

Deliverables:

- Keep `docs/ui-contract.md`, this plan, and `docs/ui-qa-checklist.md` as the revamp source of truth.
- Inventory current component boundaries before coding: `AppSidebar`, `TranscriptForm`, `TranscribeWorkspace`, `PreviewCard`, `TranscribeProgressScreen`, model hooks, and library actions.
- Decide whether the next implementation slice is token refresh only or layout restructuring.

Exit gate:

- Docs reviewed against current `apps/desktop/src/` reality.
- Generated board paths are ignored and not staged.

### Phase 1 — Token and primitive refresh

Scope:

- Refine `:root` tokens in `apps/desktop/src/styles.css` toward deeper teal, warmer cream, muted coral, and clearer focus states.
- Add production-safe blocky/pixel-inspired variants to existing primitives (`Button`, `Card`, `Input`, `Select`, `Tabs`) without replacing Radix/shadcn-style semantics.
- Keep border/radius/spacing changes centralized; avoid one-off color literals.

Exit gate:

- `pnpm check` passes.
- Focus states are visible for buttons, tabs, select triggers, and inputs.
- Long text/path overflow still behaves safely.

### Phase 2 — Transcribe workspace composition

Scope:

- Restructure the Transcribe page into a clearer workspace grid:
  - Source panel: Import File / Record tabs, waveform/review preview, remove/replace actions.
  - Model/readiness panel: selected model, engine status, language mismatch, download/custom model actions.
  - Options/action panel: title, language, format, output, single/smart chunks, decode profile, transcribe action.
  - Optional History rail or recent transcript preview when space allows.
- Preserve the state transition: form -> progress -> result.

Exit gate:

- Import and Record both remain real flows.
- No regression to recording review/playback.
- Engine/model missing states are visible before pressing Transcribe.

### Phase 3 — Progress and result polish

Scope:

- Make progress feel like local work: stage rail, chunk blocks, elapsed/remaining when reliable, safe cancel.
- Keep Reader/Raw as a first-class result layout.
- Add clear output/reveal/copy/new-transcript actions without stacking extra cards.

Exit gate:

- Progress screen replaces form during running jobs.
- Result screen replaces form after completion.
- Copy/open/reveal/new transcript actions are keyboard reachable.

### Phase 4 — History and model manager polish

Scope:

- History: add better list density, title/source/output hierarchy, date/duration/model/language/format metadata, and future-ready search/filter slots.
- Models: make catalog install state, selected model, custom model, progress, and remove actions scan cleanly.
- Permissions/Settings: keep practical native setup and advanced engine paths without becoming a dumping ground.

Exit gate:

- Empty history and no-model states give one next action.
- Local file paths remain inspectable but do not break layout.
- Model manager still supports catalog and custom model paths.

### Phase 5 — Native verification and packaging

Scope:

- Run browser/Vite layout checks for fast iteration.
- Install the native app with `pnpm desktop:install` before declaring the revamp ready.
- Check macOS window sizing, scrolling, file dialogs, recording permissions, and waveform playback in the installed app.

Exit gate:

- `pnpm check` passes.
- `pnpm desktop:install` completes.
- Manual native smoke covers Import File, Record, model selection, transcribe progress/result, and History.

## Next Implementation Goals

1. Start with Phase 1 token/primitive refresh. This is the least risky way to align the UI with the contract before layout surgery.
2. Then implement Phase 2 workspace composition in owner-local components, splitting `TranscriptForm` only where the current prop surface becomes hard to reason about.
3. Delay new illustration/mascot work until the core workspace is stable; reference boards are enough for the first revamp pass.
4. Do not commit `.agent-state/` images; if visual references need sharing, export curated screenshots into a reviewed docs asset path in a separate explicit asset task.
