import type { JudgmentResult } from '../score/ScoreTypes'

export type PlaybackEvent =
  | { type: 'playback-ended' }
  | { type: 'scroll-offset-changed'; offset: number }
  | { type: 'page-advance-requested'; direction: 'next' | 'prev' }
  | { type: 'page-advanced'; page: number }
  | { type: 'total-pages-changed'; total: number }
  | { type: 'judgment-fired'; result: JudgmentResult }

export interface PlaybackEventSink {
  emit(event: PlaybackEvent): void
}
