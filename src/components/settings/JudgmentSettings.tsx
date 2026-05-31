import { usePractice } from '../../context/usePractice'

export default function JudgmentSettings() {
  const { state, dispatch } = usePractice()
  const { noteOffJudgmentEnabled, velocityJudgmentEnabled, pedalJudgmentEnabled } = state

  return (
    <div className="section-content">
      <div className="setting-row">
        <label className="setting-label">Note On</label>
        <span className="setting-value secondary">Always enabled</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Note Off / Duration</label>
        <input type="checkbox" checked={noteOffJudgmentEnabled} onChange={(e) => dispatch({ type: 'SET_NOTE_OFF_JUDGMENT', enabled: e.target.checked })} />
      </div>
      <div className="setting-row">
        <label className="setting-label">Velocity</label>
        <input type="checkbox" checked={velocityJudgmentEnabled} onChange={(e) => dispatch({ type: 'SET_VELOCITY_JUDGMENT', enabled: e.target.checked })} />
      </div>
      <div className="setting-row">
        <label className="setting-label">Pedal</label>
        <input type="checkbox" checked={pedalJudgmentEnabled} onChange={(e) => dispatch({ type: 'SET_PEDAL_JUDGMENT', enabled: e.target.checked })} />
      </div>
    </div>
  )
}
