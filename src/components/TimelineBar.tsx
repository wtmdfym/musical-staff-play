import { usePractice } from '../context/usePractice'
import PageTimeline from './PageTimeline'
import ScrollTimeline from './ScrollTimeline'

export default function TimelineBar() {
  const { state } = usePractice()
  const { score, displayMode } = state

  if (!score || score.measures.length === 0) return null

  return displayMode === 'page' ? <PageTimeline /> : <ScrollTimeline />
}
