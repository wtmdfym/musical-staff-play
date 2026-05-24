import { useRef } from 'react'
import { usePractice } from '../context/usePractice'
import { getGameLoop } from '../core/GameLoop'

export default function TimelineBar() {
  const barRef = useRef<HTMLDivElement>(null)
  const { state, dispatch } = usePractice()
  const { score, displayMode, currentPage, scrollOffset, emptyMeasures, playState, totalPages } = state

  const measures = score?.measures ?? []
  const total = measures.length
  if (total === 0) return null

  const firstSig = measures[0]?.timeSignature[0] ?? 4
  const emptyBeats = emptyMeasures * firstSig
  const adjustedBeat = scrollOffset - emptyBeats
  const totalBeats = score?.totalBeats ?? 1

  const measureProgress = displayMode === 'page'
    ? totalPages > 1 ? currentPage / (totalPages - 1) : 0
    : Math.max(0, Math.min(1, adjustedBeat / totalBeats))

  const currentMeasure = displayMode === 'page'
    ? 0
    : Math.max(0, Math.min(total - 1, Math.floor(adjustedBeat / firstSig)))

  const handleClick = (e: React.MouseEvent) => {
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))

    if (displayMode === 'page') {
      const target = Math.floor(ratio * totalPages)
      dispatch({ type: 'SET_PAGE', page: Math.min(target, totalPages - 1) })
    } else {
      const targetBeat = ratio * totalBeats + emptyBeats
      if (playState === 'playing') {
        getGameLoop().seekToBeat(targetBeat)
        dispatch({ type: 'SET_SCROLL_OFFSET', offset: targetBeat })
      } else {
        dispatch({ type: 'SET_SCROLL_OFFSET', offset: targetBeat })
      }
    }
  }

  return (
    <div className="timeline-bar" ref={barRef} onClick={handleClick}>
      <div className="timeline-track">
        <div className="timeline-fill" style={{ width: `${Math.min(measureProgress * 100, 100)}%` }} />
      </div>
      <div className="timeline-ticks">
        {displayMode === 'scroll' && measures.map((_, i) => {
          if (total <= 1) return null
          const spacing = 100 / (total - 1)
          return (
            <div
              key={i}
              className={`timeline-tick ${i === currentMeasure ? 'active' : ''}`}
              style={{ left: `${i * spacing}%` }}
            />
          )
        })}
      </div>
      <span className="timeline-label">
        {displayMode === 'page' ? `P. ${currentPage + 1} / ${totalPages}` : `M. ${currentMeasure + 1} / ${total}`}
      </span>
    </div>
  )
}
