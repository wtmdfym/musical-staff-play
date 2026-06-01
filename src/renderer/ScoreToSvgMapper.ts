import type { VerovioRenderer } from './VerovioEngine'
import { midiToPnameOct, PITCH_NAMES } from './pitchUtils'
import { getNotesInLayer } from '../feedback/OverlayManager'

export interface MappableEvent {
  measureIndex: number
  staffIndex: number
  noteIndex: number
  time: number
  pitch: number
  voice: number
}

export interface ScoreToSvgMapperResult {
  map: Map<string, string>
  pageStartMeasures: number[]
}

export interface ScoreToSvgMapper {
  build(flatEvents: ReadonlyArray<MappableEvent>, vrv: VerovioRenderer): ScoreToSvgMapperResult
}

const fallbackResult: ScoreToSvgMapperResult = { map: new Map(), pageStartMeasures: [] }

export class VerovioScoreToSvgMapper implements ScoreToSvgMapper {
  build(flatEvents: ReadonlyArray<MappableEvent>, vrv: VerovioRenderer): ScoreToSvgMapperResult {
    const map = new Map<string, string>()
    if (flatEvents.length === 0) return fallbackResult

    const svgs = vrv.renderAllSVGs()
    if (!svgs.length) return fallbackResult

    const TIMING_TOLERANCE = 0.01

    const qstampMap = vrv.buildNoteQstampMap()

    const svgNotes: { id: string; time: number; pname: string; oct: string; staff: number; voice: number }[] = []
    const pageStartMeasures: number[] = []
    const parser = new DOMParser()
    let globalMeasureOffset = 0

    function hasClass(el: Element, cls: string): boolean {
      const cl = el.classList
      return cl ? cl.contains(cls) : false
    }

    for (let pageIdx = 0; pageIdx < svgs.length; pageIdx++) {
      const doc = parser.parseFromString(svgs[pageIdx], 'image/svg+xml')
      const measures = doc.querySelectorAll('.measure')
      pageStartMeasures.push(globalMeasureOffset)
      for (let mi = 0; mi < measures.length; mi++) {
        const measure = measures[mi]
        const staves: Element[] = []
        for (let ci = 0; ci < measure.children.length; ci++) {
          const child = measure.children[ci]
          if (hasClass(child, 'staff')) staves.push(child)
        }
        for (let si = 0; si < staves.length; si++) {
          const staff = staves[si]
          const layers: Element[] = []
          for (let ci = 0; ci < staff.children.length; ci++) {
            const child = staff.children[ci]
            if (hasClass(child, 'layer')) layers.push(child)
          }
          for (let li = 0; li < layers.length; li++) {
            const layer = layers[li]
            const notes = getNotesInLayer(layer, false)
            for (const noteEl of notes) {
              const id = noteEl.id
              if (!id) continue

              const attr = vrv.getElementAttr(id)
              const pname = attr.pname
              const oct = attr.oct
              if (!pname || !oct) continue
              if (PITCH_NAMES[pname] === undefined) continue

              const time = qstampMap.get(id)
              if (time === undefined) continue

              const staff = attr.staff ? parseInt(attr.staff, 10) - 1 : si
              const voice = attr.voice ? parseInt(attr.voice, 10) - 1 : (attr.layer ? parseInt(attr.layer, 10) - 1 : li)

              svgNotes.push({ id, time, pname, oct, staff, voice })
            }
          }
        }
      }
      globalMeasureOffset += measures.length
    }

    const intEvents = [...flatEvents].sort((a, b) => a.time - b.time)
    svgNotes.sort((a, b) => a.time - b.time)

    let intIdx = 0
    let svgIdx = 0

    while (intIdx < intEvents.length && svgIdx < svgNotes.length) {
      const intTime = intEvents[intIdx].time
      const svgTime = svgNotes[svgIdx].time

      if (Math.abs(intTime - svgTime) <= TIMING_TOLERANCE) {
        const windowTime = (intTime + svgTime) / 2

        const intGroup: MappableEvent[] = []
        while (intIdx < intEvents.length && Math.abs(intEvents[intIdx].time - windowTime) <= TIMING_TOLERANCE) {
          intGroup.push(intEvents[intIdx])
          intIdx++
        }

        const svgGroup: typeof svgNotes = []
        while (svgIdx < svgNotes.length && Math.abs(svgNotes[svgIdx].time - windowTime) <= TIMING_TOLERANCE) {
          svgGroup.push(svgNotes[svgIdx])
          svgIdx++
        }

        if (intGroup.length === 0 || svgGroup.length === 0) continue

        const intByS = new Map<string, MappableEvent[]>()
        for (const ie of intGroup) {
          const key = `${ie.staffIndex}`
          if (!intByS.has(key)) intByS.set(key, [])
          intByS.get(key)!.push(ie)
        }

        const svgByS = new Map<string, typeof svgNotes>()
        for (const sn of svgGroup) {
          const key = `${sn.staff}`
          if (!svgByS.has(key)) svgByS.set(key, [])
          svgByS.get(key)!.push(sn)
        }

        for (const [sKey, ieList] of intByS) {
          const snList = svgByS.get(sKey)
          if (!snList || snList.length === 0) continue

          ieList.sort((a, b) => {
            const aPno = midiToPnameOct(a.pitch)
            const bPno = midiToPnameOct(b.pitch)
            const aKey = aPno ? `${aPno.pname}:${aPno.oct}` : ''
            const bKey = bPno ? `${bPno.pname}:${bPno.oct}` : ''
            return aKey.localeCompare(bKey)
          })
          snList.sort((a, b) => {
            const aKey = `${a.pname}:${a.oct}`
            const bKey = `${b.pname}:${b.oct}`
            return aKey.localeCompare(bKey)
          })

          for (let k = 0; k < Math.min(ieList.length, snList.length); k++) {
            const fe = ieList[k]
            const key = `${fe.measureIndex}:${fe.staffIndex}:${fe.noteIndex}`
            if (map.has(key)) continue
            map.set(key, snList[k].id)
          }
        }
      } else if (intTime < svgTime) {
        intIdx++
      } else {
        svgIdx++
      }
    }

    for (const fe of flatEvents) {
      const key = `${fe.measureIndex}:${fe.staffIndex}:${fe.noteIndex}`
      if (!map.has(key)) {
        console.warn(`[FlatEvent] unmatched: measure=${fe.measureIndex} staff=${fe.staffIndex} note=${fe.noteIndex} pitch=${fe.pitch} time=${fe.time}`)
      }
    }

    return { map, pageStartMeasures }
  }
}
