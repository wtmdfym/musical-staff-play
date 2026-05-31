import { usePractice } from '../../context/usePractice'
import { useBpmInput } from '../../playback/useBpmInput'

export default function PlaySettings() {
  const { state, dispatch } = usePractice()
  const { bpmOverrideEnabled, speedRatio, measuresWindow, emptyMeasures, highlightLeadBeats, highlightRange } = state
  const { bpmInput, setBpmInput, bpmRef, commitBpm, resetBpm, handleBpmKeyDown } = useBpmInput()

  return (
    <div className="section-content">
      <div className="setting-row">
        <label className="setting-label">Override Tempo</label>
        <input type="checkbox" checked={bpmOverrideEnabled} onChange={(e) => dispatch({ type: 'SET_BPM_OVERRIDE_ENABLED', enabled: e.target.checked })} />
      </div>
      {bpmOverrideEnabled ? (
        <div className="setting-row">
          <label className="setting-label">Fixed BPM</label>
          <input ref={bpmRef} type="number" min="1" max="999" value={bpmInput} onChange={(e) => setBpmInput(e.target.value)} onBlur={commitBpm} onKeyDown={handleBpmKeyDown} className="setting-number bpm-input" />
          <button className="ctrl-btn reset-btn" onClick={resetBpm} title="Reset to score BPM">R</button>
        </div>
      ) : (
        <div className="setting-row">
          <label className="setting-label">Speed Ratio</label>
          <input type="range" min="0.25" max="4" step="0.05" value={speedRatio} onChange={(e) => dispatch({ type: 'SET_SPEED_RATIO', ratio: parseFloat(e.target.value) })} className="zoom-slider" />
          <span className="setting-value">{Math.round(speedRatio * 100)}%</span>
        </div>
      )}
      <div className="setting-row">
        <label className="setting-label">Window</label>
        <select value={measuresWindow} onChange={(e) => dispatch({ type: 'SET_MEASURES_WINDOW', count: parseInt(e.target.value) })} className="setting-select">
          {[2, 3, 4, 5, 6, 8, 12, 16].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="setting-row">
        <label className="setting-label">Lead</label>
        <select value={emptyMeasures} onChange={(e) => dispatch({ type: 'SET_EMPTY_MEASURES', count: parseInt(e.target.value) })} className="setting-select">
          {[0, 1, 2, 4, 8].map((n) => <option key={n} value={n}>{n === 0 ? 'None' : `${n}m`}</option>)}
        </select>
      </div>
      <div className="setting-row">
        <label className="setting-label">Highlight Lead</label>
        <input type="range" min="0.1" max="2" step="0.1" value={highlightLeadBeats} onChange={(e) => dispatch({ type: 'SET_HIGHLIGHT_LEAD', beats: parseFloat(e.target.value) })} className="zoom-slider" />
        <span className="setting-value">{highlightLeadBeats.toFixed(1)}b</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Highlight Range</label>
        <select value={highlightRange} onChange={(e) => dispatch({ type: 'SET_HIGHLIGHT_RANGE', count: parseInt(e.target.value) })} className="setting-select">
          {[1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n} columns</option>)}
        </select>
      </div>
    </div>
  )
}
