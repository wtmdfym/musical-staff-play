import type { ScoreData, ScoreEvent } from '../score/ScoreTypes'
import { buildEventIndex } from '../score/ScoreEventIndex'
import type { TempoClock } from '../playback/TempoClock'
import type { HighlightColumn, HighlightColumnNote } from '../feedback/HighlightRenderer'

export interface EventRegistryEntry {
  event: ScoreEvent
  measureIndex: number
  staffIndex: number
  noteIndex: number
  timeSec: number
  svgId?: string
}

interface ColumnGroup {
  beat: number
  entryIndices: number[]
}

export class EventRegistry {
  private _entries: EventRegistryEntry[] = []
  private _entryMap = new Map<string, EventRegistryEntry>()
  private _judged = new Set<string>()
  private _columnGroups: ColumnGroup[] = []

  build(score: ScoreData, clock: TempoClock): void {
    const index = buildEventIndex(score)
    this._entries = index.map(pe => ({
      event: pe.event,
      measureIndex: pe.measureIndex,
      staffIndex: pe.staffIndex,
      noteIndex: pe.noteIndex,
      timeSec: clock.beatToTime(pe.event.time),
    }))
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

  markJudged(key: string): void {
    this._judged.add(key)
  }

  isJudged(key: string): boolean {
    return this._judged.has(key)
  }

  resetJudgments(): void {
    this._judged.clear()
  }

  get judgedCount(): number {
    return this._judged.size
  }

  getUpcomingColumns(fromBeat: number, leadBeats: number, maxColumns: number): HighlightColumn[] {
    const columns: HighlightColumn[] = []

    let startIdx = this._binarySearchColumn(fromBeat)
    if (startIdx < 0) startIdx = 0

    for (let ci = startIdx; ci < this._columnGroups.length; ci++) {
      const group = this._columnGroups[ci]
      if (group.beat > fromBeat + leadBeats) break

      if (!this._groupHasUnjudged(group)) continue

      const notes: HighlightColumnNote[] = []
      for (const ei of group.entryIndices) {
        const fe = this._entries[ei]
        if (fe.svgId) {
          notes.push({ svgId: fe.svgId, staffIndex: fe.staffIndex, voice: fe.event.voice })
        }
      }
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
