import type { DisplayMode } from '../score/ScoreTypes'
import type { MidiInputManager } from '../playback/MidiInputManager'
import type { PlaybackDriver } from './PlaybackDriver'
import type { JudgmentEngine } from '../playback/JudgmentEngine'
import type { AutoPlayer } from '../playback/AutoPlayer'

const KEY_TO_MIDI: Record<string, number> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
}

export class NoteInputPipeline {
  private _midi: MidiInputManager
  private _playback: PlaybackDriver
  private _je: JudgmentEngine
  private _autoPlayer: AutoPlayer
  private _keyDownHandler: ((e: KeyboardEvent) => void) | null = null
  private _displayMode: DisplayMode = 'page'
  private _seq = 0

  constructor(
    midi: MidiInputManager,
    playback: PlaybackDriver,
    je: JudgmentEngine,
    autoPlayer: AutoPlayer,
  ) {
    this._midi = midi
    this._playback = playback
    this._je = je
    this._autoPlayer = autoPlayer
  }

  setDisplayMode(mode: DisplayMode): void {
    this._displayMode = mode
  }

  noteOn(pitch: number, velocity: number): void {
    if (this._autoPlayer.active) {
      console.log(`[DEBUG-input] #${++this._seq} drop noteOn pitch=${pitch} vel=${velocity} reason=autoPlay`)
      return
    }
    const t = this._playback.elapsed
    console.log(`[DEBUG-input] #${++this._seq} noteOn  pitch=${pitch} vel=${velocity} t=${t.toFixed(3)}`)
    this._je.onInputColumn([pitch], t, velocity)
  }

  noteOff(pitch: number): void {
    if (this._autoPlayer.active) {
      console.log(`[DEBUG-input] #${++this._seq} drop noteOff pitch=${pitch} reason=autoPlay`)
      return
    }
    const t = this._playback.elapsed
    console.log(`[DEBUG-input] #${++this._seq} noteOff pitch=${pitch} t=${t.toFixed(3)}`)
    this._je.onNoteOff(pitch, t)
  }

  cc(controller: number, value: number): void {
    if (this._autoPlayer.active) {
      console.log(`[DEBUG-input] #${++this._seq} drop cc ctrl=${controller} val=${value} reason=autoPlay`)
      return
    }
    if (controller === 64) {
      const t = this._playback.elapsed
      const down = value >= 64
      console.log(`[DEBUG-input] #${++this._seq} cc     pedal=${down ? 'down' : 'up'} t=${t.toFixed(3)}`)
      this._je.setPedal(down, t)
    }
  }

  attachKeyboard(): void {
    if (this._keyDownHandler) return
    this._keyDownHandler = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (this._displayMode === 'page') return
      if (this._playback.state !== 'playing') return
      const midi = KEY_TO_MIDI[e.key.toLowerCase()]
      if (midi !== undefined) {
        console.log(`[DEBUG-input] #${++this._seq} key    key=${e.key} → MIDI${midi} t=${this._playback.elapsed.toFixed(3)}`)
        this.noteOn(midi, 64)
      }
    }
    window.addEventListener('keydown', this._keyDownHandler)
  }

  detachKeyboard(): void {
    if (this._keyDownHandler) {
      window.removeEventListener('keydown', this._keyDownHandler)
      this._keyDownHandler = null
    }
  }

  syncMidi(enabled: boolean, deviceId: string): void {
    if (this._autoPlayer.active) return
    if (this._playback.state !== 'playing' || !enabled) return
    this._midi.onNoteOn = (p, v) => { this.noteOn(p, v) }
    this._midi.onNoteOff = (p) => { this.noteOff(p) }
    this._midi.onControlChange = (c, v) => { this.cc(c, v) }
    this._midi.open(deviceId || undefined)
  }

  closeMidi(): void {
    this._midi.close()
  }
}
