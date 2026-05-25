import type { ScoreData, ScoreEvent } from './ScoreTypes'

export interface PlayableEvent {
  event: ScoreEvent
  measureIndex: number
  staffIndex: number
  noteIndex: number
}

export function buildEventIndex(score: ScoreData): PlayableEvent[] {
  const events: PlayableEvent[] = []
  for (let mi = 0; mi < score.measures.length; mi++) {
    const measure = score.measures[mi]
    for (let si = 0; si < measure.staves.length; si++) {
      const staff = measure.staves[si]
      for (let ni = 0; ni < staff.events.length; ni++) {
        const event = staff.events[ni]
        if (event.isRest) continue
        events.push({
          event,
          measureIndex: mi,
          staffIndex: si,
          noteIndex: ni,
        })
      }
    }
  }
  events.sort((a, b) => a.event.time - b.event.time)
  return events
}
