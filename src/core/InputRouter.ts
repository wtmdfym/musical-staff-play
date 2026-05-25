import type { DisplayMode } from '../score/ScoreTypes'

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

export class InputRouter {
  private _onNoteInput: ((pitch: number) => void) | null = null
  private _onPageNav: ((direction: 'next' | 'prev') => void) | null = null
  private _displayMode: DisplayMode = 'page'
  private _isPlaying: () => boolean = () => false
  private _keyDownHandler: ((e: KeyboardEvent) => void) | null = null

  readonly midiNoteHandler: (pitch: number) => void = (pitch: number) => {
    if (this._isPlaying()) {
      this._onNoteInput?.(pitch)
    }
  }

  setDisplayMode(mode: DisplayMode): void {
    this._displayMode = mode
  }

  setIsPlaying(fn: () => boolean): void {
    this._isPlaying = fn
  }

  setOnNoteInput(cb: ((pitch: number) => void) | null): void {
    this._onNoteInput = cb
  }

  setOnPageNav(cb: ((direction: 'next' | 'prev') => void) | null): void {
    this._onPageNav = cb
  }

  attach(): void {
    if (this._keyDownHandler) return

    this._keyDownHandler = (e: KeyboardEvent) => {
      if (e.repeat) return

      if (this._displayMode === 'page') {
        if (!this._isPlaying()) {
          if (e.key === 'ArrowRight') {
            this._onPageNav?.('next')
            e.preventDefault()
          } else if (e.key === 'ArrowLeft') {
            this._onPageNav?.('prev')
            e.preventDefault()
          }
        }
        return
      }

      if (!this._isPlaying()) return

      const midi = KEY_TO_MIDI[e.key.toLowerCase()]
      if (midi !== undefined) {
        this._onNoteInput?.(midi)
      }
    }

    window.addEventListener('keydown', this._keyDownHandler)
  }

  detach(): void {
    if (this._keyDownHandler) {
      window.removeEventListener('keydown', this._keyDownHandler)
      this._keyDownHandler = null
    }
  }
}
