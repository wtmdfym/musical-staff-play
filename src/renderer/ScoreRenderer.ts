import type { GameLoop } from '../core/GameLoop'
import {
  getVerovioRenderer,
  type VerovioRenderer,
  type VerovioLayoutOptions,
} from './VerovioEngine'
import { VerovioScoreToSvgMapper } from './ScoreToSvgMapper'
import { BoxHighlightRenderer } from '../feedback/BoxHighlightRenderer'
import { JudgmentDisplay } from '../feedback/JudgmentDisplay'
import { getOverlayManager } from '../feedback/OverlayManager'
import { ViewportPositioner } from '../core/ViewportPositioner'
import type { DisplayMode, JudgmentGrade, JudgmentType, HighlightColumn } from '../score/ScoreTypes'

const KEY_TO_MIDI: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65,
  t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
}

export interface ScoreRendererConfig {
  displayMode: DisplayMode
  currentPage: number
  renderFps: number
  highlightLeadBeats: number
  highlightRange: number
  highlightPadX: number
  highlightPadY: number
}

export interface ScoreRendererCallbacks {
  onPageChange(page: number): void
  onTotalPagesChange(total: number): void
  onPageAdvanceRequested(direction: 'next' | 'prev'): void
}

export class ScoreRenderer {
  private _gl: GameLoop
  private _vrv: VerovioRenderer
  private _mapper = new VerovioScoreToSvgMapper()
  private _highlightRenderer = new BoxHighlightRenderer()
  private _jd = new JudgmentDisplay()
  private _om = getOverlayManager()
  private _viewportPositioner = new ViewportPositioner()

  private _container: HTMLDivElement | null = null
  private _rafId = 0
  private _lastRenderTime = 0
  private _renderTickCount = 0
  private _doRenderCount = 0
  private _highlightUpdateCount = 0
  private _pageAdvanceCount = 0
  private _keyDownHandler: ((e: KeyboardEvent) => void) | null = null

  private _displayMode: DisplayMode = 'page'
  private _currentPage = 0
  private _renderFps = 60
  private _highlightLeadBeats = 0.5
  private _highlightRange = 2
  private _highlightPadX = 60
  private _highlightPadY = 60
  private _vrvPageCount = 0
  private _rawDocument: string | null = null
  private _pageBoundaries: number[] = []

  private _callbacks: ScoreRendererCallbacks | null = null

  constructor(gl: GameLoop) {
    this._gl = gl
    this._vrv = getVerovioRenderer()
  }

  init(container: HTMLDivElement, callbacks: ScoreRendererCallbacks): void {
    this._container = container
    this._callbacks = callbacks
    this._om.bind({ current: container })
    this._viewportPositioner.bind({ svgWrap: { current: container } })
    this._attachKeyboard()
    this._scheduleRender()
  }

  destroy(): void {
    this._stopRenderLoop()
    this._detachKeyboard()
    this._viewportPositioner.unbind()
    this._om.unbind()
    this._jd.clear()
    this._highlightRenderer.clear()
    this._container = null
    this._callbacks = null
  }

  setConfig(config: Partial<ScoreRendererConfig>): void {
    let needsRender = false
    let needsReapply = false

    if (config.displayMode !== undefined && config.displayMode !== this._displayMode) {
      this._displayMode = config.displayMode
      needsRender = true
      needsReapply = true
    }
    if (config.currentPage !== undefined && config.currentPage !== this._currentPage) {
      this._currentPage = Math.max(0, Math.min(config.currentPage, this._vrvPageCount - 1))
      needsRender = true
      needsReapply = true
    }
    if (config.renderFps !== undefined) this._renderFps = config.renderFps
    if (config.highlightLeadBeats !== undefined) this._highlightLeadBeats = config.highlightLeadBeats
    if (config.highlightRange !== undefined) this._highlightRange = config.highlightRange
    if (config.highlightPadX !== undefined || config.highlightPadY !== undefined) {
      this._highlightPadX = config.highlightPadX ?? this._highlightPadX
      this._highlightPadY = config.highlightPadY ?? this._highlightPadY
      this._highlightRenderer.setPadding(this._highlightPadX, this._highlightPadY)
    }

    if (needsRender) this._renderSVG()
    if (needsReapply) this._reapplyAll()
  }

  async loadScore(rawDocument: string, layoutOpts?: VerovioLayoutOptions): Promise<void> {
    this._jd.clear()
    this._highlightRenderer.clear()
    this._rawDocument = rawDocument

    if (!this._vrv.isReady) {
      await this._vrv.init()
    }

    this._vrv.loadScore(rawDocument)
    if (layoutOpts) {
      this._vrv.applyLayout(layoutOpts)
    }
    this._vrvPageCount = this._vrv.pageCount

    if (this._currentPage >= this._vrvPageCount) {
      this._currentPage = Math.max(0, this._vrvPageCount - 1)
      this._callbacks?.onPageChange(this._currentPage)
    }
    this._callbacks?.onTotalPagesChange(this._vrvPageCount)

    this._buildMapper()
    this._renderSVG()
    this._highlightRenderer.rebuildTieInfo()
  }

  applyLayout(opts: VerovioLayoutOptions): void {
    if (!this._vrv.hasDocument || !this._rawDocument) return
    this._vrv.applyLayout(opts)
    this._vrvPageCount = this._vrv.pageCount

    if (this._currentPage >= this._vrvPageCount) {
      this._currentPage = Math.max(0, this._vrvPageCount - 1)
      this._callbacks?.onPageChange(this._currentPage)
    }
    this._callbacks?.onTotalPagesChange(this._vrvPageCount)

    this._buildMapper()
    this._renderSVG()
    this._highlightRenderer.rebuildTieInfo()
    this._reapplyAll()
  }

  showJudgment(eventKey: string, grade: JudgmentGrade, type: JudgmentType): void {
    const svgId = this._gl.eventRegistry.get(eventKey)?.svgId
    if (svgId) {
      this._jd.show(svgId, grade, type)
    }
  }

  clearHighlights(): void {
    this._highlightRenderer.clear()
  }

  resetScroll(): void {
    this._viewportPositioner.resetScroll()
  }

  scrollToPosition(scrollOffset: number): void {
    const emptyBeats = this._gl.totalWithEmpty - this._gl.totalBeats
    const displayBeat = scrollOffset - emptyBeats
    const nextPage = this._viewportPositioner.scrollToBeat(displayBeat, {
      displayMode: this._displayMode,
      displayBeat,
      totalBeats: this._gl.totalBeats,
      vrvPageCount: this._vrvPageCount,
      currentPage: this._currentPage,
      pageBoundaries: this._pageBoundaries,
    })
    if (nextPage !== undefined) {
      this._callbacks?.onPageChange(nextPage)
    }
  }

  // ── private ──

  private _buildMapper(): void {
    if (!this._rawDocument || !this._vrv.hasDocument) return
    const entries = this._gl.eventRegistry.all
    if (entries.length === 0) return

    const { map: svgIdMap, pageStartMeasures } = this._mapper.build(
      entries.map(e => ({
        measureIndex: e.measureIndex,
        staffIndex: e.staffIndex,
        noteIndex: e.noteIndex,
        time: e.event.time,
        pitch: e.event.pitch,
        voice: e.event.voice,
      })),
      this._vrv,
    )

    const measureBeats = this._gl.measureStartBeats
    this._pageBoundaries = pageStartMeasures.map(mi =>
      mi < measureBeats.length ? measureBeats[mi] : 0,
    )

    this._gl.eventRegistry.applySvgIds(svgIdMap)
  }

  private _renderSVG(): void {
    if (!this._container || !this._vrv.hasDocument) return

    if (this._displayMode === 'page') {
      const pageNo = Math.min(this._currentPage + 1, Math.max(1, this._vrvPageCount))
      const svg = this._vrv.renderSVG(pageNo)
      this._container.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${svg}</div>`
    } else {
      const svgs = this._vrv.renderAllSVGs()
      const html = svgs.map(s => `<div style="width:100%;flex-shrink:0">${s}</div>`).join('')
      this._container.innerHTML = `<div style="display:flex;flex-direction:column">${html}</div>`
    }
  }

  private _reapplyAll(): void {
    this._jd.applyToPage()
    this._highlightRenderer.rebuildTieInfo()
  }

  // ── render loop ──

  private _scheduleRender(): void {
    this._rafId = requestAnimationFrame(() => this._renderTick())
  }

  private _stopRenderLoop(): void {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId)
      this._rafId = 0
    }
  }

  private _renderTick(): void {
    this._renderTickCount++
    let shouldRender = true
    if (this._renderFps > 0) {
      const now = performance.now()
      if (now - this._lastRenderTime < 1000 / this._renderFps) {
        shouldRender = false
      }
    }

    if (shouldRender) {
      this._doRenderCount++
      this._lastRenderTime = performance.now()
      this._doRender()
    }

    this._scheduleRender()
  }

  private _doRender(): void {
    if (this._gl.state === 'playing') {
      const displayBeat = this._gl.displayBeat
      const totalBeats = this._gl.totalBeats

      const nextPage = this._viewportPositioner.tick({
        displayMode: this._displayMode,
        displayBeat,
        totalBeats,
        vrvPageCount: this._vrvPageCount,
        currentPage: this._currentPage,
        pageBoundaries: this._pageBoundaries,
      })

      if (nextPage !== undefined) {
        this._pageAdvanceCount++
        this._callbacks?.onPageChange(nextPage)
      }

      this._updateHighlights(displayBeat)
    }
  }

  private _updateHighlights(displayBeat: number): void {
    this._highlightUpdateCount++

    const columns = this._gl.eventRegistry.getUpcomingColumns(
      displayBeat,
      this._highlightLeadBeats,
      this._highlightRange,
    )

    const highlightCols: HighlightColumn[] = columns.map(col => ({
      notes: col.notes
        .map(n => {
          const svgId = this._gl.eventRegistry.get(n.eventKey)?.svgId ?? ''
          return { svgId, staffIndex: n.staffIndex, voice: n.voice }
        })
        .filter(n => n.svgId !== ''),
    })).filter(col => col.notes.length > 0)

    this._highlightRenderer.update(highlightCols)
  }

  // ── keyboard ──

  private _attachKeyboard(): void {
    if (this._keyDownHandler) return
    this._keyDownHandler = (e: KeyboardEvent) => {
      if (e.repeat) return

      if (this._displayMode === 'page' && this._gl.state !== 'playing') {
        if (e.key === 'ArrowRight') {
          this._callbacks?.onPageAdvanceRequested('next')
          e.preventDefault()
          return
        }
        if (e.key === 'ArrowLeft') {
          this._callbacks?.onPageAdvanceRequested('prev')
          e.preventDefault()
          return
        }
      }

      if (this._displayMode === 'page') return
      if (this._gl.state !== 'playing') return

      const midi = KEY_TO_MIDI[e.key.toLowerCase()]
      if (midi !== undefined) {
        this._gl.noteOn(midi, 64)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', this._keyDownHandler)
  }

  private _detachKeyboard(): void {
    if (this._keyDownHandler) {
      window.removeEventListener('keydown', this._keyDownHandler)
      this._keyDownHandler = null
    }
  }
}
