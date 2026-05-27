import type { EventRegistryEntry } from '../core/EventRegistry'
import type { TempoClock } from './TempoClock'

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export class AutoPlayer {
  private _ctx: AudioContext | null = null
  private _masterGain: GainNode | null = null
  private _ctxStart = 0
  private _scheduled = new Set<string>()
  private _lookahead = 0.2
  private _active = false
  private _volume = 0.3
  private _delaySec = 0

  get active(): boolean {
    return this._active
  }

  initAudio(): void {
    if (this._ctx && this._ctx.state !== 'closed') return
    this._ctx = new AudioContext()
    this._masterGain = this._ctx.createGain()
    this._masterGain.gain.value = this._volume
    this._masterGain.connect(this._ctx.destination)
  }

  setVolume(percent: number): void {
    this._volume = Math.max(1, Math.min(100, percent)) / 100
    if (this._masterGain) {
      this._masterGain.gain.value = this._volume
    }
  }

  setDelay(ms: number): void {
    this._delaySec = Math.max(-500, Math.min(500, ms)) / 1000
  }

  start(): void {
    if (!this._ctx || this._ctx.state === 'closed') return
    if (this._ctx.state === 'suspended') {
      this._ctx.resume()
    }
    this._ctxStart = this._ctx.currentTime
    this._scheduled.clear()
    this._active = true
  }

  scheduleTick(entries: readonly EventRegistryEntry[], clock: TempoClock, emptyBeats: number): void {
    if (!this._ctx || this._ctx.state !== 'running') return
    if (!this._active) return

    const audioNow = this._ctx.currentTime
    const lookaheadEnd = audioNow + this._lookahead
    const emptySec = clock.beatToTime(emptyBeats)

    for (const entry of entries) {
      const key = `${entry.measureIndex}:${entry.staffIndex}:${entry.noteIndex}`
      if (this._scheduled.has(key)) continue

      const noteTime = this._ctxStart + emptySec + entry.timeSec + this._delaySec
      if (noteTime > lookaheadEnd) break
      if (noteTime < audioNow - 0.1) continue

      this._scheduled.add(key)

      const durBeats = entry.event.duration
      const endSec = clock.beatToTime(entry.event.time + durBeats)
      const durSec = Math.min(endSec - entry.timeSec, 2.0)

      this._playTone(entry.event.pitch, noteTime, durSec)
    }
  }

  private _playTone(midi: number, when: number, durSec: number): void {
    if (!this._ctx || !this._masterGain) return

    const osc = this._ctx.createOscillator()
    const gain = this._ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = midiToFrequency(midi)
    const decayLen = Math.min(durSec * 0.5, 0.5)
    gain.gain.setValueAtTime(this._volume, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + decayLen)
    osc.connect(gain)
    gain.connect(this._masterGain)
    osc.start(when)
    osc.stop(when + durSec + 0.05)
  }

  stop(): void {
    this._active = false
    this._scheduled.clear()
  }

  reset(): void {
    this.stop()
    if (this._ctx && this._ctx.state !== 'closed') {
      this._ctx.close()
      this._ctx = null
      this._masterGain = null
    }
    this._ctxStart = 0
  }
}
