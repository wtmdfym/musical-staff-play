# Web Audio synthesis for AutoPlay

AutoPlay needs audible note output. We chose native Web Audio API oscillator synthesis over SoundFont sampling (`@higuma/sf2synth` + `.sf2` files) and over simple sine-wave beeps.

## Decision

Use **triangle-wave oscillators with look-ahead scheduling** (200ms window) as the audio backend for AutoPlay. Each note creates a dedicated `OscillatorNode` — no pooling needed because oscillators are lightweight and disposable.

## Why not sine wave?

Triangle wave has richer harmonics than pure sine, producing a more "instrument-like" timbre without the harshness of sawtooth. It bridges the gap between unrealistic sine beeps and the complexity of sampling.

## Why not SoundFont?

A SoundFont file adds 10–30MB of download cost and introduces a third-party dependency (`@higuma/sf2synth`). For a demo/watch mode, the audio quality of native oscillators is sufficient. If realistic piano timbre becomes a requirement later, the `AutoPlayer` module can be swapped without touching the scheduling logic.

## Why look-ahead scheduling?

The logic tick runs at configurable FPS (15–120 Hz, default 60). Scheduling oscillators directly on each tick would result in timing jitter equal to the tick interval (up to 66ms at 15 FPS). Look-ahead scheduling decouples audio precision from tick rate: every tick scans the next 200ms of events and schedules them at precise `AudioContext.currentTime` offsets. The browser's audio thread then fires them with sub-millisecond accuracy regardless of JS thread busyness.

## AudioContext lifecycle

The `AudioContext` is created lazily on the first user gesture that enables AutoPlay (the toggle checkbox click in ControlBar). This satisfies the browser autoplay policy. The context persists until the user navigates away. It is not closed on toggle-off to avoid recreating the audio graph unnecessarily.
