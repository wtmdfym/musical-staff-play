import type { ScoreData, ScoreEvent, JudgmentType } from '../score/ScoreTypes'
import { buildEventIndex } from '../score/ScoreEventIndex'
import type { TempoClock } from '../playback/TempoClock'
import type { ScoreColumn, ScoreColumnNote } from '../score/ScoreTypes'

export interface EventRegistryEntry {
  event: ScoreEvent
  measureIndex: number
  staffIndex: number
  noteIndex: number
  timeSec: number
  durationSec: number
  svgId?: string
}

interface ColumnGroup {
  beat: number
  entryIndices: number[]
}

export class EventRegistry {
  private _entries: EventRegistryEntry[] = []
  private _entryMap = new Map<string, EventRegistryEntry>()
  private _judged = new Map<string, Set<JudgmentType>>()

  private _judgedKey(key: string): Set<JudgmentType> {
    let s = this._judged.get(key)
    if (!s) {
      s = new Set()
      this._judged.set(key, s)
    }
    return s
  }
  private _columnGroups: ColumnGroup[] = []

  build(score: ScoreData, clock: TempoClock): void {
    const index = buildEventIndex(score)
    this._entries = index.map(pe => {
      const timeSec = clock.beatToTime(pe.event.time)
      const releaseSec = clock.beatToTime(pe.event.time + pe.event.duration)
      return {
        event: pe.event,
        measureIndex: pe.measureIndex,
        staffIndex: pe.staffIndex,
        noteIndex: pe.noteIndex,
        timeSec,
        durationSec: releaseSec - timeSec,
      }
    })
    this._entries.sort((a, b) => a.timeSec - b.timeSec)
    this._entryMap.clear()
    for (const e of this._entries) {
      this._entryMap.set(`${e.measureIndex}:${e.staffIndex}:${e.noteIndex}`, e)
    }
    this._judged.clear()
    this._buildColumnGroups()
  }

  applySvgIds(svgIdMap: Map<string, string>): void {
    for (const [key, svgId] of svgIdMap) {
      const e = this._entryMap.get(key)
      if (e) e.svgId = svgId
    }
  }

  updateTimes(clock: TempoClock): void {
    for (const e of this._entries) {
      e.timeSec = clock.beatToTime(e.event.time)
      const releaseSec = clock.beatToTime(e.event.time + e.event.duration)
      e.durationSec = releaseSec - e.timeSec
    }
    this._entries.sort((a, b) => a.timeSec - b.timeSec)
    this._buildColumnGroups()
  }

  get all(): readonly EventRegistryEntry[] {
    return this._entries
  }

  get(key: string): EventRegistryEntry | undefined {
    return this._entryMap.get(key)
  }

  get count(): number {
    return this._entries.length
  }

  markJudged(key: string, jtype?: JudgmentType): void {
    if (!jtype) {
      const s = this._judgedKey(key)
      s.add('noteOn').add('noteOff').add('velocity')
    } else {
      this._judgedKey(key).add(jtype)
    }
  }

  isJudged(key: string, jtype?: JudgmentType): boolean {
    if (!this._judged.has(key)) return false
    if (!jtype) return this._judged.get(key)!.size > 0
    return this._judged.get(key)!.has(jtype)
  }

  reset(): void {
    this._judged.clear()
  }

  get judgedCount(): number {
    return this._judged.size
  }

  getUpcomingColumns(fromBeat: number, leadBeats: number, maxColumns: number): ScoreColumn[] {
    const columns: ScoreColumn[] = []

    let startIdx = this._binarySearchColumn(fromBeat)
    if (startIdx < 0) startIdx = 0

    for (let ci = startIdx; ci < this._columnGroups.length; ci++) {
      const group = this._columnGroups[ci]
      if (group.beat > fromBeat + leadBeats) break

      if (!this._groupHasUnjudged(group)) continue

      const notes: ScoreColumnNote[] = []
      for (const ei of group.entryIndices) {
        const fe = this._entries[ei]
        const key = `${fe.measureIndex}:${fe.staffIndex}:${fe.noteIndex}`
        notes.push({ eventKey: key, staffIndex: fe.staffIndex, voice: fe.event.voice })
      }
      if (notes.length === 0) continue
      columns.push({ notes })
      if (columns.length > maxColumns) break
    }

    return columns
  }

  private _buildColumnGroups(): void {
    this._columnGroups = []
    if (this._entries.length === 0) return

    const sorted = [...this._entries]
      .map((e, i) => ({ beat: e.event.time, index: i }))
      .sort((a, b) => a.beat - b.beat)

    let groupBeat = sorted[0].beat
    let indices: number[] = []

    for (const item of sorted) {
      if (Math.abs(item.beat - groupBeat) > 0.001) {
        this._columnGroups.push({ beat: groupBeat, entryIndices: indices })
        groupBeat = item.beat
        indices = []
      }
      indices.push(item.index)
    }
    if (indices.length > 0) {
      this._columnGroups.push({ beat: groupBeat, entryIndices: indices })
    }
  }

  private _binarySearchColumn(fromBeat: number): number {
    let lo = 0
    let hi = this._columnGroups.length - 1
    let result = -1
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (this._columnGroups[mid].beat >= fromBeat) {
        result = mid
        hi = mid - 1
      } else {
        lo = mid + 1
      }
    }
    if (result > 0 && fromBeat - this._columnGroups[result - 1].beat < 0.1) {
      result--
    }
    return result
  }

  private _groupHasUnjudged(group: ColumnGroup): boolean {
    for (const ei of group.entryIndices) {
      const e = this._entries[ei]
      const key = `${e.measureIndex}:${e.staffIndex}:${e.noteIndex}`
      if (!this._judged.has(key)) return true
    }
    return false
  }
}
