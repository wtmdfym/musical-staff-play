import { usePractice } from '../../context/usePractice'

export default function LayoutSettings() {
  const { state, dispatch } = usePractice()
  const { verovioPageWidth, verovioPageHeight, verovioStaffSpacing, verovioNoteSpacing } = state

  return (
    <div className="section-content">
      <div className="setting-row">
        <label className="setting-label">Page Width</label>
        <input type="range" min="500" max="5000" step="100" value={verovioPageWidth} onChange={(e) => dispatch({ type: 'SET_VEROVIO_PAGE_WIDTH', width: parseInt(e.target.value) })} onMouseUp={() => dispatch({ type: 'COMMIT_LAYOUT' })} onTouchEnd={() => dispatch({ type: 'COMMIT_LAYOUT' })} className="zoom-slider" />
        <span className="setting-value">{verovioPageWidth}</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Page Height</label>
        <input type="range" min="500" max="6000" step="100" value={verovioPageHeight} onChange={(e) => dispatch({ type: 'SET_VEROVIO_PAGE_HEIGHT', height: parseInt(e.target.value) })} onMouseUp={() => dispatch({ type: 'COMMIT_LAYOUT' })} onTouchEnd={() => dispatch({ type: 'COMMIT_LAYOUT' })} className="zoom-slider" />
        <span className="setting-value">{verovioPageHeight}</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Staff Spacing</label>
        <input type="range" min="0" max="48" step="1" value={verovioStaffSpacing} onChange={(e) => dispatch({ type: 'SET_VEROVIO_STAFF_SPACING', spacing: parseInt(e.target.value) })} onMouseUp={() => dispatch({ type: 'COMMIT_LAYOUT' })} onTouchEnd={() => dispatch({ type: 'COMMIT_LAYOUT' })} className="zoom-slider" />
        <span className="setting-value">{verovioStaffSpacing}</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Note Spacing</label>
        <input type="range" min="0" max="1" step="0.05" value={verovioNoteSpacing} onChange={(e) => dispatch({ type: 'SET_VEROVIO_NOTE_SPACING', spacing: parseFloat(e.target.value) })} onMouseUp={() => dispatch({ type: 'COMMIT_LAYOUT' })} onTouchEnd={() => dispatch({ type: 'COMMIT_LAYOUT' })} className="zoom-slider" />
        <span className="setting-value">{verovioNoteSpacing.toFixed(2)}</span>
      </div>
    </div>
  )
}
