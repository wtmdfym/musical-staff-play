import createVerovioModule from 'verovio/wasm'
import { VerovioToolkit } from 'verovio/esm'

export interface TimemapEntry {
  on?: string[]
  off?: string[]
  qstamp: number
  tempo?: number
  tstamp: number
}

export interface VerovioLayoutOptions {
  zoom: number
  pageWidth: number
  pageHeight: number
  staffSpacing: number
  noteSpacing: number
}

import { midiToPnameOct, midiFromPnameOct } from './pitchUtils'

export class VerovioRenderer {
  private _toolkit: VerovioToolkit | null = null
  private _readyPromise: Promise<void> | null = null
  private _documentLoaded = false
  private _pageCount = 0
  private _svgCache = new Map<number, string>()
  private _timemapCache: TimemapEntry[] | null = null

  get isReady(): boolean { return this._toolkit !== null }
  get hasDocument(): boolean { return this._documentLoaded }
  get pageCount(): number { return this._documentLoaded ? this._pageCount : 0 }

  init(): Promise<void> {
    if (this._readyPromise) return this._readyPromise
    this._readyPromise = (async () => {
      const VerovioModule = await createVerovioModule()
      this._toolkit = new VerovioToolkit(VerovioModule)
    })()
    return this._readyPromise
  }

  loadScore(data: string): boolean {
    const tk = this._toolkit
    if (!tk) return false
    tk.resetXmlIdSeed(0)
    const ok = tk.loadData(data)
    if (!ok) return false
    tk.setOptions({ svgAdditionalAttribute: ["note@pname", "note@oct", "note@staff", "note@voice"] })
    this._documentLoaded = true
    this._clearCaches()
    this._pageCount = tk.getPageCount()
    return true
  }

  applyLayout(opts: VerovioLayoutOptions): void {
    const tk = this._toolkit
    if (!tk) return
    tk.setOptions({
      scale: Math.round(40 * opts.zoom),
      pageWidth: opts.pageWidth,
      pageHeight: opts.pageHeight,
      spacingStaff: opts.staffSpacing,
      spacingLinear: opts.noteSpacing,
      svgAdditionalAttribute: ["note@pname", "note@oct", "note@staff", "note@voice"],
    })
    this._clearCaches()
    tk.redoLayout({ resetCache: true })
    this._pageCount = tk.getPageCount()
  }

  renderSVG(pageNo: number): string {
    const tk = this._toolkit
    if (!tk || !this._documentLoaded) return ''
    if (this._svgCache.has(pageNo)) return this._svgCache.get(pageNo)!
    const svg = tk.renderToSVG(pageNo, false)
    this._svgCache.set(pageNo, svg)
    return svg
  }

  renderAllSVGs(): string[] {
    if (!this._toolkit || !this._documentLoaded) return []
    const pages: string[] = []
    for (let i = 1; i <= this._pageCount; i++) {
      pages.push(this.renderSVG(i))
    }
    return pages
  }

  getTimemap(): TimemapEntry[] {
    const tk = this._toolkit
    if (!tk || !this._documentLoaded) return []
    if (this._timemapCache) return this._timemapCache

    const raw = tk.renderToTimemap({ includeRests: false }) as unknown
    if (Array.isArray(raw)) {
      this._timemapCache = raw as TimemapEntry[]
    } else {
      this._timemapCache = []
    }
    return this._timemapCache
  }

  buildNoteQstampMap(): Map<string, number> {
    const map = new Map<string, number>()
    for (const entry of this.getTimemap()) {
      if (entry.on) {
        for (const id of entry.on) {
          map.set(id, entry.qstamp)
        }
      }
    }
    return map
  }

  renderToMIDI(): string {
    if (!this._toolkit || !this._documentLoaded) return ''
    return this._toolkit.renderToMIDI()
  }

  getElementsAtTime(millisec: number): { notes?: string[]; rests?: string[] } {
    if (!this._toolkit || !this._documentLoaded) return {}
    return this._toolkit.getElementsAtTime(millisec)
  }

  findNoteIdAtTime(timeMs: number, pitch: number): string | undefined {
    const elements = this.getElementsAtTime(timeMs)
    const noteIds = elements.notes ?? []
    const expected = midiToPnameOct(pitch)
    for (const id of noteIds) {
      const attr = this.getElementAttr(id)
      const midi = midiFromPnameOct(attr.pname, attr.oct)
      if (midi === pitch) return id
    }
    if (expected) {
      for (const id of noteIds) {
        const attr = this.getElementAttr(id)
        if (attr.pname === expected.pname && attr.oct === expected.oct) return id
      }
    }
    return undefined
  }

  getElementAttr(xmlId: string): Record<string, string> {
    if (!this._toolkit) return {}
    return this._toolkit.getElementAttr(xmlId)
  }

  getTimesForElement(xmlId: string): Record<string, number> | null {
    const tk = this._toolkit
    if (!tk || !this._documentLoaded) return null
    return tk.getTimesForElement(xmlId) as Record<string, number> | null
  }

  private _clearCaches(): void {
    this._svgCache.clear()
    this._timemapCache = null
  }

  destroy(): void {
    if (this._toolkit) {
      this._toolkit.destroy()
      this._toolkit = null
    }
    this._documentLoaded = false
    this._pageCount = 0
    this._clearCaches()
    this._readyPromise = null
  }
}

let _instance: VerovioRenderer | null = null

export function getVerovioRenderer(): VerovioRenderer {
  if (!_instance) _instance = new VerovioRenderer()
  return _instance
}
