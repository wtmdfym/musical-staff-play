import { usePractice } from '../../context/usePractice'

export default function HighlightColorSettings() {
  const { state, dispatch } = usePractice()
  const { highlightColor } = state

  return (
    <div className="section-content">
      <div className="setting-row">
        <label className="setting-label">Highlight</label>
        <input type="color" className="color-picker" value={highlightColor} onChange={(e) => dispatch({ type: 'SET_HIGHLIGHT_COLOR', color: e.target.value })} />
      </div>
    </div>
  )
}
