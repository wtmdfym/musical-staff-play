import { usePractice } from '../../context/usePractice'

export default function BoxSizeSettings() {
  const { state, dispatch } = usePractice()
  const { highlightPadX, highlightPadY, highlightStrokeWidthActive, highlightStrokeWidthPreview, jdStrokeWidth } = state

  return (
    <div className="section-content">
      <div className="setting-row">
        <label className="setting-label">Pad X</label>
        <input type="range" min="10" max="200" step="5" value={highlightPadX} onChange={(e) => dispatch({ type: 'SET_HIGHLIGHT_PAD_X', value: parseFloat(e.target.value) })} className="zoom-slider" />
        <span className="setting-value">{highlightPadX}</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Pad Y</label>
        <input type="range" min="10" max="200" step="5" value={highlightPadY} onChange={(e) => dispatch({ type: 'SET_HIGHLIGHT_PAD_Y', value: parseFloat(e.target.value) })} className="zoom-slider" />
        <span className="setting-value">{highlightPadY}</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Active Stroke</label>
        <input type="range" min="0.5" max="6" step="0.25" value={highlightStrokeWidthActive} onChange={(e) => dispatch({ type: 'SET_HIGHLIGHT_STROKE_ACTIVE', value: parseFloat(e.target.value) })} className="zoom-slider" />
        <span className="setting-value">{highlightStrokeWidthActive}</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Preview Stroke</label>
        <input type="range" min="0.25" max="4" step="0.25" value={highlightStrokeWidthPreview} onChange={(e) => dispatch({ type: 'SET_HIGHLIGHT_STROKE_PREVIEW', value: parseFloat(e.target.value) })} className="zoom-slider" />
        <span className="setting-value">{highlightStrokeWidthPreview}</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Judgment Stroke</label>
        <input type="range" min="0.5" max="6" step="0.25" value={jdStrokeWidth} onChange={(e) => dispatch({ type: 'SET_JD_STROKE_WIDTH', value: parseFloat(e.target.value) })} className="zoom-slider" />
        <span className="setting-value">{jdStrokeWidth}</span>
      </div>
    </div>
  )
}
