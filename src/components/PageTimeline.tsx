import { useRef } from 'react'
import { usePractice } from '../context/usePractice'
import { useFpsMonitor } from '../playback/useFpsMonitor'
import FpsDisplay from './FpsDisplay'

export default function PageTimeline() {
  const barRef = useRef<HTMLDivElement>(null)
  const { state, dispatch } = usePractice()
  const { currentPage, totalPages } = state

  const progress = totalPages > 1 ? currentPage / (totalPages - 1) : 0
  const { logicFps, renderFps } = useFpsMonitor()

  const handleClick = (e: React.MouseEvent) => {
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const target = Math.floor(ratio * totalPages)
    dispatch({ type: 'SET_PAGE', page: Math.min(target, totalPages - 1) })
  }

  return (
    <div className="timeline-bar" ref={barRef} onClick={handleClick} style={{ height: 34 }}>
      <button
        className="timeline-nav-btn"
        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'PREV_PAGE' }) }}
        disabled={currentPage <= 0}
        title="Previous page"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="timeline-track">
        <div className="timeline-fill" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
      </div>

      <button
        className="timeline-nav-btn"
        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'NEXT_PAGE' }) }}
        disabled={currentPage >= totalPages - 1}
        title="Next page"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <span className="timeline-label">P. {currentPage + 1} / {totalPages}</span>

      <FpsDisplay logicFps={logicFps} renderFps={renderFps} />
    </div>
  )
}
