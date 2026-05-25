# Musical Staff Play - Agent Guidelines

Note: This project is built on Windows — use PowerShell commands not bash. Latency-critical; keep operations lightweight.

## Development Commands

- `pnpm run dev` - Start dev server (Vite, port 5173 by default)
- `pnpm run build` - Build for production (`tsc -b && vite build`)
- `pnpm run lint` - ESLint

## Tech Stack

| Concern               | Implementation                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework             | React 19, TypeScript ~6.0, Vite 8                                                                                                                                   |
| Score rendering       | Verovio WASM toolkit (`verovio` ^6.1.0) — renders MusicXML/MEI → SVG                                                                                                |
| Rendering engine      | `VerovioRenderer` (`src/renderer/VerovioEngine.ts`) — singleton via `getVerovioRenderer()`                                                                          |
| Timing / beat-to-time | `TempoClock` (`src/playback/TempoClock.ts`) — pure arithmetic, no AudioContext                                                                                      |
| Game loop             | `GameLoop` (`src/core/GameLoop.ts`) — singleton via `getGameLoop()`. Two independent ticks: logic (setInterval, configurable FPS) + render (RAF, optional throttle) |
| Judgment              | `JudgmentEngine` (`src/playback/JudgmentEngine.ts`) — pitch + timing matching                                                                                       |
| Feedback display      | `JudgmentDisplay` (`src/feedback/JudgmentDisplay.ts`) — sets `data-judgment` attribute on SVG `<note>` elements for CSS styling                                     |
| MIDI input            | `MidiInputManager` (`src/playback/MidiInputManager.ts`) — singleton, Web MIDI API                                                                                   |
| State                 | React Context + useReducer, localStorage persistence under `musicalStaffPlay_settings`                                                                              |

## Browser Constraints

- Chromium-based browser (Chrome/Edge/Opera) v90+ required for Web MIDI
- COOP/COEP headers configured in `vite.config.ts` for SharedArrayBuffer (though Verovio may not need it)
- Web MIDI requires secure context (localhost or HTTPS) + user gesture
- Verovio WASM module loads lazily in `VerovioRenderer.init()` — first call triggers ~2MB WASM download

## Architecture

Entry: `src/main.tsx` → `src/App.tsx` → layout: TopBar → ControlBar → (ScoreView + StatsPanel) → TimelineBar → Footer; SettingsPanel modal.

**Core flow:**

1. User opens MusicXML/MEI → `MusicxmlParser` produces `ScoreData`
2. `GameLoop.loadScore(score, rawDocument)` sets up TempoClock, flattens events, loads Verovio, builds SVG event ID map
3. During playback, `GameLoop._logicTick()` (setInterval) drives judgment checking + scroll/page dispatch
4. `GameLoop._renderTick()` (RAF) updates highlights, playhead position, and SVG transform for scrolling
5. `GameLoop._handleNoteInput(midi)` → `JudgmentEngine.onInputColumn(pitches, time)` → `GameLoop` sets `data-judgment` on SVG note element

## State & Persistence

`PracticeState` in `src/score/ScoreTypes.ts`. Reducer in `src/context/practiceStore.tsx`.

**PERSISTED_KEYS** (saved to localStorage): `zoom`, `playheadRatio`, `measuresWindow`, `emptyMeasures`, `bpmOverrideEnabled`, `bpmOverride`, `speedRatio`, `voiceColors`, `displayMode`, `highlightLeadBeats`, `highlightRange`, `logicFps`, `renderFps`, `verovioPageWidth`, `verovioPageHeight`, `verovioStaffSpacing`, `verovioNoteSpacing`, `midiEnabled`, `midiDeviceId`, `highlightMode`.

When adding a new persisted setting, add it to BOTH the `PERSISTED_KEYS` array and the `useEffect` dependency array (line ~202-209 of `practiceStore.tsx`).

## Verovio Rendering

`VerovioRenderer` wraps Verovio toolkit. Key points:

- `loadScore(rawDocument: string)` — loads XML/MEI data, sets `svgAdditionalAttribute: ["note@pname", "note@oct", "note@staff", "note@voice"]` so SVG `<note>` elements carry pitch/oct/staff/voice metadata
- `applyLayout(opts)` — sets scale/pageWidth/pageHeight/spacingStaff/spacingLinear, calls `redoLayout({ resetCache: true })`
- `renderSVG(pageNo: number)` — 1-indexed, cached per page
- `getElementAttr(xmlId)` — returns pname/oct for a note. `staff`/`voice` may be absent in Verovio 6.1.0; the mapper falls back to DOM ancestor inference (`closest('.staff')` / `closest('.layer')`).
- `buildNoteQstampMap()` — builds a `Map<noteId, qstamp>` from `renderToTimemap()`. `qstamp` is the global quarter-note onset used for event→SVG matching.
- `ScoreToSvgMapper.build(flatEvents, vrv)` (`VerovioScoreToSvgMapper`) — matches internal ScoreEvents to SVG note elements by `qstamp`+pitch within staff:voice groups

**Layout options** (`VerovioLayoutOptions`): `zoom`, `pageWidth`, `pageHeight`, `staffSpacing`, `noteSpacing`. Scale is computed as `Math.round(40 * zoom)`.

SVG notes are styled by CSS selectors: `.note.highlight-active` (next column, full brightness), `.note.highlight-preview` (subsequent columns, dimmed), `.note[data-judgment="perfect"]` etc.

## Keyboard Input

In scroll mode + playing, 12 keys map to MIDI 60–72 (C4–C5 chromatic):

```
A=60  W=61  S=62  E=63  D=64  F=65  T=66  G=67  Y=68  H=69  U=70  J=71  K=72
```

In page mode + not playing, ArrowLeft/ArrowRight navigate pages. All keyboard handling is in `GameLoop.init()`.

## ScoreEvent & Judgment

`ScoreEvent` interface fields: `pitch`, `time`, `duration`, `measureIndex`, `isRest`, `voice`, `staffIndex`.

Timing windows: perfect ≤40ms, great ≤80ms, good ≤120ms, miss >120ms or beyond MISS_WINDOW (200ms).

- `JudgmentResult` includes: `grade`, `pitch`, `expectedPitch`, `timingDelta`, `beat`, `measureIndex`, `noteIndex`, `staffIndex`.
- Judgment key format: `"${measureIndex}:${staffIndex}:${noteIndex}"` (used in `_judgedKeys` Set and `FlatEvent` map)
- `JudgmentEngine.onInputColumn(pitches[], currentTime)` — handles chords (multiple pitches at once)
- `checkMissed(currentTime)` is called every logic tick to auto-miss notes past the window

## Common Gotchas

- **Verovio toolkit must be initialized before use**: `VerovioRenderer.init()` is async (WASM loading). Check `isReady` before calling toolkit methods.
- **Layout invalidates all Verovio caches**: `applyLayout()` clears SVG cache, timemap cache, and event ID map. Must rebuild event map after layout changes.
- **`resetXmlIdSeed(0)`** is called on every `loadScore()` — ensures stable XML IDs across reloads.
- **`GameLoop` singleton** — `getGameLoop()` returns a module-scoped instance. Used by ScoreView via import, not React context. The instance persists across hot-reloads in dev.
- **`GameLoop._getElapsed()` uses `performance.now()`** — elapsed time is wall-clock seconds since play started. TempoClock handles beat↔time conversion separately.
- **Logic tick uses `setInterval` not RAF** — configured by `logicFps` state. RAF is used for the render tick only.
- **Debug logging** — GameLoop logs render/logic tick counts on stop. These use `console.log` with `[DEBUG-diagnose]` prefix. Don't remove them unless told to.
- **MusicXML parser** uses native `DOMParser`, no external XML library. `.mxl` files are ZIP archives — use `JSZip` to extract XML. The parser feeds into Verovio via `rawDocument` (the original XML string).
- **TSConfig project references**: `tsconfig.json` references `tsconfig.app.json` (src) and `tsconfig.node.json` (vite config). Build uses `tsc -b` for project-mode typechecking.
- **ESLint**: `argsIgnorePattern: "^_"` allows unused underscore-prefixed params. `react-hooks/refs` rule — assign refs in useEffect, not render.
- **No barrel files**: All imports use direct file paths (`import { X } from './core/GameLoop'`). No `index.ts` re-exports.
- **No test framework**: No vitest/jest configured. The only test artifact is `tests/BasicTest.musicxml` (10-measure grand-staff piano score).
- **`.claude/CLAUDE.md` is stale**: References old Canvas 2D architecture (deleted files like `ScoreRenderer.ts`, `PageRenderer.ts`, `LayoutEngine.ts`, `GlyphAtlas.ts`). Do not rely on it — trust this file and `guide.md` instead.
- **`guide.md`** (Chinese) is the definitive module-by-module dev guide with data-flow diagrams and common-modification scenarios. Consult it for detailed docs beyond this file.

## API reference

Visit links of API for reference when you need to use it.

- `Verovio toolkit`: https://book.verovio.org/toolkit-reference/toolkit-methods.html

## Test Data

- `MusicXML`: tests\BasicTest.musicxml

## Agent skills

### Issue tracker

Issues live as GitHub Issues (via `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: `CONTEXT.md` at root, `docs/adr/` for decisions. See `docs/agents/domain.md`.
