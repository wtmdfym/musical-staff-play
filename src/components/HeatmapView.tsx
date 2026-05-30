import { useState } from 'react'
import { usePractice } from '../context/usePractice'
import type { JudgmentType } from '../score/ScoreTypes'

type HeatmapTab = JudgmentType

const TAB_LABELS: Record<HeatmapTab, string> = {
  noteOn: '触键',
  noteOff: '离键',
  velocity: '力度',
  pedal: '踏板',
}

const TABS: HeatmapTab[] = ['noteOn', 'noteOff', 'velocity', 'pedal']

function heatColor(value: number): string {
  if (value <= 0.2) return '#22c55e'
  if (value <= 0.4) return '#84cc16'
  if (value <= 0.6) return '#eab308'
  if (value <= 0.8) return '#f97316'
  return '#ef4444'
}

function velocityHeatColor(deviation: number): string {
  if (deviation <= 12) return '#22c55e'
  if (deviation <= 24) return '#84cc16'
  if (deviation <= 36) return '#eab308'
  if (deviation <= 48) return '#f97316'
  return '#ef4444'
}

export default function HeatmapView() {
  const { state, dispatch } = usePractice()
  const { showHeatmap, score, stats } = state
  const [activeTab, setActiveTab] = useState<HeatmapTab>('noteOn')

  if (!showHeatmap || !score) return null

  const totalMeasures = score.measures.length

  const dimEnabled: Record<HeatmapTab, boolean> = {
    noteOn: true,
    noteOff: state.noteOffJudgmentEnabled,
    velocity: state.velocityJudgmentEnabled,
    pedal: state.pedalJudgmentEnabled,
  }

  const renderDimensionStats = () => {
    const dimStats = stats[activeTab]

    if (activeTab === 'velocity') {
      let totalDev = 0
      let totalCnt = 0
      for (const d of Object.values(state.measureDeviations)) {
        totalDev += d.totalDeviation
        totalCnt += d.count
      }
      const avgDev = totalCnt > 0 ? Math.round(totalDev / totalCnt) : 0
      return (
        <div className="heatmap-summary">
          <div>平均偏差: <strong>±{avgDev}</strong></div>
          <div>Perfect: {dimStats.perfect} · Great: {dimStats.great} · Good: {dimStats.good} · Miss: {dimStats.miss}</div>
        </div>
      )
    }

    const total = dimStats.perfect + dimStats.great + dimStats.good + dimStats.miss
    const scorePct = total > 0 ? Math.round((dimStats.perfect + dimStats.great) / total * 100) : 100
    return (
      <div className="heatmap-summary">
        <div>得分率: <strong>{scorePct}%</strong></div>
        <div>Perfect: {dimStats.perfect} · Great: {dimStats.great} · Good: {dimStats.good} · Miss: {dimStats.miss}</div>
      </div>
    )
  }

  const renderGrid = () => {
    if (activeTab === 'velocity') {
      return (
        <div className="heatmap-grid">
          {Array.from({ length: totalMeasures }, (_, i) => {
            const dev = state.measureDeviations[i]
            const avgDev = dev && dev.count > 0 ? dev.totalDeviation / dev.count : 0
            const hasData = dev && dev.count > 0
            return (
              <div key={i} className="heatmap-cell" style={{ backgroundColor: hasData ? velocityHeatColor(avgDev) : '#374151' }}>
                <span className="heatmap-cell-label">{i + 1}</span>
                <span className="heatmap-cell-value">{hasData ? `±${Math.round(avgDev)}` : '-'}</span>
              </div>
            )
          })}
        </div>
      )
    }

    const measureNotes = Array.from({ length: totalMeasures }, (_, i) =>
      score.measures[i]?.staves.reduce((sum, s) => sum + s.events.filter((e) => !e.isRest).length, 0) || 0
    )

    let pedalCounts: number[] | null = null
    if (activeTab === 'pedal') {
      pedalCounts = Array<number>(totalMeasures).fill(0)
      for (const pe of score.pedalEvents) {
        pedalCounts[pe.measureIndex]++
      }
    }

    return (
      <div className="heatmap-grid">
        {Array.from({ length: totalMeasures }, (_, i) => {
          const mErrs = state.measureErrors[i]
          const errors = mErrs != null ? mErrs[activeTab] : 0
          const denominator = pedalCounts ? pedalCounts[i] : measureNotes[i]
          const rate = denominator > 0 ? errors / denominator : 0
          const hasEvents = denominator > 0
          return (
            <div key={i} className="heatmap-cell" style={{ backgroundColor: hasEvents ? heatColor(rate) : '#374151' }}>
              <span className="heatmap-cell-label">{i + 1}</span>
              <span className="heatmap-cell-value">{hasEvents ? `${Math.round(rate * 100)}%` : '-'}</span>
            </div>
          )
        })}
      </div>
    )
  }

  const renderLegend = () => {
    if (activeTab === 'velocity') {
      return (
        <div className="heatmap-legend">
          <span>精准</span>
          <span className="heatmap-legend-bar">
            <span style={{ background: '#22c55e' }} />
            <span style={{ background: '#84cc16' }} />
            <span style={{ background: '#eab308' }} />
            <span style={{ background: '#f97316' }} />
            <span style={{ background: '#ef4444' }} />
          </span>
          <span>偏差大</span>
        </div>
      )
    }
    return (
      <div className="heatmap-legend">
        <span>低错误率</span>
        <span className="heatmap-legend-bar">
          <span style={{ background: '#22c55e' }} />
          <span style={{ background: '#84cc16' }} />
          <span style={{ background: '#eab308' }} />
          <span style={{ background: '#f97316' }} />
          <span style={{ background: '#ef4444' }} />
        </span>
        <span>高错误率</span>
      </div>
    )
  }

  return (
    <div className="heatmap-overlay" onClick={() => dispatch({ type: 'HIDE_HEATMAP' })}>
      <div className="heatmap-modal" onClick={(e) => e.stopPropagation()}>
        <h2>练习回顾</h2>

        <div className="heatmap-summary">
          <div>Max Combo: <strong>{stats.maxCombo}x</strong></div>
        </div>

        <div className="heatmap-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`heatmap-tab${activeTab === tab ? ' active' : ''}${!dimEnabled[tab] ? ' disabled' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {dimEnabled[activeTab] ? (
          <>
            {renderDimensionStats()}
            {renderGrid()}
            {renderLegend()}
          </>
        ) : (
          <div className="heatmap-empty">该维度未开启，请在设置中启用</div>
        )}

        <button className="ctrl-btn heatmap-close" onClick={() => dispatch({ type: 'HIDE_HEATMAP' })}>
          关闭
        </button>
      </div>
    </div>
  )
}
