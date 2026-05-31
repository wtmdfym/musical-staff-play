import type { MidiInputManager } from '../playback/MidiInputManager'
import type { PlaybackDriver } from '../core/PlaybackDriver'
import type { JudgmentEngine } from '../playback/JudgmentEngine'
import type { AutoPlayer } from '../playback/AutoPlayer'

export class NoteInputPipeline {
  private _midi: MidiInputManager
  private _playback: PlaybackDriver
  private _je: JudgmentEngine
  private _autoPlayer: AutoPlayer
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
