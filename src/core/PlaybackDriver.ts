import type { PlayState } from '../score/ScoreTypes'
import type { TempoClock } from '../playback/TempoClock'

export class PlaybackDriver {
  private _state: PlayState = 'stopped'
  private _startTime = 0
  private _frozenElapsed = 0

  get state(): PlayState {
    return this._state
  }

  get elapsed(): number {
    if (this._state === 'stopped') return 0
    if (this._state === 'paused') return this._frozenElapsed
    return (performance.now() / 1000 - this._startTime) + this._frozenElapsed
  }

  play(): boolean {
    if (this._state === 'playing') return false
    this._startTime = performance.now() / 1000
    this._state = 'playing'
    return true
  }

  pause(): boolean {
    if (this._state !== 'playing') return false
    this._frozenElapsed = (performance.now() / 1000 - this._startTime) + this._frozenElapsed
    this._state = 'paused'
    return true
  }

  stop(): boolean {
    if (this._state === 'stopped') return false
    this._state = 'stopped'
    this._frozenElapsed = 0
    this._startTime = 0
    return true
  }

  seekToBeat(beat: number, clock: TempoClock): void {
    this._frozenElapsed = clock.beatToTime(beat)
    if (this._state === 'playing') {
      this._startTime = performance.now() / 1000
    }
  }
}
