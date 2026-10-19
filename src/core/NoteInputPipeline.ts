import type { MidiInputManager } from '../playback/MidiInputManager'
import type { PlaybackDriver } from '../core/PlaybackDriver'
import type { JudgmentEngine } from '../playback/JudgmentEngine'
import type { AutoPlayer } from '../playback/AutoPlayer'
import type { DisplayMode } from '../score/ScoreTypes'

const KEY_TO_MIDI: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65,
  t: 66, g: 67, y: 68, h: 69, u: 70, j: 71,
}

export class NoteInputPipeline {
  private _midi: MidiInputManager
  private _playback: PlaybackDriver
  private _je: JudgmentEngine
  private _autoPlayer: AutoPlayer
  private _displayMode: DisplayMode = 'page'
  private _keyDownHandler: ((event: KeyboardEvent) => void) | null = null

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

  noteOn(pitch: number, velocity: number): void {
    if (this._autoPlayer.active) return
    const t = this._playback.elapsed
    this._je.onInputColumn([pitch], t, velocity)
  }

  noteOff(pitch: number): void {
    if (this._autoPlayer.active) return
    const t = this._playback.elapsed
    this._je.onNoteOff(pitch, t)
  }

  cc(controller: number, value: number): void {
    if (this._autoPlayer.active) return
    if (controller === 64) {
      const t = this._playback.elapsed
      const down = value >= 64
      this._je.setPedal(down, t)
    }
  }

  setDisplayMode(mode: DisplayMode): void {
    this._displayMode = mode
  }

  attachKeyboard(): void {
    if (this._keyDownHandler) return
    this._keyDownHandler = (event: KeyboardEvent) => {
      if (event.repeat || this._displayMode !== 'scroll') return
      if (this._playback.state !== 'playing') return

      const midi = KEY_TO_MIDI[event.key.toLowerCase()]
      if (midi === undefined) return

      this.noteOn(midi, 64)
      event.preventDefault?.()
    }
    window.addEventListener('keydown', this._keyDownHandler)
  }

  detachKeyboard(): void {
    if (!this._keyDownHandler) return
    window.removeEventListener('keydown', this._keyDownHandler)
    this._keyDownHandler = null
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
