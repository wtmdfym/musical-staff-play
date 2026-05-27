import { usePractice } from '../context/usePractice'

function heatColor(value: number): string {
  if (value <= 0.2) return '#22c55e'
  if (value <= 0.4) return '#84cc16'
  if (value <= 0.6) return '#eab308'
  if (value <= 0.8) return '#f97316'
  return '#ef4444'
}

export default function HeatmapView() {
  const { state, dispatch } = usePractice()
  const { showHeatmap, score, stats } = state

  if (!showHeatmap || !score) return null

  const totalMeasures = score.measures.length
  const total = stats.noteOn.perfect + stats.noteOn.great + stats.noteOn.good + stats.noteOn.miss

  const measureRates: number[] = Array.from({ length: totalMeasures }, (_, i) => {
    const errors = state.measureErrors[i] || 0
    const measureEvents = score.measures[i]?.staves.reduce((sum, s) => sum + s.events.filter((e) => !e.isRest).length, 0) || 0
    return measureEvents > 0 ? errors / measureEvents : 0
  })

  return (
    <div className="heatmap-overlay" onClick={() => dispatch({ type: 'HIDE_HEATMAP' })}>
      <div className="heatmap-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Practice Review</h2>

        <div className="heatmap-summary">
          <div>Score: <strong>{total > 0
            ? Math.round((stats.noteOn.perfect + stats.noteOn.great) / total * 100)
            : 100}%</strong></div>
          <div>Max Combo: <strong>{stats.maxCombo}x</strong></div>
          <div>Perfect: {stats.noteOn.perfect} · Great: {stats.noteOn.great} · Good: {stats.noteOn.good} · Miss: {stats.noteOn.miss}</div>
        </div>

        <div className="heatmap-grid">
          {Array.from({ length: totalMeasures }, (_, i) => {
            const rate = measureRates[i] ?? 0
            return (
              <div key={i} className="heatmap-cell" style={{ backgroundColor: heatColor(rate) }}>
                <span className="heatmap-cell-label">{i + 1}</span>
                <span className="heatmap-cell-value">{Math.round(rate * 100)}%</span>
              </div>
            )
          })}
        </div>

        <div className="heatmap-legend">
          <span>Low error</span>
          <span className="heatmap-legend-bar">
            <span style={{ background: '#22c55e' }} />
            <span style={{ background: '#84cc16' }} />
            <span style={{ background: '#eab308' }} />
            <span style={{ background: '#f97316' }} />
            <span style={{ background: '#ef4444' }} />
          </span>
          <span>High error</span>
        </div>

        <button className="ctrl-btn heatmap-close" onClick={() => dispatch({ type: 'HIDE_HEATMAP' })}>
          Close
        </button>
      </div>
    </div>
  )
}
