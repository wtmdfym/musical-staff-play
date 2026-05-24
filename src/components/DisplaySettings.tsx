import { useState, useRef } from 'react'
import { usePractice } from '../context/usePractice'

export default function DisplaySettings() {
  const { state, dispatch } = usePractice()
  const { zoom, displayMode, bpmOverride, measuresWindow, emptyMeasures, score, highlightLeadBeats, highlightRange } = state
  const defaultBpm = score?.bpm ?? 60
  const [bpmInput, setBpmInput] = useState(String(bpmOverride || defaultBpm))
  const [showAdvanced, setShowAdvanced] = useState(false)
  const bpmRef = useRef<HTMLInputElement>(null)

  const commitBpm = () => {
    const val = parseInt(bpmInput, 10)
    if (isNaN(val) || val < 1) {
      setBpmInput(String(bpmOverride || defaultBpm))
      return
    }
    const clamped = Math.max(20, Math.min(300, val))
    dispatch({ type: 'SET_BPM', bpm: clamped })
    if (clamped !== val) setBpmInput(String(clamped))
  }

  return (
    <div className="display-settings">
      <div className="setting-row">
        <label className="setting-label">Zoom</label>
        <input
          type="range"
          min="0.25"
          max="3"
          step="0.05"
          value={zoom}
          onChange={(e) => dispatch({ type: 'SET_ZOOM', zoom: parseFloat(e.target.value) })}
          className="zoom-slider"
        />
        <span className="setting-value">{Math.round(zoom * 100)}%</span>
      </div>

      <div className="setting-row">
        <label className="setting-label">BPM</label>
        <input
          ref={bpmRef}
          type="number"
          min="1"
          max="999"
          value={bpmInput}
          onChange={(e) => setBpmInput(e.target.value)}
          onBlur={commitBpm}
          onKeyDown={(e) => { if (e.key === 'Enter') { bpmRef.current?.blur() } }}
          className="setting-number bpm-input"
          title={bpmOverride > 0 ? 'Overridden BPM' : 'From score'}
        />
        {bpmOverride > 0 && (
          <button
            className="ctrl-btn reset-btn"
            onClick={() => { dispatch({ type: 'SET_BPM', bpm: 0 }); setBpmInput(String(defaultBpm)) }}
            title="Reset to score BPM"
          >
            ↺
          </button>
        )}
      </div>

      <button
        className="ctrl-btn"
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{ padding: '3px 8px', fontSize: '11px' }}
      >
        {showAdvanced ? 'Less' : 'More'}
      </button>

      {showAdvanced && (
        <>
          <div className="setting-row">
            <label className="setting-label">Judgment Line</label>
            <input
              type="range"
              min="0.1"
              max="0.5"
              step="0.01"
              value={state.playheadRatio}
              onChange={(e) => dispatch({ type: 'SET_PLAYHEAD_RATIO', ratio: parseFloat(e.target.value) })}
              className="zoom-slider"
            />
            <span className="setting-value">{Math.round(state.playheadRatio * 100)}%</span>
          </div>

          {displayMode === 'scroll' && (
            <>
              <div className="setting-row">
                <label className="setting-label">Window</label>
                <select
                  value={measuresWindow}
                  onChange={(e) => dispatch({ type: 'SET_MEASURES_WINDOW', count: parseInt(e.target.value) })}
                  className="setting-select"
                >
                  {[2, 3, 4, 5, 6, 8, 12, 16].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="setting-row">
                <label className="setting-label">Lead</label>
                <select
                  value={emptyMeasures}
                  onChange={(e) => dispatch({ type: 'SET_EMPTY_MEASURES', count: parseInt(e.target.value) })}
                  className="setting-select"
                >
                  {[0, 1, 2, 4, 8].map((n) => (
                    <option key={n} value={n}>{n === 0 ? 'None' : `${n}m`}</option>
                  ))}
                </select>
              </div>

              <div className="setting-row">
                <label className="setting-label">Highlight</label>
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={highlightLeadBeats}
                  onChange={(e) => dispatch({ type: 'SET_HIGHLIGHT_LEAD', beats: parseFloat(e.target.value) })}
                  className="zoom-slider"
                />
                <span className="setting-value">{highlightLeadBeats.toFixed(1)}b</span>
              </div>

              <div className="setting-row">
                <label className="setting-label">Columns</label>
                <select
                  value={highlightRange}
                  onChange={(e) => dispatch({ type: 'SET_HIGHLIGHT_RANGE', count: parseInt(e.target.value) })}
                  className="setting-select"
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
