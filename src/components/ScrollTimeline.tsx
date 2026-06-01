import { useRef, useState } from 'react'
import { usePractice } from '../context/usePractice'
import { getGameLoop } from '../core/GameLoop'
import { useFpsMonitor } from '../playback/useFpsMonitor'
import FpsDisplay from './FpsDisplay'

export default function ScrollTimeline({ onScrollToPosition }: { onScrollToPosition?: (beat: number) => void }) {
  const barRef = useRef<HTMLDivElement>(null)
  const { state, dispatch } = usePractice()
  const { score, scrollOffset, emptyMeasures, playState } = state
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; beat: number; measure: number }>({ visible: false, x: 0, beat: 0, measure: 0 })

  const measures = score?.measures ?? []
  const total = measures.length

  const { logicFps, renderFps } = useFpsMonitor()

  if (total === 0) return null

  const firstSig = measures[0]?.timeSignature[0] ?? 4
  const emptyBeats = emptyMeasures * firstSig
  const adjustedBeat = scrollOffset - emptyBeats
  const totalBeats = score?.totalBeats ?? 1
  const measureProgress = Math.max(0, Math.min(1, adjustedBeat / totalBeats))
  const currentMeasure = Math.max(0, Math.min(total - 1, Math.floor(adjustedBeat / firstSig)))

  const handleClick = (e: React.MouseEvent) => {
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const targetBeat = ratio * totalBeats + emptyBeats
    if (playState === 'playing') {
      getGameLoop().seekToBeat(targetBeat)
      dispatch({ type: 'SET_SCROLL_OFFSET', offset: targetBeat })
    } else {
      getGameLoop().seekToBeat(targetBeat)
      dispatch({ type: 'SET_SCROLL_OFFSET', offset: targetBeat })
      onScrollToPosition?.(targetBeat)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const beat = ratio * totalBeats
    const measure = Math.floor(beat / firstSig)
    setTooltip({ visible: true, x: e.clientX - rect.left, beat, measure })
  }

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, beat: 0, measure: 0 })
  }

  return (
    <div
      className="timeline-bar"
      ref={barRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ height: 34 }}
    >
      <div className="timeline-track">
        <div className="timeline-fill" style={{ width: `${Math.min(measureProgress * 100, 100)}%` }} />
      </div>

      <div className="timeline-ticks">
        {total > 1 && measures.map((_, i) => {
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

      {tooltip.visible && (
        <div
          className="timeline-tooltip"
          style={{ left: tooltip.x }}
        >
          M.{tooltip.measure + 1}
        </div>
      )}

      <span className="timeline-label">M. {currentMeasure + 1} / {total}</span>

      <FpsDisplay logicFps={logicFps} renderFps={renderFps} />
    </div>
  )
}
