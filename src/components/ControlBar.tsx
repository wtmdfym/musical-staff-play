import { useState, useRef, useCallback } from 'react'
import ScoreFileSelector from './ScoreFileSelector'
import TransportControls from './TransportControls'
import { usePractice } from '../context/usePractice'
import { useMidi } from '../playback/useMidi'
import { useFpsMonitor } from '../playback/useFpsMonitor'

export default function ControlBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { state, dispatch } = usePractice()
  const {
    displayMode, zoom, bpmOverrideEnabled, bpmOverride, speedRatio, score, playState,
  } = state
  const defaultBpm = score?.bpm ?? 60
  const { status: midiStatus, inputName: midiInputName } = useMidi()

  const [bpmInput, setBpmInput] = useState(String(bpmOverride || defaultBpm))
  const { logicFps, renderFps } = useFpsMonitor()
  const fpsDisplay = `${logicFps} / ${renderFps}`
  const bpmRef = useRef<HTMLInputElement>(null)

  const effectiveBpm = bpmOverrideEnabled
    ? (bpmOverride > 0 ? bpmOverride : defaultBpm)
    : Math.round(defaultBpm * speedRatio)

  const commitBpm = useCallback(() => {
    const val = parseInt(bpmInput, 10)
    if (isNaN(val) || val < 1) {
      setBpmInput(String(bpmOverride || defaultBpm))
      return
    }
    const clamped = Math.max(20, Math.min(300, val))
    dispatch({ type: 'SET_BPM', bpm: clamped })
    if (clamped !== val) setBpmInput(String(clamped))
  }, [bpmInput, bpmOverride, defaultBpm, dispatch])

  const midiLabel =
    midiStatus === 'unavailable' ? 'Unavailable' :
    midiStatus === 'denied' ? 'Denied' :
    midiStatus === 'connecting' ? 'Connecting...' :
    midiStatus === 'connected' ? (midiInputName || 'Connected') :
    'Disconnected'

  return (
    <div className="control-bar">
      <div className="control-section">
        <ScoreFileSelector />
      </div>

      <div className="control-divider" />

      <div className="control-section">
        <TransportControls />
      </div>

      <div className="control-divider" />

      <div className="control-section control-quick-settings">
        <div className="quick-setting-row">
          <button
            className={`mode-btn ${displayMode === 'page' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_DISPLAY_MODE', mode: 'page' })}
            title="Page Mode"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 12 8 8 12 12 16 8 20 12" />
              <polyline points="4 16 8 12 12 16 16 12 20 16" />
            </svg>
          </button>
        </div>

        <div className="quick-setting-row">
          <input
            type="range"
            min="0.25"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => dispatch({ type: 'SET_ZOOM', zoom: parseFloat(e.target.value) })}
            className="zoom-slider"
            title={`Zoom: ${Math.round(zoom * 100)}%`}
          />
          <span className="quick-value">{Math.round(zoom * 100)}%</span>
        </div>

        <div className="quick-setting-row quick-bpm-row">
          <label className="quick-toggle">
            <input
              type="checkbox"
              checked={bpmOverrideEnabled}
              onChange={(e) => dispatch({ type: 'SET_BPM_OVERRIDE_ENABLED', enabled: e.target.checked })}
            />
            <span className="quick-label">Fix</span>
          </label>
          {bpmOverrideEnabled ? (
            <>
              <input
                ref={bpmRef}
                type="number"
                min="1"
                max="999"
                value={bpmInput}
                onChange={(e) => setBpmInput(e.target.value)}
                onBlur={commitBpm}
                onKeyDown={(e) => { if (e.key === 'Enter') bpmRef.current?.blur() }}
                className="setting-number bpm-input"
                title="Fixed BPM"
              />
              <button
                className="ctrl-btn reset-btn"
                onClick={() => { dispatch({ type: 'SET_BPM', bpm: 0 }); setBpmInput(String(defaultBpm)) }}
                title="Reset to score BPM"
              >
                ↺
              </button>
            </>
          ) : (
            <>
              <input
                type="range"
                min="0.25"
                max="4"
                step="0.05"
                value={speedRatio}
                onChange={(e) => dispatch({ type: 'SET_SPEED_RATIO', ratio: parseFloat(e.target.value) })}
                className="zoom-slider"
                title={`Speed: ${Math.round(speedRatio * 100)}%`}
              />
              <span className="quick-value">{Math.round(speedRatio * 100)}%</span>
            </>
          )}
          <span className="quick-bpm-display">= {effectiveBpm} BPM</span>
        </div>
      </div>

      <div className="control-divider" />

      <div className="control-section control-status-section">
        <div className="status-item">
          <span className="status-label">FPS</span>
          <span className="status-value">{fpsDisplay}</span>
        </div>
        <div className="status-item">
          <span className={`midi-status-dot ${midiStatus}`} />
          <span className="status-value midi-status-text">{midiLabel}</span>
        </div>
      </div>

      <div className="control-bar-status">
        <span className={`play-indicator ${playState}`} />
        {playState === 'playing' ? 'Playing' :
         playState === 'paused' ? 'Paused' : 'Ready'}
      </div>

      <div className="control-section">
        <button className="ctrl-btn" onClick={onOpenSettings} title="Settings">⚙</button>
      </div>
    </div>
  )
}
