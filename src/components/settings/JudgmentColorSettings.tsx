import { usePractice } from '../../context/usePractice'

export default function JudgmentColorSettings() {
  const { state, dispatch } = usePractice()
  const { jdPerfectColor, jdGreatColor, jdGoodColor, jdMissColor } = state

  return (
    <div className="section-content">
      <div className="setting-row">
        <label className="setting-label">Perfect</label>
        <input type="color" className="color-picker" value={jdPerfectColor} onChange={(e) => dispatch({ type: 'SET_JD_PERFECT_COLOR', color: e.target.value })} />
      </div>
      <div className="setting-row">
        <label className="setting-label">Great</label>
        <input type="color" className="color-picker" value={jdGreatColor} onChange={(e) => dispatch({ type: 'SET_JD_GREAT_COLOR', color: e.target.value })} />
      </div>
      <div className="setting-row">
        <label className="setting-label">Good</label>
        <input type="color" className="color-picker" value={jdGoodColor} onChange={(e) => dispatch({ type: 'SET_JD_GOOD_COLOR', color: e.target.value })} />
      </div>
      <div className="setting-row">
        <label className="setting-label">Miss</label>
        <input type="color" className="color-picker" value={jdMissColor} onChange={(e) => dispatch({ type: 'SET_JD_MISS_COLOR', color: e.target.value })} />
      </div>
    </div>
  )
}
