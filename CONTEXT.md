# Musical Staff Play

A browser-based musical staff reading practice tool. Renders MusicXML/MEI scores via Verovio, accepts keyboard and MIDI input, judges note accuracy against the score, and provides real-time visual feedback.

## Language

### Score Structure

**Score**:
A musical document loaded from a MusicXML or MEI file. Contains measures, tempo information, and metadata.
_Avoid_: piece, song, file

**Measure**:
A time-delimited segment of the Score. Each measure contains events, a time signature, key signature, and clef.
_Avoid_: bar

**Event**:
A single note or rest in a Measure. Has a pitch, onset time (in beats), duration, and voice.
_Avoid_: note (ambiguous — a NoteEvent is a specific kind of Event)

**Chord**:
Multiple Events at the same onset time within a Measure. Rendered as stacked noteheads on the same stem.
_Avoid_: group, cluster

**Tie**:
A curved line connecting two Events of the same pitch across a barline or beat boundary. Indicates the two notes should be played as one sustained note whose duration equals the sum of the tied durations. Not to be confused with a Slur (which connects notes of different pitches for phrasing).
_Avoid_: slur, legato

**Voice**:
A polyphonic line within a Staff. Each Event belongs to exactly one Voice. Voices are numbered 0–7 (labeled "Voice 1" through "Voice 8" in the UI) and may be color-coded for visual distinction. In Box Highlight mode, Events in different Voices at the same onset receive separate Highlight Boxes.
_Avoid_: layer, part, track

**Staff**:
A set of 5 horizontal lines where Events are placed. A Score page may contain one Staff (single) or two Staves (grand staff: treble + bass).
_Avoid_: system, line

**Clef**:
Determines the pitch mapping of Staff lines. Either treble or bass.
_Avoid_: key

**Pedal**:
The sustain (damper) pedal, MIDI CC 64. Represented in MusicXML as `<pedal type="start"/>` / `<pedal type="stop"/>` inside `<direction>` elements. Extracted by the parser as **PedalEvent** entries: onset beat, type (start or stop), and measure index. The pedal is global—it affects all voices and staves on the same MIDI channel.
_Avoid_: sostenuto, soft pedal, una corda

**Dynamics**:
A dynamic marking (pp, p, mp, mf, f, ff) that applies to a note or passage. Parsed from MusicXML `<direction><dynamics>` elements. Attached directly to each ScoreEvent as a `dynamics` field. In the absence of any marking, defaults to `mf`. Each marking maps to a MIDI velocity range for Judgment purposes.
_Avoid_: volume, loudness

### Playback

**AutoPlay**:
A playback mode where the app automatically synthesizes the correct note at the correct time using Web Audio API. No user input is required. No judgments are generated and no stats are accumulated. The highlight system tracks the playback position visually. Intended as a demo/watch mode, not a practice mode.
_Avoid_: auto-play, auto, demo, watch, playback-only

**Beat**:
A unit of musical time. All Event onset times are measured in beats from the start of the Score. Beats convert to wall-clock seconds via the Tempo map.
_Avoid_: tick, step, unit

**Tempo**:
The speed of playback, expressed in beats per minute (BPM). A Tempo map defines how BPM changes over the course of the Score.
_Avoid_: speed, rate

**Tempo Override**:
When enabled, replaces the Score's Tempo map with a fixed BPM value. When disabled, the Score's Tempo map is used as-is, scaled by the Speed Ratio.
_Avoid_: fixed BPM, forced tempo

**Speed Ratio**:
A multiplier applied to the Score's Tempo map to speed up or slow down playback. `1.0` = original speed. Only active when Tempo Override is disabled.
_Avoid_: playback rate, tempo scale

### Input

**Note On**:
A MIDI message (status 0x90, velocity > 0) indicating a key press. The primary input that triggers a Judgment. Carries pitch and velocity.
_Avoid_: keypress, keydown

**Note Off**:
A MIDI message (status 0x80, or 0x90 with velocity = 0) indicating a key release. Triggers a Note Off Judgment to evaluate Duration accuracy. When the Pedal is down, Note Off events are deferred until the pedal is released.
_Avoid_: keyup, release

**Control Change (CC)**:
A MIDI message (status 0xB0) carrying a controller number and value. CC 64 is the sustain Pedal. Other CC numbers are ignored.
_Avoid_: controller, cc message

**Active Note Set**:
Held by the JudgmentEngine. Tracks which pitches are currently sounding, maintained by Note On/Off events and Pedal state. When the Pedal is down, Note Off events do not remove entries from the Active Note Set. When the Pedal is released, all pedal-sustained notes are removed simultaneously and receive deferred Note Off Judgments.
_Avoid_: playing notes, held keys

### Judgment

**Judgment**:
The act of comparing user input (pitch, timing, velocity, pedal action) against expected values from the Score. Each user action produces one or more **Judgment Results** — one per applicable Judgment Type. Judgments are produced in five Type dimensions: noteOn, noteOff, velocity, and pedal.
_Avoid_: evaluation, scoring, grading

**Judgment Type**:
The dimension being judged. One of: `noteOn` (key press timing + pitch match), `noteOff` (key release timing → Duration accuracy), `velocity` (key velocity vs expected Dynamics range), or `pedal` (pedal start/stop timing vs PedalEvent markings). Each Type produces its own independent JudgmentResult with its own Grade.

**Grade**:
The result of a single Judgment. One of: `perfect`, `great`, `good`, or `miss`. Timing windows vary by Judgment Type:
- **noteOn**: perfect ≤40ms, great ≤80ms, good ≤120ms, miss >120ms (or wrong pitch)
- **noteOff**: same timing windows, applied to Duration delta (actual release − expected release)
- **velocity**: perfect ≤16 MIDI units deviation from expected range midpoint, great ≤32, good ≤48, miss >48
- **pedal**: same timing windows as noteOn, applied to pedal action delta vs PedalEvent beat
_Avoid_: score, rating, level

**Column**:
A set of Events at the same beat position that are played together. Highlighting operates on Columns — the next Column is highlighted at full brightness, and configurable subsequent Columns are dimmed.
_Avoid_: group, stack, cluster

**Combo**:
A streak of consecutive non-miss noteOn Judgments. Tracks current and maximum streak length. Resets to zero only on a noteOn miss. noteOff, velocity, and pedal misses do not break the Combo.
_Avoid_: streak, chain

**Duration**:
The time a note is held by the user, measured from Note On to Note Off. Assessed against the ScoreEvent's expected duration (onset time + duration in beats, converted to seconds via TempoClock). When the Pedal is active, the note is considered "held" until either the pedal is released (deferred Note Off) or the user releases the key after pedal release. Duration is a component of the noteOff Judgment Type.
_Avoid_: hold time, sustain time

### Rendering

**Page Mode**:
Displays one page of the Score at a time. Navigation via arrow keys or automatic page advance during playback.
_Avoid_: single-page, paged

**Scroll Mode**:
Displays the entire Score as a continuous vertical strip. The Score scrolls vertically past a fixed screen anchor point.
_Avoid_: continuous, rolling

**Highlight**:
The visual indication of upcoming Columns that the user is expected to play next. Two modes: **Color Highlight** (CSS fill color on `<g class="note">` elements) and **Box Highlight** (SVG overlay `<rect>` elements wrapping note groups with tie extension). The next Column is shown at full intensity; subsequent Columns within the lead window appear dimmed.
_Avoid_: mark, indicator, selection

**Highlight Box**:
A semi-transparent rounded rectangle rendered as an SVG overlay `<rect>` on top of the Verovio score, wrapping the bounding box of a note or chord group. Multiple notes at the same onset time and same Staff are merged into a single box. Notes at the same onset but different Voices receive separate boxes. If a note is connected by a Tie, the box extends to include the tied note.
_Avoid_: rectangle, overlay, marker

**Feedback**:
Visual response shown after a Judgment. Includes both per-note styling on the Score SVG (via CSS data attributes) and optional center-screen floating text (combo streak text and grade indicators). Multi-dimensional Feedback uses different CSS properties per Judgment Type: noteOn → `fill`, noteOff → `stroke`, velocity → overlay marker element. Pedal judgments appear only in the Stats panel, not on the SVG.
_Avoid_: notification, popup, alert

**Zoom**:
Uniform scaling of the rendered Score SVG. Applied as Verovio's `scale` option. Independent of page dimensions and staff spacing.
_Avoid_: size, magnification

### Architecture

**ScoreEventIndex**:
A flattened, sorted array of all non-rest Events in a Score. Built once per Score load and consumed by both the Judgment module and the Highlight module. Eliminates duplicated traversal logic.
_Avoid_: flat events, event list

**PlaybackEvent**:
A domain event emitted by the core playback loop (e.g., `playback-ended`, `page-advanced`, `scroll-offset-changed`). Decouples the core engine from React state management.
_Avoid_: action, dispatch

**PlaybackEventSink**:
The Interface that receives PlaybackEvents. The React adapter implements this seam to translate domain events into React dispatches. A test adapter can record events for headless testing.
_Avoid_: callback, handler

## Flagged Ambiguities

- **"Event"** — used both for ScoreData events (notes/rests from the parser) and Verovio timemap events (position records with SVG IDs). Context disambiguates. When mapping between them, use explicit names: **ScoreEvent** and **TimemapElement**.

- **"Judgment"** — previously unidimensional (one Grade per note input). Now multi-dimensional: a single user action (key press, key release, pedal toggle) produces one Judgment per applicable Type. Use **JudgmentResult** (the output object with a `type` field) and **Judgment Type** (the dimension: noteOn, noteOff, velocity, pedal) to disambiguate.

## Dialogue

> **Dev**: "When a note is judged perfect, what should happen visually?"
> **Domain expert**: "The notehead turns green via CSS, and if Judgment Display is set to 'Color + Text', a floating checkmark appears at center screen."
>
> **Dev**: "And for highlights — what does 'upcoming column' mean?"
> **Domain expert**: "The next Column of Events that hasn't been judged yet. After the Playhead passes it, the next unjudged Column becomes the active highlight."
>
> **Dev**: "How does Tempo override work with highlights?"
> **Domain expert**: "The Score has an original Tempo map. The user can either enable a fixed Tempo Override (replacing the map entirely), or keep it disabled and apply a Speed Ratio (multiplying the map's BPM). Either way, Verovio's SVG positions are based on the original Tempo, so highlight timing uses the original map to stay aligned with the rendered notes."
>
> **Dev**: "What happens to Keyboard/MIDI input during AutoPlay?"
> **Domain expert**: "All user input is blocked during AutoPlay. The app sends no MIDI, ignores keyboard note inputs, and produces no Judgment results. The highlight follows the Playhead position based on elapsed time rather than judged notes."
>
> **Dev**: "Does AutoPlay sound notes during the empty-measures countdown?"
> **Domain expert**: "No. AutoPlay respects the empty-measures visual countdown period. The first note sounds when the playhead reaches beat 0 of the score, aligned with the visual scroll. This gives the viewer time to orient to the staff before notes begin."
>
> **Dev**: "Does a velocity miss break the combo?"
> **Domain expert**: "No. Only a noteOn miss breaks the combo. Velocity, noteOff, and pedal misses are quality feedback — they don't interrupt the correctness streak."
>
> **Dev**: "What happens when the pedal is down and the user releases a key?"
> **Domain expert**: "The Note Off is deferred. The Active Note Set keeps tracking it as held. When the pedal is finally released, all pedal-sustained notes are released at once. Each gets a Note Off Judgment with the pedal-release time as the actual Note Off time, compared against each note's expected release time from the Score."
>
> **Dev**: "What if a score has no dynamics markings?"
> **Domain expert**: "Every ScoreEvent defaults to `mf` dynamics. This maps to MIDI velocity range 64–79, midpoint 71.5. All velocity Judgments are relative to this default, so the system works gracefully on scores without explicit dynamics."
