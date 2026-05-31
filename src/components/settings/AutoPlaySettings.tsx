import { usePractice } from '../../context/usePractice'

export default function AutoPlaySettings() {
  const { state, dispatch } = usePractice()
  const { autoPlayVolume, autoPlayDelay } = state

  return (
    <div className="section-content">
      <div className="setting-row">
        <label className="setting-label">Volume</label>
        <input type="range" min="1" max="100" step="1" value={autoPlayVolume} onChange={(e) => dispatch({ type: 'SET_AUTO_PLAY_VOLUME', volume: parseInt(e.target.value) })} className="zoom-slider" />
        <span className="setting-value">{autoPlayVolume}%</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Delay</label>
        <input type="range" min="-500" max="500" step="10" value={autoPlayDelay} onChange={(e) => dispatch({ type: 'SET_AUTO_PLAY_DELAY', delay: parseInt(e.target.value) })} className="zoom-slider" />
        <span className="setting-value">{autoPlayDelay}ms</span>
      </div>
    </div>
  )
}
