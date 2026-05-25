import type { DisplayMode } from '../score/ScoreTypes'

export interface ViewportDomRefs {
  svgWrap: { current: HTMLDivElement | null }
  playhead: { current: HTMLDivElement | null }
}

export interface TickConfig {
  displayMode: DisplayMode
  displayBeat: number
  totalBeats: number
  totalWithEmpty: number
  playheadRatio: number
  vrvPageCount: number
  currentPage: number
}

export class ViewportPositioner {
  private _svgWrapRef: { current: HTMLDivElement | null } | null = null
  private _playheadRef: { current: HTMLDivElement | null } | null = null

  bind(refs: ViewportDomRefs): void {
    this._svgWrapRef = refs.svgWrap
    this._playheadRef = refs.playhead
  }

  unbind(): void {
    this._svgWrapRef = null
    this._playheadRef = null
  }

  tick(config: TickConfig): number | undefined {
    const svgWrap = this._svgWrapRef?.current ?? null
    const playhead = this._playheadRef?.current ?? null
    if (!svgWrap || !playhead) return undefined

    const {
      displayMode,
      displayBeat,
      totalBeats,
      totalWithEmpty,
      playheadRatio,
      vrvPageCount,
      currentPage,
    } = config

    const svgWrapHeight = svgWrap.offsetHeight
    const viewHeight = svgWrap.parentElement?.offsetHeight ?? svgWrapHeight
    const svgWrapWidth = svgWrap.offsetWidth

    if (displayMode === 'scroll') {
      const progress = Math.max(0, Math.min(1, displayBeat / totalBeats))
      const totalH = vrvPageCount * svgWrapHeight
      const playheadScreenY = viewHeight * playheadRatio
      const scrollY = progress * totalH - playheadScreenY

      svgWrap.style.transform = `translateY(${-Math.max(0, scrollY)}px)`
      playhead.style.display = 'block'
      playhead.style.top = `${playheadScreenY}px`
      playhead.style.left = '0'
      playhead.style.width = '100%'
      playhead.style.height = '2px'
      return undefined
    }

    const pc = vrvPageCount
    const beatsPerPage = totalWithEmpty / Math.max(1, pc)
    const pageStartBeat = currentPage * beatsPerPage
    const pageProgress = (displayBeat - pageStartBeat) / beatsPerPage
    const playheadPageLeft = Math.max(0, Math.min(svgWrapWidth, pageProgress * svgWrapWidth))

    playhead.style.display = 'block'
    playhead.style.top = '0'
    playhead.style.height = '100%'
    playhead.style.width = '2px'
    playhead.style.left = `${playheadPageLeft}px`

    if (displayBeat > pageStartBeat + beatsPerPage) {
      const candidate = currentPage + 1
      if (candidate < pc) {
        return candidate
      }
    }

    return undefined
  }

  hidePlayhead(): void {
    const playhead = this._playheadRef?.current
    if (playhead) {
      playhead.style.display = 'none'
    }
  }

  resetScroll(): void {
    const svgWrap = this._svgWrapRef?.current
    if (svgWrap) {
      svgWrap.style.transform = ''
    }
  }
}
