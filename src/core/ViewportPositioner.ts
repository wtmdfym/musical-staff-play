import type { DisplayMode } from '../score/ScoreTypes'

export interface ViewportDomRefs {
  svgWrap: { current: HTMLDivElement | null }
}

export interface TickConfig {
  displayMode: DisplayMode
  displayBeat: number
  totalBeats: number
  vrvPageCount: number
  currentPage: number
  pageBoundaries: number[]
}

const SCROLL_ANCHOR_RATIO = 0.25

function findPage(beat: number, boundaries: readonly number[]): number {
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (beat >= boundaries[i]) return i
  }
  return 0
}

export class ViewportPositioner {
  private _svgWrapRef: { current: HTMLDivElement | null } | null = null

  bind(refs: ViewportDomRefs): void {
    this._svgWrapRef = refs.svgWrap
  }

  unbind(): void {
    this._svgWrapRef = null
  }

  tick(config: TickConfig): number | undefined {
    return this._applyPosition(config)
  }

  scrollToBeat(beat: number, config: TickConfig): number | undefined {
    return this._applyPosition({ ...config, displayBeat: beat })
  }

  private _applyPosition(config: TickConfig): number | undefined {
    const svgWrap = this._svgWrapRef?.current ?? null
    if (!svgWrap) return undefined

    const {
      displayMode,
      displayBeat,
      totalBeats,
      vrvPageCount,
      currentPage,
      pageBoundaries,
    } = config

    const svgWrapHeight = svgWrap.offsetHeight
    const viewHeight = svgWrap.parentElement?.offsetHeight ?? svgWrapHeight

    if (displayMode === 'scroll') {
      const safeTotal = totalBeats > 0 ? totalBeats : 1
      const progress = Math.max(0, Math.min(1, displayBeat / safeTotal))
      const totalH = vrvPageCount * svgWrapHeight
      const anchorY = viewHeight * SCROLL_ANCHOR_RATIO
      const scrollY = progress * totalH - anchorY

      svgWrap.style.transform = `translateY(${-Math.max(0, scrollY)}px)`
      return undefined
    }

    if (pageBoundaries.length > 0 && vrvPageCount > 0) {
      const targetPage = findPage(Math.max(0, displayBeat), pageBoundaries)
      if (targetPage !== currentPage && targetPage < vrvPageCount) {
        return targetPage
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
