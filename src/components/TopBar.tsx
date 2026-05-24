import { usePractice } from '../context/usePractice'

export default function TopBar() {
  const { state, dispatch } = usePractice()
  const { displayMode, score } = state

  return (
    <div className="top-bar">
      <div className="top-bar-title">
        <span className="top-bar-icon">♪</span>
        <h1>Musical Staff Play</h1>
      </div>

      <div className="top-bar-info">
        {score && <span className="score-name">{score.title}</span>}
      </div>

      <div className="top-bar-controls">
        <span className="mode-label">{displayMode === 'page' ? 'Page' : 'Scroll'}</span>
        <button
          className={`mode-btn ${displayMode === 'page' ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_DISPLAY_MODE', mode: 'page' })}
          title="Page Mode"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="18" rx="2" />
            <line x1="2" y1="9" x2="22" y2="9" />
            <line x1="12" y1="9" x2="12" y2="21" />
          </svg>
        </button>
        <button
          className={`mode-btn ${displayMode === 'scroll' ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_DISPLAY_MODE', mode: 'scroll' })}
          title="Scroll Mode"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 12 8 8 12 12 16 8 20 12" />
            <polyline points="4 16 8 12 12 16 16 12 20 16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
