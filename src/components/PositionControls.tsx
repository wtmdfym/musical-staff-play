import { usePractice } from '../context/usePractice'

export default function PositionControls() {
  const { state, dispatch } = usePractice()
  const { rangeStart, rangeEnd, score, displayMode, currentPage, totalPages } = state
  const maxMeasure = score ? score.measures.length - 1 : 0

  return (
    <div className="position-controls">
      <div className="setting-row">
        <label className="setting-label">From</label>
        <input
          type="number"
          min={0}
          max={rangeEnd}
          value={rangeStart}
          onChange={(e) => dispatch({ type: 'SET_RANGE_START', start: parseInt(e.target.value) || 0 })}
          className="setting-number"
        />
      </div>
      <div className="setting-row">
        <label className="setting-label">To</label>
        <input
          type="number"
          min={rangeStart}
          max={maxMeasure}
          value={rangeEnd}
          onChange={(e) => dispatch({ type: 'SET_RANGE_END', end: parseInt(e.target.value) || 0 })}
          className="setting-number"
        />
      </div>
      {displayMode === 'page' && (
        <div className="setting-row">
          <label className="setting-label">Page</label>
          <button
            className="ctrl-btn"
            onClick={() => dispatch({ type: 'PREV_PAGE' })}
            disabled={currentPage <= 0}
            style={{ padding: '2px 6px', fontSize: '11px' }}
          >
            ◀
          </button>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage + 1}
            onChange={(e) => {
              const p = parseInt(e.target.value) || 1
              dispatch({ type: 'SET_PAGE', page: Math.max(0, Math.min(totalPages - 1, p - 1)) })
            }}
            className="setting-number"
            style={{ width: '36px' }}
          />
          <button
            className="ctrl-btn"
            onClick={() => dispatch({ type: 'NEXT_PAGE' })}
            disabled={currentPage >= totalPages - 1}
            style={{ padding: '2px 6px', fontSize: '11px' }}
          >
            ▶
          </button>
        </div>
      )}
    </div>
  )
}
