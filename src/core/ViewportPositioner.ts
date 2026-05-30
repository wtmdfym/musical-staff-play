import type { DisplayMode } from '../score/ScoreTypes'

export interface ViewportDomRefs {
  svgWrap: { current: HTMLDivElement | null }
}

export interface TickConfig {
  displayMode: DisplayMode
  displayBeat: number
  totalBeats: number
  totalWithEmpty: number
  vrvPageCount: number
  currentPage: number
}

const SCROLL_ANCHOR_RATIO = 0.25

export class ViewportPositioner {
  private _svgWrapRef: { current: HTMLDivElement | null } | null = null

  bind(refs: ViewportDomRefs): void {
    this._svgWrapRef = refs.svgWrap
  }

  unbind(): void {
    this._svgWrapRef = null
  }

  tick(config: TickConfig): number | undefined {
    const svgWrap = this._svgWrapRef?.current ?? null
    if (!svgWrap) return undefined

    const {
      displayMode,
      displayBeat,
      totalBeats,
      totalWithEmpty,
      vrvPageCount,
      currentPage,
    } = config

    const svgWrapHeight = svgWrap.offsetHeight
    const viewHeight = svgWrap.parentElement?.offsetHeight ?? svgWrapHeight

    if (displayMode === 'scroll') {
      const progress = Math.max(0, Math.min(1, displayBeat / totalBeats))
      const totalH = vrvPageCount * svgWrapHeight
      const anchorY = viewHeight * SCROLL_ANCHOR_RATIO
      const scrollY = progress * totalH - anchorY

      svgWrap.style.transform = `translateY(${-Math.max(0, scrollY)}px)`
      return undefined
    }

    const pc = vrvPageCount
    const beatsPerPage = totalWithEmpty / Math.max(1, pc)
    const pageStartBeat = currentPage * beatsPerPage
    if (displayBeat > pageStartBeat + beatsPerPage) {
      const candidate = currentPage + 1
      if (candidate < pc) {
        return candidate
      }
    }

    return undefined
  }

  resetScroll(): void {
    const svgWrap = this._svgWrapRef?.current
    if (svgWrap) {
      svgWrap.style.transform = ''
    }
  }
}
