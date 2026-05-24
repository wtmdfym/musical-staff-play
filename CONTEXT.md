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

**Voice**:
A polyphonic line within a Staff. Each Event belongs to exactly one Voice. Voices are numbered (0–7) and may be color-coded for visual distinction.
_Avoid_: layer, part, track

**Staff**:
A set of 5 horizontal lines where Events are placed. A Score page may contain one Staff (single) or two Staves (grand staff: treble + bass).
_Avoid_: system, line

**Clef**:
Determines the pitch mapping of Staff lines. Either treble or bass.
_Avoid_: key

### Playback

**Beat**:
A unit of musical time. All Event onset times are measured in beats from the start of the Score. Beats convert to wall-clock seconds via the Tempo map.
_Avoid_: tick, step, unit

**Tempo**:
The speed of playback, expressed in beats per minute (BPM). A Tempo map defines how BPM changes over the course of the Score.
_Avoid_: speed, rate

**Playhead**:
The visual cursor showing the current playback position. In scroll mode, a horizontal line at a configurable screen ratio. In page mode, a vertical line sweeping across the page.
_Avoid_: cursor, indicator, needle

### Judgment

**Judgment**:
The act of comparing an input note (from keyboard or MIDI) against an expected Event in the Score. Produces a Grade based on pitch match and timing delta.
_Avoid_: evaluation, scoring, grading

**Grade**:
The result of a Judgment. One of: `perfect` (within 40ms), `great` (80ms), `good` (120ms), or `miss` (beyond 120ms or wrong pitch).
_Avoid_: score, rating, level

**Column**:
A set of Events at the same beat position that are played together. Highlighting operates on Columns — the next Column is highlighted at full brightness, and configurable subsequent Columns are dimmed.
_Avoid_: group, stack, cluster

**Combo**:
A streak of consecutive non-miss Judgments. Tracks current and maximum streak length. Resets to zero on any miss.
_Avoid_: streak, chain

### Rendering

**Page Mode**:
Displays one page of the Score at a time. Navigation via arrow keys or automatic page advance during playback.
_Avoid_: single-page, paged

**Scroll Mode**:
Displays the entire Score as a continuous vertical strip. The Playhead is fixed on screen; the Score scrolls past it.
_Avoid_: continuous, rolling

**Highlight**:
Visual marking of upcoming Events using CSS fill color on the Verovio SVG. The next Column receives full-brightness highlight; subsequent Columns within the lead window receive dimmed preview highlighting.
_Avoid_: mark, indicator, selection

**Feedback**:
Visual response shown after a Judgment. Includes both per-note styling on the Score SVG (via CSS data attributes) and optional center-screen floating text (combo streak text and grade indicators).
_Avoid_: notification, popup, alert

**Zoom**:
Uniform scaling of the rendered Score SVG. Applied as Verovio's `scale` option. Independent of page dimensions and staff spacing.
_Avoid_: size, magnification

## Flagged Ambiguities

- **"Event"** — used both for ScoreData events (notes/rests from the parser) and Verovio timemap events (position records with SVG IDs). Context disambiguates. When mapping between them, use explicit names: **ScoreEvent** and **TimemapElement**.

## Dialogue

> **Dev**: "When a note is judged perfect, what should happen visually?"
> **Domain expert**: "The notehead turns green via CSS, and if Judgment Display is set to 'Color + Text', a floating checkmark appears at center screen."
>
> **Dev**: "And for highlights — what does 'upcoming column' mean?"
> **Domain expert**: "The next Column of Events that hasn't been judged yet. After the Playhead passes it, the next unjudged Column becomes the active highlight."
>
> **Dev**: "How does Tempo override work with highlights?"
> **Domain expert**: "The Score has an original Tempo map. The user can override BPM in settings, which speeds up or slows down playback. But Verovio's SVG positions are based on the original Tempo, so highlight timing uses the original map to stay aligned with the rendered notes."
