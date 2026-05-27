import type { JudgmentGrade, JudgmentResult, JudgmentType, Dynamics, PedalEvent } from '../score/ScoreTypes'
import type { EventRegistryEntry } from '../core/EventRegistry'

export interface JudgmentRegistry {
  readonly all: readonly EventRegistryEntry[]
  isJudged(key: string, jtype?: JudgmentType): boolean
  markJudged(key: string, jtype?: JudgmentType): void
  reset(): void
}

const PERFECT_WINDOW = 0.04
const GREAT_WINDOW = 0.08
const GOOD_WINDOW = 0.12
const MISS_WINDOW = 0.2
const NOTE_OFF_MISS_WINDOW = 0.5

const VELOCITY_PERFECT = 16
const VELOCITY_GREAT = 32
const VELOCITY_GOOD = 48

const VELOCITY_RANGES: Record<Dynamics, [number, number]> = {
  pp: [0, 31],
  p: [32, 47],
  mp: [48, 63],
  mf: [64, 79],
  f: [80, 95],
  ff: [96, 127],
}

function dynamicsMidpoint(d: Dynamics): number {
  const [lo, hi] = VELOCITY_RANGES[d]
  return (lo + hi) / 2
}

export class JudgmentEngine {
  private _registry: JudgmentRegistry | null = null
  private _onJudgment: ((result: JudgmentResult) => void) | null = null

  private _activeNotes = new Map<number, string>()
  private _noteOnTimes = new Map<string, number>()
  private _pedalHeld = new Set<string>()
  private _pedalDown = false
  private _timeOffset = 0

  private _pedalEvents: Array<PedalEvent & { timeSec: number }> = []
  private _pedalEventIndex = 0

  private _toNotesTime(elapsed: number): number {
    return elapsed - this._timeOffset
  }

  setRegistry(registry: JudgmentRegistry | null): void {
    this._registry = registry
  }

  set onJudgment(cb: ((result: JudgmentResult) => void) | null) {
    this._onJudgment = cb
  }

  setPedalEvents(events: PedalEvent[], timeSecFn: (beat: number) => number): void {
    this._pedalEvents = events.map(e => ({ ...e, timeSec: timeSecFn(e.beat) }))
    this._pedalEventIndex = 0
  }

  onInputColumn(pitches: number[], currentTime: number, velocity?: number): JudgmentResult[] {
    const registry = this._registry
    if (!registry || registry.all.length === 0) return []

    const t = this._toNotesTime(currentTime)
    const results: JudgmentResult[] = []

    for (const pitch of pitches) {
      let best: { entry: EventRegistryEntry; timingDelta: number } | null = null

      for (const entry of registry.all) {
        const key = `${entry.measureIndex}:${entry.staffIndex}:${entry.noteIndex}`
        if (registry.isJudged(key, 'noteOn')) continue

        const delta = Math.abs(t - entry.timeSec)

        if (delta <= GOOD_WINDOW) {
          if (!best || delta < best.timingDelta) {
            best = { entry, timingDelta: delta }
          }
        } else if (entry.timeSec - t > GOOD_WINDOW) {
          break
        }
      }

      if (!best) continue

      const key = `${best.entry.measureIndex}:${best.entry.staffIndex}:${best.entry.noteIndex}`
      registry.markJudged(key, 'noteOn')

      const grade = this.computeGrade(pitch, best.entry.event.pitch, best.timingDelta)
      results.push({
        type: 'noteOn',
        grade,
        pitch,
        expectedPitch: best.entry.event.pitch,
        timingDelta: best.timingDelta,
        beat: best.entry.event.time,
        measureIndex: best.entry.measureIndex,
        noteIndex: best.entry.noteIndex,
        staffIndex: best.entry.staffIndex,
      })

      this._activeNotes.set(pitch, key)
      this._noteOnTimes.set(key, t)

      if (velocity !== undefined && pitch === best.entry.event.pitch) {
        const dynamics = best.entry.event.dynamics
        const midpoint = dynamicsMidpoint(dynamics)
        const velDelta = Math.abs(velocity - midpoint)
        const velGrade = this.computeVelocityGrade(velDelta)
        registry.markJudged(key, 'velocity')
        results.push({
          type: 'velocity',
          grade: velGrade,
          pitch,
          expectedPitch: best.entry.event.pitch,
          timingDelta: velDelta,
          expectedValue: midpoint,
          beat: best.entry.event.time,
          measureIndex: best.entry.measureIndex,
          noteIndex: best.entry.noteIndex,
          staffIndex: best.entry.staffIndex,
        })
      }
    }

    for (const r of results) {
      this._onJudgment?.(r)
    }
    return results
  }

  onNoteOff(pitch: number, currentTime: number): void {
    const registry = this._registry
    if (!registry || registry.all.length === 0) return

    const key = this._activeNotes.get(pitch)
    if (!key) return

    if (this._pedalDown) {
      this._pedalHeld.add(key)
      this._activeNotes.delete(pitch)
      return
    }

    const t = this._toNotesTime(currentTime)
    this._doNoteOff(key, t)
    this._activeNotes.delete(pitch)
  }

  setPedal(down: boolean, currentTime: number): void {
    const t = this._toNotesTime(currentTime)
    const prev = this._pedalDown
    this._pedalDown = down

    if (prev && !down) {
      for (const key of this._pedalHeld) {
        this._doNoteOff(key, t)
      }
      this._pedalHeld.clear()
    }

    this._checkPedalEvent(down, t)
  }

  private _doNoteOff(key: string, currentTime: number): void {
    const registry = this._registry
    if (!registry) return

    if (registry.isJudged(key, 'noteOff')) return

    const entry = this._entryByKey(key)
    if (!entry) return

    const expectedRelease = entry.timeSec + entry.durationSec
    const delta = Math.abs(currentTime - expectedRelease)
    const grade = delta <= PERFECT_WINDOW ? 'perfect'
      : delta <= GREAT_WINDOW ? 'great'
      : delta <= GOOD_WINDOW ? 'good'
      : 'miss'

    registry.markJudged(key, 'noteOff')

    const result: JudgmentResult = {
      type: 'noteOff',
      grade,
      pitch: entry.event.pitch,
      expectedPitch: entry.event.pitch,
      timingDelta: currentTime - expectedRelease,
      beat: entry.event.time,
      measureIndex: entry.measureIndex,
      noteIndex: entry.noteIndex,
      staffIndex: entry.staffIndex,
    }
    this._onJudgment?.(result)
  }

  private _checkPedalEvent(down: boolean, currentTime: number): void {
    const registry = this._registry
    if (!registry) return

    while (this._pedalEventIndex < this._pedalEvents.length) {
      const evt = this._pedalEvents[this._pedalEventIndex]
      const expectedType = down ? 'start' : 'stop'
      if (evt.type !== expectedType) break

      if (currentTime > evt.timeSec + MISS_WINDOW) {
        const result: JudgmentResult = {
          type: 'pedal',
          grade: 'miss',
          pitch: -1,
          expectedPitch: -1,
          timingDelta: currentTime - evt.timeSec,
          beat: evt.beat,
          measureIndex: evt.measureIndex,
          noteIndex: -1,
          staffIndex: -1,
          pedalType: evt.type,
        }
        this._onJudgment?.(result)
        this._pedalEventIndex++
        continue
      }

      const delta = Math.abs(currentTime - evt.timeSec)
      if (delta <= GOOD_WINDOW) {
        const grade: JudgmentGrade = delta <= PERFECT_WINDOW ? 'perfect'
          : delta <= GREAT_WINDOW ? 'great'
          : delta <= GOOD_WINDOW ? 'good'
          : 'miss'

        const result: JudgmentResult = {
          type: 'pedal',
          grade,
          pitch: -1,
          expectedPitch: -1,
          timingDelta: delta,
          beat: evt.beat,
          measureIndex: evt.measureIndex,
          noteIndex: -1,
          staffIndex: -1,
          pedalType: evt.type,
        }
        this._onJudgment?.(result)
        this._pedalEventIndex++
      }
      break
    }
  }

  checkMissed(currentTime: number): void {
    const registry = this._registry
    if (!registry || registry.all.length === 0) return

    const t = this._toNotesTime(currentTime)

    for (const entry of registry.all) {
      const key = `${entry.measureIndex}:${entry.staffIndex}:${entry.noteIndex}`

      if (!registry.isJudged(key, 'noteOn')) {
        if (t > entry.timeSec + MISS_WINDOW) {
          registry.markJudged(key, 'noteOn')
          const result: JudgmentResult = {
            type: 'noteOn',
            grade: 'miss',
            pitch: -1,
            expectedPitch: entry.event.pitch,
            timingDelta: t - entry.timeSec,
            beat: entry.event.time,
            measureIndex: entry.measureIndex,
            noteIndex: entry.noteIndex,
            staffIndex: entry.staffIndex,
          }
          this._onJudgment?.(result)
        }
      }

      if (registry.isJudged(key, 'noteOn') && !registry.isJudged(key, 'noteOff')) {
        const expectedRelease = entry.timeSec + entry.durationSec
        if (t > expectedRelease + NOTE_OFF_MISS_WINDOW) {
          registry.markJudged(key, 'noteOff')
          const result: JudgmentResult = {
            type: 'noteOff',
            grade: 'miss',
            pitch: entry.event.pitch,
            expectedPitch: entry.event.pitch,
            timingDelta: t - expectedRelease,
            beat: entry.event.time,
            measureIndex: entry.measureIndex,
            noteIndex: entry.noteIndex,
            staffIndex: entry.staffIndex,
          }
          this._onJudgment?.(result)
        }
      }
    }
  }

  private _entryByKey(key: string): EventRegistryEntry | undefined {
    const registry = this._registry
    if (!registry) return undefined
    for (const entry of registry.all) {
      if (`${entry.measureIndex}:${entry.staffIndex}:${entry.noteIndex}` === key) return entry
    }
    return undefined
  }

  private computeGrade(played: number, expected: number, delta: number): JudgmentGrade {
    if (played !== expected) return 'miss'
    if (delta <= PERFECT_WINDOW) return 'perfect'
    if (delta <= GREAT_WINDOW) return 'great'
    if (delta <= GOOD_WINDOW) return 'good'
    return 'miss'
  }

  private computeVelocityGrade(delta: number): JudgmentGrade {
    if (delta <= VELOCITY_PERFECT) return 'perfect'
    if (delta <= VELOCITY_GREAT) return 'great'
    if (delta <= VELOCITY_GOOD) return 'good'
    return 'miss'
  }

  reset(timeOffset: number): void {
    this._timeOffset = timeOffset
    this._registry?.reset()
    this._activeNotes.clear()
    this._noteOnTimes.clear()
    this._pedalHeld.clear()
    this._pedalDown = false
    this._pedalEvents = []
    this._pedalEventIndex = 0
  }
}
