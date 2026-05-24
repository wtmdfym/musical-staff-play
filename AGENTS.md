# Musical Staff Play - Agent Guidelines

Note: This project is built on Windows, so make sure to use Windows PowerShell commands to avoid unnecessary errors.
Program latency is critical for this project and should be minimized at all times.

## Relative APIs

- `Verovio toolkit`: https://book.verovio.org/toolkit-reference/toolkit-methods.html

## Development Commands

- `pnpm run dev` - Start development server (Vite, with COOP/COEP headers)
- `pnpm run build` - Build for production (tsc + vite build)
- `pnpm run lint` - Run ESLint
- `pnpm run preview` - Preview production build

## Key Technical Constraints

- **SharedArrayBuffer requires specific headers**: Vite server already configured with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` in `vite.config.ts`
- **Web MIDI API**: Available in Chromium-based browsers (Chrome/Edge/Opera v90+). Requires user gesture to request access. Used for real MIDI keyboard input via `MidiInputManager.ts`.
- **AudioContext**: Must be initiated via user gesture (click/tap), sampleRate may be 44.1kHz or 48kHz
- **Timing**: All time-based operations must use `AudioContext.currentTime`, never `Date.now()` or `performance.now()` — `PlaybackEngine.ts` implements this
- **ESLint config**: Uses `argsIgnorePattern: "^_"` to allow unused underscore-prefixed params

## Project Structure (current)

- **Entrypoint**: `src/main.tsx`
- **Root component**: `src/App.tsx` (layout: TopBar → ControlBar → ScoreView+StatsPanel+Feedback → TimelineBar → Footer; includes SettingsPanel modal)
- **State management**: `src/context/` — `practiceContext.ts` (dual context: state + dispatch), `practiceStore.tsx` (reducer + localStorage persistence), `usePractice.ts`
- **Score data**: `src/score/ScoreTypes.ts`, `src/score/MusicxmlParser.ts`, `src/score/MidiParser.ts`, `src/data/mockScore.ts`
- **Renderer**: `src/renderer/` — ScoreRenderer (base with all markings, judgment indicators), PageRenderer, ScrollRenderer, LayoutEngine, GlyphAtlas, LelandFont
- **Playback/Judgment**: `src/playback/` — `PlaybackEngine.ts` (AudioContext-based clock), `JudgmentEngine.ts` (pitch-time comparison, column-based judgment), `MidiInputManager.ts` (Web MIDI device management)
- **Components**: `src/components/` — TopBar, ControlBar, ScoreFileSelector, TransportControls, DisplaySettings, PositionControls, ScoreView, TimelineBar, StatsPanel, FeedbackLayer (combo only), HeatmapView, SettingsPanel
- **Feedback**: `src/feedback/emitFeedback.ts` (pub/sub, combo-only feedback now; judgment shown on canvas)

## Settings System

All configurable parameters go through `PracticeState` and persist to `localStorage` under `musicalStaffPlay_settings`:

- **Display**: zoom, linesPerPage, measureGap, lineSpacing, playheadRatio, measuresWindow, emptyMeasures, bpmOverride
- **Grand Staff**: grandStaffSpacing (0.5-3.0)
- **Scroll**: scrollSpeed (20-500 px/beat), highlightLeadBeats (0.1-2.0 beats)
- **Layout**: measurePadding (0-0.5 sps)
- **Voices**: voiceColors (Record<number, string> for voices 0-7)
- **PERSISTED_KEYS** defined in `practiceStore.tsx` — add new settings there
- **SettingsPanel** component: modal overlay, ⚙ button in ControlBar

## Judgment & Feedback

- **JudgmentEngine**: Pitch+timing matching using timing windows (perfect 40ms, great 80ms, good 120ms, miss 200ms). Uses `WeakMap<ScoreEvent, number>` for stable event IDs. Results include `noteIndex`.
- **Canvas judgment indicators**: After judgment, colored indicators drawn at note positions (green circle+✓ for perfect, blue circle for great, yellow circle for good, red X for miss). Fade out over 1s.
- **FeedbackLayer (DOM)**: Now only shows combo streak text. Per-note judgment feedback is rendered on the canvas.
- **`judgedNotes` state**: Tracks which notes have been judged to hide highlights.
- **MIDI input**: `MidiInputManager` wraps `navigator.requestMIDIAccess()`. NoteOn events feed through `JudgmentEngine.onInputColumn()` — same path as keyboard input. Must be triggered by user gesture (Play button click). Device hotplug handled via `onstatechange`.
- **Page mode keyboard**: Arrow keys for navigation (disabled during playback).
- **Scroll mode keyboard**: A-K keys = C4-C5 chromatic scale. `onInputColumn` automatically includes expected pitches for lenient matching.

## Verification Flow

1. Build: `pnpm run build` (no errors)
2. Lint: `pnpm run lint` (no errors)
3. Dev: `pnpm run dev` → open browser
4. Load test: Open `public/samples/c_major_scale.musicxml` via the Open button
5. Visual checks:
   - Page mode: 5 measures displayed, ← → arrow keys turn pages, page number shown at bottom
   - Scroll mode: red playhead line at 25% width, notes scroll on autoplay via AudioContext timing
   - Zoom slider changes note/staff size (all spacing scales proportionally)
   - Play button auto-scrolls (scroll mode) or advances pages; stats update in real-time
   - Stats panel shows on the right with grade/combo/counts
   - Timeline bar at bottom shows measure progress with click-to-jump
   - Keyboard input: Press A-K while playing in scroll mode to trigger judgment (A=C4, S=D4, etc.)
   - Canvas judgment indicators show on note positions (green=perfect, blue=great, yellow=good, red=miss)
   - Highlighted notes vanish after judged (no visual clutter)
   - Settings panel (⚙ button): all settings configurable and persist across reloads
   - MIDI input: Click Connect MIDI button in control bar or settings panel, then play to test with physical MIDI keyboard
   - MIDI device selector in settings shows available devices, auto-select works for single device
   - Grand staff: MusicXML files with bass clef show treble+bass staves
   - Key signature: Displayed after clef in correct staff position
   - Slurs/dynamics/articulations render when present in MusicXML
   - Barlines have configurable padding to avoid note overlap

## Common Gotchas

- **LayoutEngine**: `calculatePageLayout` and `calculateScrollLayout` accept `measurePadding` (fraction of sps) — adjusts note x positions within measures to add space after barlines. Both return `staves[]` with `clef` info.
- **NotePosition fields**: `pitch`, `x`, `y`, `stemUp`, `isRest`, `staffY`, `duration`, `alter`, `dot`, `articulations`, `measureIndex`, `noteIndex`, `voice` — always include ALL fields.
- **ScoreEvent**: requires `alter`, `dot`, `articulations`, `voice`; MusicXML parser now reads `<voice>` from XML.
- **PlaybackEngine**: AudioContext created lazily in `init()`. Must be triggered by user gesture.
- **JudgmentEngine**: `JudgmentResult` now includes `noteIndex`. `IndexedEvent` stores `noteIndex` for mapping results back to note positions.
- **RAF loop**: `renderLoopRef` pattern avoids stale closures. Runs in both scroll+playing and page+playing modes.
- **Resize handler**: Debounced at 100ms.
- **Layout caching**: ScrollRenderer and PageRenderer cache layouts per dimensions/zoom/spacing params. Invalidate when parameters change by setting cachedLayout = null.
- **Notehead rendering**: `drawNotehead` uses adjusted Y (`ny = y - sps * 0.06`) for visual centering. Flag X offset `sps * 0.72` from center. Stem positions use `nhw = sps * 0.55` and `nhh = sps * 0.38`.
- **Ledger lines**: Uses adjusted notehead Y (matching `ny`) for correct alignment. Former bug (offset downward) fixed.
- **Scroll speed**: Configurable via `scrollSpeed` setting (replaces hardcoded `PX_PER_BEAT_BASE = 130`).
- **MusicXML parser uses native DOMParser** — no external XML library needed.
- **When editing React components**: Ensure ref access is in useEffect not during render.
- **Voice coloring**: `voiceColors` in RenderConfig, passed to `drawNotehead` as `color` param. `drawGlyph` accepts optional `color` param, resets to `THEME.fg` after draw.
- **Settings persistence**: `PERSISTED_KEYS` array in `practiceStore.tsx` controls what gets saved. New settings must be added there AND in the useEffect dependency array.
- **ESLint rule `react-hooks/refs`**: Don't assign refs during render; use useEffect for ref assignment.

## Agent skills

### Issue tracker

Issues live as GitHub Issues (via `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: `CONTEXT.md` at root, `docs/adr/` for decisions. See `docs/agents/domain.md`.
