# Musical Staff Play - Agent Guidelines

Note: This project is built on Windows — use PowerShell commands not bash. Latency-critical; keep operations lightweight.

## Development Commands

- `pnpm run dev` - Start dev server (Vite, port 5173 by default)
- `pnpm run build` - Build for production (`tsc -b && vite build`)
- `pnpm run lint` - ESLint (flat config at `eslint.config.js`)
- `pnpm run test` - Run vitest suite
- `pnpm run test:watch` - Vitest in watch mode

## Tech Stack

| Concern               | Implementation                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework             | React 19, TypeScript ~6.0, Vite 8                                                                                                            |
| Score rendering       | Verovio WASM toolkit (`verovio` ^6.1.0) — renders MusicXML/MEI → SVG                                                                         |
| Rendering engine      | `ScoreRenderer` (`src/renderer/ScoreRenderer.ts`) — owns Verovio, mapper, highlight, judgment, viewport; RAF loop                            |
| Verovio wrapper       | `VerovioRenderer` class in `src/renderer/VerovioEngine.ts` — singleton via `getVerovioRenderer()`                                             |
| Timing / beat-to-time | `TempoClock` (`src/playback/TempoClock.ts`) — pure arithmetic, no AudioContext                                                               |
| Game loop (state)     | `GameLoop` (`src/core/GameLoop.ts`) — singleton via `getGameLoop()`. Pure state machine: logic tick (setInterval) only. No rendering         |
| Judgment              | `JudgmentEngine` (`src/playback/JudgmentEngine.ts`) — pitch + timing matching                                                                |
| Feedback display      | `JudgmentDisplay` (`src/feedback/JudgmentDisplay.ts`) — SVG data attribute overlays via `OverlayManager`                                      |
| Highlight display     | `BoxHighlightRenderer` (`src/feedback/BoxHighlightRenderer.ts`) — SVG `<rect>` highlight boxes via `OverlayManager`                           |
| Overlay manager       | `OverlayManager` (`src/feedback/OverlayManager.ts`) — adds/removes SVG `<g>` overlay containers per page                                     |
| MIDI input            | `MidiInputManager` (`src/playback/MidiInputManager.ts`) — singleton, Web MIDI API                                                            |
| Input pipeline        | `NoteInputPipeline` (`src/core/NoteInputPipeline.ts`) — routes keyboard/MIDI/autoplay notes to judgment engine                               |
| State                 | React Context + useReducer, localStorage persistence under `musicalStaffPlay_settings`                                                       |

## Browser Constraints

- Chromium-based browser (Chrome/Edge/Opera) v90+ required for Web MIDI
- COOP/COEP headers configured in `vite.config.ts` for SharedArrayBuffer
- Web MIDI requires secure context (localhost or HTTPS) + user gesture
- Verovio WASM module loads lazily in `VerovioRenderer.init()` — first call triggers ~2MB WASM download

## Architecture

Entry: `src/main.tsx` → `src/App.tsx` → layout: TopBar → ControlBar → (ScoreView + StatsPanel) → TimelineBar → Footer; SettingsPanel modal.

**Core flow:**

1. User opens MusicXML/MEI → `MusicxmlParser` produces `ScoreData`
2. `GameLoop.loadScore(score)` sets up TempoClock, flattens events, configures judgment engine. `ScoreRenderer.loadScore(rawDocument, layoutOpts)` loads Verovio, builds SVG event ID map, renders SVG to DOM
3. During playback, `GameLoop._logicTick()` (setInterval) drives judgment checking + scroll offset emission
4. `ScoreRenderer._renderTick()` (RAF) queries `GameLoop` for beat → gets upcoming columns → resolves svgIds via mapper → updates highlights + checks page advancement
5. Keyboard input → `ScoreRenderer` converts to MIDI → calls `GameLoop.noteOn/noteOff()` → `NoteInputPipeline` → `JudgmentEngine`. MIDI input → `NoteInputPipeline` → same path

**Separation of concerns:**

| Layer | File | Responsibility |
|-------|------|----------------|
| State machine | `GameLoop.ts` | PlaybackDriver, TempoClock, EventRegistry, JudgmentEngine, AutoPlayer, logic tick, MIDI I/O |
| Rendering | `ScoreRenderer.ts` | Verovio load/layout, SVG DOM management, ScoreToSvgMapper, BoxHighlightRenderer, JudgmentDisplay, ViewportPositioner, keyboard handler, RAF loop |
| Orchestration | `ScoreView.tsx` | Wires React state → GameLoop + ScoreRenderer, handles file loading UI, events dispatch |

## State & Persistence

`PracticeState` in `src/score/ScoreTypes.ts`. Reducer in `src/context/practiceStore.tsx`.

**PERSISTED_KEYS** (saved to localStorage, line ~257 of `practiceStore.tsx`):
`zoom`, `measuresWindow`, `emptyMeasures`, `bpmOverrideEnabled`, `bpmOverride`, `speedRatio`, `voiceColors`, `displayMode`, `highlightLeadBeats`, `highlightRange`, `logicFps`, `renderFps`, `verovioPageWidth`, `verovioPageHeight`, `verovioStaffSpacing`, `verovioNoteSpacing`, `midiEnabled`, `midiDeviceId`, `highlightMode`, `autoPlayVolume`, `autoPlayDelay`, `velocityJudgmentEnabled`, `pedalJudgmentEnabled`, `noteOffJudgmentEnabled`, `theme`, `colorScheme`, `highlightColor`, `jdPerfectColor`, `jdGreatColor`, `jdGoodColor`, `jdMissColor`, `highlightPadX`, `highlightPadY`, `highlightStrokeWidthActive`, `highlightStrokeWidthPreview`, `jdStrokeWidth`.

When adding a new persisted setting, add it to BOTH the `PERSISTED_KEYS` array AND the `useEffect` dependency array in `practiceStore.tsx`.

## Verovio Rendering

`VerovioRenderer` (in `src/renderer/VerovioEngine.ts`) wraps Verovio toolkit. Key points:

- `loadScore(rawDocument: string)` — loads XML/MEI data, sets `svgAdditionalAttribute: ["note@pname", "note@oct", "note@staff", "note@voice"]` so SVG `<note>` elements carry pitch/oct/staff/voice metadata
- `applyLayout(opts)` — sets scale/pageWidth/pageHeight/spacingStaff/spacingLinear, calls `redoLayout({ resetCache: true })`
- `renderSVG(pageNo: number)` — 1-indexed, cached per page
- `getElementAttr(xmlId)` — returns pname/oct for a note. `staff`/`voice` may be absent in Verovio 6.1.0; the mapper falls back to DOM ancestor inference (`closest('.staff')` / `closest('.layer')`).
- `buildNoteQstampMap()` — builds a `Map<noteId, qstamp>` from `renderToTimemap()`. `qstamp` is the global quarter-note onset used for event→SVG matching.
- `VerovioScoreToSvgMapper.build(flatEvents, vrv)` — matches internal ScoreEvents to SVG note elements by `qstamp`+pitch within staff:voice groups

**Layout options** (`VerovioLayoutOptions`): `zoom`, `pageWidth`, `pageHeight`, `staffSpacing`, `noteSpacing`. Scale is computed as `Math.round(40 * zoom)`.

SVG notes are styled by CSS selectors: `.hl-box-active` (next column highlight box), `.hl-box-preview` (subsequent columns, dimmed), `.jd-perfect` / `.jd-great` / `.jd-good` / `.jd-miss` (judgment overlays).

## Keyboard Input

Keyboard handler lives in `ScoreRenderer._attachKeyboard()`:

- In **scroll mode + playing**, 12 keys map to MIDI 60–72 (C4–C5 chromatic):
  ```
  A=60  W=61  S=62  E=63  D=64  F=65  T=66  G=67  Y=68  H=69  U=70  J=71  K=72
  ```
  Keys call `GameLoop.noteOn(midi, 64)`.

- In **page mode + not playing**, ArrowLeft/ArrowRight navigate pages.

## ScoreEvent & Judgment

`ScoreEvent` interface fields: `pitch`, `time`, `duration`, `measureIndex`, `isRest`, `voice`, `staffIndex`.

Timing windows: perfect ≤40ms, great ≤80ms, good ≤120ms, miss >120ms or beyond MISS_WINDOW (200ms).

- `JudgmentResult` includes: `grade`, `pitch`, `expectedPitch`, `timingDelta`, `beat`, `measureIndex`, `noteIndex`, `staffIndex`.
- Judgment key format: `"${measureIndex}:${staffIndex}:${noteIndex}"` (used in `_judgedKeys` Set and `FlatEvent` map)
- `JudgmentEngine.onInputColumn(pitches[], currentTime)` — handles chords (multiple pitches at once)
- `checkMissed(currentTime)` is called every logic tick to auto-miss notes past the window

## Common Gotchas

- **Verovio toolkit must be initialized before use**: `VerovioRenderer.init()` is async (WASM loading). `ScoreRenderer.loadScore()` handles this internally. Also pre-initialized in `main.tsx`.
- **Layout invalidates all Verovio caches**: `applyLayout()` clears SVG cache, timemap cache. `ScoreRenderer.applyLayout()` automatically rebuilds mapper + SVG DOM + judgment overlays.
- **`resetXmlIdSeed(0)`** is called on every `loadScore()` — ensures stable XML IDs across reloads.
- **`GameLoop` singleton** — `getGameLoop()` returns a module-scoped instance. Pure state machine, no DOM references. Used by ScoreView + ScoreRenderer via import, not React context. Persists across hot-reloads in dev.
- **`PlaybackDriver.elapsed` uses `performance.now()`** — elapsed time is wall-clock seconds since play started. TempoClock handles beat↔time conversion separately.
- **Logic tick uses `setInterval` not RAF** — configured by `logicFps` state. RAF is used by `ScoreRenderer._renderTick()` for highlight/scroll rendering only.
- **No `dangerouslySetInnerHTML`** — `ScoreRenderer` directly sets `container.innerHTML` for SVG DOM, avoiding React reconciliation issues with third-party SVG.
- **MusicXML parser** uses native `DOMParser`, no external XML library. `.mxl` files are ZIP archives — use `JSZip` to extract XML.
- **TSConfig project references**: `tsconfig.json` references `tsconfig.app.json` (src) and `tsconfig.node.json` (vite config). Build uses `tsc -b` for project-mode typechecking.
- **No barrel files**: All imports use direct file paths. No `index.ts` re-exports.
- **ESLint flat config**: `eslint.config.js` (ESM, not CJS). Plugin: `react-hooks`, `react-refresh`. `@typescript-eslint` with recommended rules.
- **`guide.md`** (Chinese) is the module-by-module dev guide. May be slightly outdated — trust this file first.
- **`CONTEXT.md`** (domain language) + `docs/adr/` (architectural decisions).

## Test Data

- Vitest configured (`vitest` ^4.1.7), test files live in `tests/`.
- Existing test: `tests/NoteInputPipeline.test.ts` — verifies keyboard input routing.
- Test artifact: `tests/BasicTest.musicxml` — sample MusicXML for manual testing.

## API Reference

- [Verovio toolkit](https://book.verovio.org/toolkit-reference/toolkit-methods.html)
- [Web MIDI](https://webaudio.github.io/web-midi-api/)

## Agent Skills

### Issue tracker

Issues live as GitHub Issues (via `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: `CONTEXT.md` at root, `docs/adr/` for decisions. See `docs/agents/domain.md`.
