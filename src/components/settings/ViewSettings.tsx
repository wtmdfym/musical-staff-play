import { usePractice } from '../../context/usePractice'

export default function ViewSettings() {
  const { state, dispatch } = usePractice()
  const { displayMode, zoom, highlightMode } = state

  return (
    <div className="section-content">
      <div className="setting-row">
        <label className="setting-label">Display Mode</label>
        <div className="setting-options">
          <button className={`ctrl-btn ${displayMode === 'page' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_DISPLAY_MODE', mode: 'page' })}>Page</button>
          <button className={`ctrl-btn ${displayMode === 'scroll' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_DISPLAY_MODE', mode: 'scroll' })}>Scroll</button>
        </div>
      </div>
      <div className="setting-row">
        <label className="setting-label">Zoom</label>
        <input type="range" min="0.25" max="3" step="0.05" value={zoom} onChange={(e) => dispatch({ type: 'SET_ZOOM', zoom: parseFloat(e.target.value) })} onMouseUp={() => dispatch({ type: 'COMMIT_LAYOUT' })} onTouchEnd={() => dispatch({ type: 'COMMIT_LAYOUT' })} className="zoom-slider" />
        <span className="setting-value">{Math.round(zoom * 100)}%</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Highlight</label>
        <div className="setting-options">
          <button className={`ctrl-btn ${highlightMode === 'color' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_HIGHLIGHT_MODE', mode: 'color' })}>Color</button>
          <button className={`ctrl-btn ${highlightMode === 'box' ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_HIGHLIGHT_MODE', mode: 'box' })}>Box</button>
        </div>
      </div>
    </div>
  )
}
