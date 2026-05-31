import { usePractice } from '../../context/usePractice'

const FPS_OPTIONS = [
  { value: 0, label: 'Unlimited' },
  { value: 15, label: '15' },
  { value: 30, label: '30' },
  { value: 60, label: '60' },
  { value: 120, label: '120' },
]

const RENDER_FPS_OPTIONS = [
  { value: 0, label: 'Unlimited' },
  { value: 15, label: '15' },
  { value: 30, label: '30' },
  { value: 60, label: '60' },
]

export default function PerfSettings() {
  const { state, dispatch } = usePractice()
  const { logicFps, renderFps } = state

  return (
    <div className="section-content">
      <div className="setting-row">
        <label className="setting-label">Logic FPS</label>
        <select value={logicFps} onChange={(e) => dispatch({ type: 'SET_LOGIC_FPS', fps: parseInt(e.target.value) })} className="setting-select">
          {FPS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="setting-row">
        <label className="setting-label">Render FPS</label>
        <select value={renderFps} onChange={(e) => dispatch({ type: 'SET_RENDER_FPS', fps: parseInt(e.target.value) })} className="setting-select">
          {RENDER_FPS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  )
}
