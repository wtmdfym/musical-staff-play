import { useEffect, useState, useRef } from 'react'
import { usePractice } from '../context/usePractice'
import { useFpsMonitor } from '../playback/useFpsMonitor'

function grade(acc: number): string {
  if (acc >= 95) return 'S'
  if (acc >= 85) return 'A'
  if (acc >= 70) return 'B'
  if (acc >= 50) return 'C'
  return 'D'
}

export default function StatsPanel() {
  const { state, dispatch } = usePractice()
  const { stats, playState } = state
  const { noteOn } = stats

  const total = noteOn.perfect + noteOn.great + noteOn.good + noteOn.miss
  const accuracy = total > 0 ? Math.round((noteOn.perfect + noteOn.great) / total * 100) : 100

  const [comboFlash, setComboFlash] = useState(false)
  const prevComboRef = useRef(stats.combo)
  useEffect(() => {
    if (stats.combo > 0 && stats.combo !== prevComboRef.current) {
      prevComboRef.current = stats.combo
      setComboFlash(true)
      const t = setTimeout(() => setComboFlash(false), 200)
      return () => clearTimeout(t)
    }
    prevComboRef.current = stats.combo
  }, [stats.combo])

  const { logicFps, renderFps } = useFpsMonitor()

  return (
    <div className={`stats-panel ${playState === 'playing' ? 'active' : ''}`}>
      <div className="stats-row stats-top">
        <span className="stats-grade">{grade(accuracy)}</span>
        <span className={`stats-combo ${comboFlash ? 'flash' : ''}`}>
          {stats.combo > 0 ? `${stats.combo}x` : '-'}
        </span>
      </div>
      <div className="stats-row stats-detail">
        <span className="stat-perfect">★ {noteOn.perfect}</span>
        <span className="stat-great">● {noteOn.great}</span>
        <span className="stat-good">● {noteOn.good}</span>
        <span className="stat-miss">✗ {noteOn.miss}</span>
      </div>
      <div className="stats-row">
        <span className="stats-acc">{accuracy}%</span>
      </div>
      <div className="stats-row stats-fps">
        <span className="stat-fps-label">L:</span>
        <span className="stat-fps-value">{logicFps}</span>
        <span className="stat-fps-label">R:</span>
        <span className="stat-fps-value">{renderFps}</span>
      </div>
      {total > 0 && (
        <div className="stats-row">
          <button
            className="ctrl-btn review-btn"
            onClick={() => dispatch({ type: 'SHOW_HEATMAP' })}
          >
            Review
          </button>
        </div>
      )}
    </div>
  )
}
