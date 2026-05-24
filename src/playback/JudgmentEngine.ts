import type { ScoreData, ScoreEvent } from '../score/ScoreTypes'
import type { JudgmentGrade, JudgmentResult } from '../score/ScoreTypes'
import { TempoClock } from './TempoClock'

const PERFECT_WINDOW = 0.04
const GREAT_WINDOW = 0.08
const GOOD_WINDOW = 0.12
const MISS_WINDOW = 0.2

interface IndexedEvent {
  event: ScoreEvent
  id: number
  timeSec: number
  noteIndex: number
}

export class JudgmentEngine {
  private _score: ScoreData | null = null
  private _clock: TempoClock = new TempoClock()
  private _judged: Set<number> = new Set()
  private _onJudgment: ((result: JudgmentResult) => void) | null = null
  private _eventIdCounter = 0
  private _eventIdMap: WeakMap<ScoreEvent, number> = new WeakMap()
  private _indexedEvents: IndexedEvent[] = []

  set score(s: ScoreData | null) {
    this._score = s
    this.reset()
  }

  setClock(clock: TempoClock) {
    this._clock = clock
    this.buildIndex()
  }

  set onJudgment(cb: ((result: JudgmentResult) => void) | null) {
    this._onJudgment = cb
  }

  private getEventId(evt: ScoreEvent): number {
    let id = this._eventIdMap.get(evt)
    if (id === undefined) {
      id = this._eventIdCounter++
      this._eventIdMap.set(evt, id)
    }
    return id
  }

  private buildIndex(): void {
    const score = this._score
    if (!score) {
      this._indexedEvents = []
      return
    }
    const clock = this._clock
    const events: IndexedEvent[] = []
    for (const measure of score.measures) {
      for (let ni = 0; ni < measure.events.length; ni++) {
        const event = measure.events[ni]
        if (event.isRest) continue
        const id = this.getEventId(event)
        events.push({
          event,
          id,
          timeSec: clock.beatToTime(event.time),
          noteIndex: ni,
        })
      }
    }
    events.sort((a, b) => a.timeSec - b.timeSec)
    this._indexedEvents = events
  }

  /** Single-pitch judgment (legacy) */
  onInput(pitch: number, currentTime: number): JudgmentResult | null {
    if (this._indexedEvents.length === 0) return null

    let best: { event: ScoreEvent; timingDelta: number } | null = null

    for (const ie of this._indexedEvents) {
      if (this._judged.has(ie.id)) continue

      const delta = Math.abs(currentTime - ie.timeSec)

      if (delta <= GOOD_WINDOW) {
        if (!best || delta < best.timingDelta) {
          best = { event: ie.event, timingDelta: delta }
        }
      } else if (ie.timeSec - currentTime > GOOD_WINDOW) {
        break
      }
    }

    if (!best) return null

    this._judged.add(this.getEventId(best.event))

    const bestNI = this._indexedEvents.find(ie => ie.event === best.event)?.noteIndex ?? -1
    const grade = this.computeGrade(pitch, best.event.pitch, best.timingDelta)
    const result: JudgmentResult = {
      grade,
      pitch,
      expectedPitch: best.event.pitch,
      timingDelta: best.timingDelta,
      beat: best.event.time,
      measureIndex: best.event.measureIndex,
      noteIndex: bestNI,
    }

    this._onJudgment?.(result)
    return result
  }

  /** Column-based judgment: matches against multiple expected pitches */
  onInputColumn(pitches: number[], currentTime: number): JudgmentResult[] {
    if (this._indexedEvents.length === 0) return []

    const results: JudgmentResult[] = []

    for (const pitch of pitches) {
      let best: { event: ScoreEvent; timingDelta: number } | null = null

      for (const ie of this._indexedEvents) {
        if (this._judged.has(ie.id)) continue

        const delta = Math.abs(currentTime - ie.timeSec)

        if (delta <= GOOD_WINDOW) {
          if (!best || delta < best.timingDelta) {
            best = { event: ie.event, timingDelta: delta }
          }
        } else if (ie.timeSec - currentTime > GOOD_WINDOW) {
          break
        }
      }

      if (!best) continue

      this._judged.add(this.getEventId(best.event))

      const bestNI = this._indexedEvents.find(ie => ie.event === best.event)?.noteIndex ?? -1
      const grade = this.computeGrade(pitch, best.event.pitch, best.timingDelta)
      results.push({
        grade,
        pitch,
        expectedPitch: best.event.pitch,
        timingDelta: best.timingDelta,
        beat: best.event.time,
        measureIndex: best.event.measureIndex,
        noteIndex: bestNI,
      })
    }

    for (const r of results) {
      this._onJudgment?.(r)
    }
    return results
  }

  checkMissed(currentTime: number): void {
    if (this._indexedEvents.length === 0) return

    for (const ie of this._indexedEvents) {
      if (this._judged.has(ie.id)) continue

      if (currentTime > ie.timeSec + MISS_WINDOW) {
        this._judged.add(ie.id)
        const result: JudgmentResult = {
          grade: 'miss',
          pitch: -1,
          expectedPitch: ie.event.pitch,
          timingDelta: currentTime - ie.timeSec,
          beat: ie.event.time,
          measureIndex: ie.event.measureIndex,
          noteIndex: ie.noteIndex,
        }
        this._onJudgment?.(result)
      }
    }
  }

  private computeGrade(played: number, expected: number, delta: number): JudgmentGrade {
    if (played !== expected) return 'miss'
    if (delta <= PERFECT_WINDOW) return 'perfect'
    if (delta <= GREAT_WINDOW) return 'great'
    if (delta <= GOOD_WINDOW) return 'good'
    return 'miss'
  }

  reset(): void {
    this._judged.clear()
    this._eventIdCounter = 0
    this._eventIdMap = new WeakMap()
    this.buildIndex()
  }
}
