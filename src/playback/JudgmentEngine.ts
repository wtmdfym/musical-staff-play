import type { JudgmentGrade, JudgmentResult } from '../score/ScoreTypes'
import type { EventRegistryEntry } from '../core/EventRegistry'

export interface JudgmentRegistry {
  readonly all: readonly EventRegistryEntry[]
  isJudged(key: string): boolean
  markJudged(key: string): void
  reset(): void
}

const PERFECT_WINDOW = 0.04
const GREAT_WINDOW = 0.08
const GOOD_WINDOW = 0.12
const MISS_WINDOW = 0.2

export class JudgmentEngine {
  private _registry: JudgmentRegistry | null = null
  private _onJudgment: ((result: JudgmentResult) => void) | null = null

  setRegistry(registry: JudgmentRegistry | null): void {
    this._registry = registry
  }

  set onJudgment(cb: ((result: JudgmentResult) => void) | null) {
    this._onJudgment = cb
  }

  /** Single-pitch judgment (legacy) */
  onInput(pitch: number, currentTime: number): JudgmentResult | null {
    const registry = this._registry
    if (!registry || registry.all.length === 0) return null

    let best: { entry: EventRegistryEntry; timingDelta: number } | null = null

    for (const entry of registry.all) {
      const key = `${entry.measureIndex}:${entry.staffIndex}:${entry.noteIndex}`
      if (registry.isJudged(key)) continue

      const delta = Math.abs(currentTime - entry.timeSec)

      if (delta <= GOOD_WINDOW) {
        if (!best || delta < best.timingDelta) {
          best = { entry, timingDelta: delta }
        }
      } else if (entry.timeSec - currentTime > GOOD_WINDOW) {
        break
      }
    }

    if (!best) return null

    const key = `${best.entry.measureIndex}:${best.entry.staffIndex}:${best.entry.noteIndex}`
    registry.markJudged(key)

    const grade = this.computeGrade(pitch, best.entry.event.pitch, best.timingDelta)
    const result: JudgmentResult = {
      grade,
      pitch,
      expectedPitch: best.entry.event.pitch,
      timingDelta: best.timingDelta,
      beat: best.entry.event.time,
      measureIndex: best.entry.measureIndex,
      noteIndex: best.entry.noteIndex,
      staffIndex: best.entry.staffIndex,
    }

    this._onJudgment?.(result)
    return result
  }

  /** Column-based judgment: matches against multiple expected pitches */
  onInputColumn(pitches: number[], currentTime: number): JudgmentResult[] {
    const registry = this._registry
    if (!registry || registry.all.length === 0) return []

    const results: JudgmentResult[] = []

    for (const pitch of pitches) {
      let best: { entry: EventRegistryEntry; timingDelta: number } | null = null

      for (const entry of registry.all) {
        const key = `${entry.measureIndex}:${entry.staffIndex}:${entry.noteIndex}`
        if (registry.isJudged(key)) continue

        const delta = Math.abs(currentTime - entry.timeSec)

        if (delta <= GOOD_WINDOW) {
          if (!best || delta < best.timingDelta) {
            best = { entry, timingDelta: delta }
          }
        } else if (entry.timeSec - currentTime > GOOD_WINDOW) {
          break
        }
      }

      if (!best) continue

      const key = `${best.entry.measureIndex}:${best.entry.staffIndex}:${best.entry.noteIndex}`
      registry.markJudged(key)

      const grade = this.computeGrade(pitch, best.entry.event.pitch, best.timingDelta)
      results.push({
        grade,
        pitch,
        expectedPitch: best.entry.event.pitch,
        timingDelta: best.timingDelta,
        beat: best.entry.event.time,
        measureIndex: best.entry.measureIndex,
        noteIndex: best.entry.noteIndex,
        staffIndex: best.entry.staffIndex,
      })
    }

    for (const r of results) {
      this._onJudgment?.(r)
    }
    return results
  }

  checkMissed(currentTime: number): void {
    const registry = this._registry
    if (!registry || registry.all.length === 0) return

    for (const entry of registry.all) {
      const key = `${entry.measureIndex}:${entry.staffIndex}:${entry.noteIndex}`
      if (registry.isJudged(key)) continue

      if (currentTime > entry.timeSec + MISS_WINDOW) {
        registry.markJudged(key)
        const result: JudgmentResult = {
          grade: 'miss',
          pitch: -1,
          expectedPitch: entry.event.pitch,
          timingDelta: currentTime - entry.timeSec,
          beat: entry.event.time,
          measureIndex: entry.measureIndex,
          noteIndex: entry.noteIndex,
          staffIndex: entry.staffIndex,
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
    this._registry?.reset()
  }
}
