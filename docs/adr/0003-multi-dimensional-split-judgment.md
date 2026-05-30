# Multi-dimensional split judgment model

We chose a **split judgment model** where each user action (key press, key release, pedal toggle) produces independent JudgmentResults per applicable dimension (noteOn, noteOff, velocity, pedal), rather than combining all dimensions into a single composite Grade per note.

## Why split

Piano performance involves four independent skillsets: hitting the right key at the right time, holding it for the right duration, controlling velocity, and managing the pedal. A composite grade conflates these dimensions — a student with perfect timing but poor dynamics would get "good" and not know which dimension to improve.

Independent per-dimension grades give the user actionable feedback. They see "my timing is perfect but my durations are miss" and know exactly what to work on.

## Why not composite

A single composite grade per note would require weighting the four dimensions — how much does velocity matter vs timing? Every user and every teacher would have a different preference. A multi-dimensional model defers that weighting to the UI (Stats panel shows raw counts per dimension) rather than baking it into the judgment engine.

## Combo behavior

Only noteOn misses break the Combo. noteOff, velocity, and pedal are "quality" dimensions — they provide feedback but don't interrupt the correctness streak. A student should be able to maintain combo while improving expression.

## Extensibility

Each Judgment Type has its own timing windows and deviation thresholds, configurable independently. Adding a new dimension (e.g., polyphonic accuracy in the future) does not require restructuring existing types.

## Consequences

- A single MIDI Note On event produces two JudgmentResults (noteOn + velocity). A single MIDI Note Off produces one (noteOff). A CC 64 change produces one (pedal).
- The Stats data model expands from a flat `{perfect, great, good, miss}` to `{noteOn, noteOff, velocity, pedal}` each with their own sub-counts.
- The Feedback system uses different CSS properties per Judgment Type to avoid visual collisions on the same SVG note element: noteOn → `fill`, noteOff → `stroke`, velocity → overlay marker.
