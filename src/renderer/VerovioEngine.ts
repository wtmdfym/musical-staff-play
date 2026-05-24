import createVerovioModule from 'verovio/wasm'
import { VerovioToolkit } from 'verovio/esm'

export interface TimemapElement {
  t: number
  qst: number
  x: number
  y: number
  id: string
}

export interface TimemapEntry {
  page: number
  elements: TimemapElement[]
}

export interface VerovioLayoutOptions {
  zoom: number
  pageWidth: number
  pageHeight: number
  staffSpacing: number
  noteSpacing: number
}

const PITCH_NAMES: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

function midiFromPnameOct(pname: string, oct: string): number | null {
  const semitone = PITCH_NAMES[pname]
  if (semitone === undefined) return null
  const octNum = parseInt(oct, 10)
  if (isNaN(octNum)) return null
  return (octNum + 1) * 12 + semitone
}

const MIDI_TO_PNAME: Record<number, string> = { 0: 'c', 1: 'c', 2: 'd', 3: 'd', 4: 'e', 5: 'f', 6: 'f', 7: 'g', 8: 'g', 9: 'a', 10: 'a', 11: 'b' }

function midiToPnameOct(pitch: number): { pname: string; oct: string } | null {
  if (pitch < 0 || pitch > 127) return null
  const semitone = pitch % 12
  const pname = MIDI_TO_PNAME[semitone]
  if (!pname) return null
  const oct = Math.floor(pitch / 12) - 1
  return { pname, oct: String(oct) }
}

export class VerovioRenderer {
  private _toolkit: VerovioToolkit | null = null
  private _readyPromise: Promise<void> | null = null
  private _documentLoaded = false
  private _pageCount = 0
  private _svgCache = new Map<number, string>()
  private _timemapCache: TimemapEntry[] | null = null
  private _eventIdMap: Map<string, string> | null = null

  get isReady(): boolean { return this._toolkit !== null }
  get hasDocument(): boolean { return this._documentLoaded }
  get pageCount(): number { return this._documentLoaded ? this._pageCount : 0 }
  get eventIdMap(): Map<string, string> | null { return this._eventIdMap }

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
    tk.setOptions({ svgAdditionalAttribute: ["note@pname", "note@oct"] })
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
      svgAdditionalAttribute: ["note@pname", "note@oct"],
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
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      this._timemapCache = (Array.isArray(obj.pages) ? obj.pages : Array.isArray(obj.elements) ? obj : []) as TimemapEntry[]
    } else {
      this._timemapCache = []
    }
    return this._timemapCache
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

  buildEventIdMap(flattenedEvents: { measureIndex: number; noteIndex: number; timeMs: number; pitch: number }[]): Map<string, string> {
    const tk = this._toolkit
    if (!tk) return new Map()

    const timemap = this.getTimemap()
    if (!timemap.length) return new Map()

    const allElements = timemap.filter(t => Array.isArray(t.elements)).flatMap(t => t.elements).sort((a, b) => a.t - b.t)
    const map = new Map<string, string>()
    let elemIdx = 0

    for (let i = 0; i < flattenedEvents.length; i++) {
      const timeGroup: typeof flattenedEvents = []
      let j = i
      while (j < flattenedEvents.length && Math.abs(flattenedEvents[j].timeMs - flattenedEvents[i].timeMs) < 5) {
        timeGroup.push(flattenedEvents[j])
        j++
      }

      const elemGroup: TimemapElement[] = []
      while (elemIdx < allElements.length && allElements[elemIdx].t < flattenedEvents[i].timeMs - 5) {
        elemIdx++
      }
      while (elemIdx < allElements.length && Math.abs(allElements[elemIdx].t - flattenedEvents[i].timeMs) < 5) {
        elemGroup.push(allElements[elemIdx])
        elemIdx++
      }

      if (timeGroup.length === 1 && elemGroup.length === 1) {
        map.set(`${timeGroup[0].measureIndex}:${timeGroup[0].noteIndex}`, elemGroup[0].id)
      } else if (timeGroup.length > 0 && elemGroup.length > 0) {
        timeGroup.sort((a, b) => a.pitch - b.pitch)

        const elemPitches: { id: string; pitch: number }[] = []
        for (const elem of elemGroup) {
          const attr = this.getElementAttr(elem.id)
          const midi = midiFromPnameOct(attr.pname, attr.oct)
          if (midi !== null) {
            elemPitches.push({ id: elem.id, pitch: midi })
          }
        }
        elemPitches.sort((a, b) => a.pitch - b.pitch)

        for (let k = 0; k < Math.min(timeGroup.length, elemPitches.length); k++) {
          map.set(`${timeGroup[k].measureIndex}:${timeGroup[k].noteIndex}`, elemPitches[k].id)
        }
      }

      i = j - 1
    }

    this._eventIdMap = map
    return map
  }

  private _clearCaches(): void {
    this._svgCache.clear()
    this._timemapCache = null
    this._eventIdMap = null
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
