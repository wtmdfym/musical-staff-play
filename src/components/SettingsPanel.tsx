import { useState, useRef, useEffect } from 'react'
import { usePractice } from '../context/usePractice'
import { useMidi } from '../playback/useMidi'

const VOICE_LABELS: Record<number, string> = {
  0: 'Voice 1', 1: 'Voice 2', 2: 'Voice 3', 3: 'Voice 4',
  4: 'Voice 5', 5: 'Voice 6', 6: 'Voice 7', 7: 'Voice 8',
}

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

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = usePractice()
  const {
    zoom, displayMode, bpmOverrideEnabled, bpmOverride, speedRatio, measuresWindow,
    emptyMeasures, playheadRatio, voiceColors, score, highlightLeadBeats,
    highlightRange,
    verovioPageWidth, verovioPageHeight, verovioStaffSpacing, verovioNoteSpacing,
    logicFps, renderFps,
    midiEnabled, midiDeviceId,
    highlightMode,
  } = state
  const defaultBpm = score?.bpm ?? 60
  const [bpmInput, setBpmInput] = useState(String(bpmOverride || defaultBpm))
  const bpmRef = useRef<HTMLInputElement>(null)
  const { devices: midiDevices, status: midiStatus, isAccessGranted: midiAccessGranted, connect: midiConnect } = useMidi()

  useEffect(() => {
    if (midiDeviceId && !midiDevices.some((dev) => dev.id === midiDeviceId)) {
      dispatch({ type: 'SET_MIDI_DEVICE_ID', deviceId: '' })
    }
  }, [midiDevices, midiDeviceId, dispatch])

  const handleMidiConnect = () => {
    midiConnect()
  }

  const commitBpm = () => {
    const val = parseInt(bpmInput, 10)
    if (isNaN(val) || val < 1) {
      setBpmInput(String(bpmOverride || defaultBpm))
      return
    }
    const clamped = Math.max(20, Math.min(300, val))
    dispatch({ type: 'SET_BPM', bpm: clamped })
    if (clamped !== val) setBpmInput(String(clamped))
  }

  const resetDefaults = () => {
    dispatch({ type: 'SET_ZOOM', zoom: 1 })
    dispatch({ type: 'SET_DISPLAY_MODE', mode: 'page' })
    dispatch({ type: 'SET_BPM_OVERRIDE_ENABLED', enabled: false })
    dispatch({ type: 'SET_BPM', bpm: 0 })
    dispatch({ type: 'SET_SPEED_RATIO', ratio: 1 })
    dispatch({ type: 'SET_MEASURES_WINDOW', count: 4 })
    dispatch({ type: 'SET_EMPTY_MEASURES', count: 2 })
    dispatch({ type: 'SET_PLAYHEAD_RATIO', ratio: 0.25 })
    dispatch({ type: 'SET_HIGHLIGHT_LEAD', beats: 0.5 })
    dispatch({ type: 'SET_HIGHLIGHT_RANGE', count: 2 })
    dispatch({ type: 'SET_LOGIC_FPS', fps: 60 })
    dispatch({ type: 'SET_RENDER_FPS', fps: 60 })
    dispatch({ type: 'SET_VEROVIO_PAGE_WIDTH', width: 2100 })
    dispatch({ type: 'SET_VEROVIO_PAGE_HEIGHT', height: 2970 })
    dispatch({ type: 'SET_VEROVIO_STAFF_SPACING', spacing: 12 })
    dispatch({ type: 'SET_VEROVIO_NOTE_SPACING', spacing: 0.25 })
    dispatch({ type: 'SET_MIDI_ENABLED', enabled: false })
    dispatch({ type: 'SET_MIDI_DEVICE_ID', deviceId: '' })
    setBpmInput(String(defaultBpm))
  }

  const deviceSelectDisabled = midiDevices.length === 0 || midiStatus === 'unavailable'

  const connectBtnText =
    midiStatus === 'connected'
      ? 'Refresh Devices'
      : midiAccessGranted
      ? 'Re‑request Access'
      : 'Connect MIDI'

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="ctrl-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <h3>视图</h3>
            <div className="setting-row">
              <label className="setting-label">Display Mode</label>
              <div className="setting-options">
                <button
                  className={`ctrl-btn ${displayMode === 'page' ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_DISPLAY_MODE', mode: 'page' })}
                >
                  Page
                </button>
                <button
                  className={`ctrl-btn ${displayMode === 'scroll' ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_DISPLAY_MODE', mode: 'scroll' })}
                >
                  Scroll
                </button>
              </div>
            </div>

            <div className="setting-row">
              <label className="setting-label">Zoom</label>
              <input
                type="range" min="0.25" max="3" step="0.05"
                value={zoom}
                onChange={(e) => dispatch({ type: 'SET_ZOOM', zoom: parseFloat(e.target.value) })}
                className="zoom-slider"
              />
              <span className="setting-value">{Math.round(zoom * 100)}%</span>
            </div>

            <div className="setting-row">
              <label className="setting-label">Highlight</label>
              <div className="setting-options">
                <button
                  className={`ctrl-btn ${highlightMode === 'color' ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_HIGHLIGHT_MODE', mode: 'color' })}
                >
                  Color
                </button>
                <button
                  className={`ctrl-btn ${highlightMode === 'box' ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_HIGHLIGHT_MODE', mode: 'box' })}
                >
                  Box
                </button>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>演奏</h3>
            <div className="setting-row">
              <label className="setting-label">Override Tempo</label>
              <input
                type="checkbox"
                checked={bpmOverrideEnabled}
                onChange={(e) => dispatch({ type: 'SET_BPM_OVERRIDE_ENABLED', enabled: e.target.checked })}
              />
            </div>
            {bpmOverrideEnabled ? (
              <div className="setting-row">
                <label className="setting-label">Fixed BPM</label>
                <input
                  ref={bpmRef}
                  type="number" min="1" max="999"
                  value={bpmInput}
                  onChange={(e) => setBpmInput(e.target.value)}
                  onBlur={commitBpm}
                  onKeyDown={(e) => { if (e.key === 'Enter') bpmRef.current?.blur() }}
                  className="setting-number bpm-input"
                />
                <button className="ctrl-btn reset-btn" onClick={() => { dispatch({ type: 'SET_BPM', bpm: 0 }); setBpmInput(String(defaultBpm)) }} title="Reset to score BPM">↺</button>
              </div>
            ) : (
              <div className="setting-row">
                <label className="setting-label">Speed Ratio</label>
                <input type="range" min="0.25" max="4" step="0.05" value={speedRatio}
                  onChange={(e) => dispatch({ type: 'SET_SPEED_RATIO', ratio: parseFloat(e.target.value) })}
                  className="zoom-slider" />
                <span className="setting-value">{Math.round(speedRatio * 100)}%</span>
              </div>
            )}

            <div className="setting-row">
              <label className="setting-label">Judgment Line</label>
              <input type="range" min="0.1" max="0.5" step="0.01" value={playheadRatio}
                onChange={(e) => dispatch({ type: 'SET_PLAYHEAD_RATIO', ratio: parseFloat(e.target.value) })}
                className="zoom-slider" />
              <span className="setting-value">{Math.round(playheadRatio * 100)}%</span>
            </div>

            <div className="setting-row">
              <label className="setting-label">Window</label>
              <select value={measuresWindow} onChange={(e) => dispatch({ type: 'SET_MEASURES_WINDOW', count: parseInt(e.target.value) })} className="setting-select">
                {[2, 3, 4, 5, 6, 8, 12, 16].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="setting-row">
              <label className="setting-label">Lead</label>
              <select value={emptyMeasures} onChange={(e) => dispatch({ type: 'SET_EMPTY_MEASURES', count: parseInt(e.target.value) })} className="setting-select">
                {[0, 1, 2, 4, 8].map((n) => <option key={n} value={n}>{n === 0 ? 'None' : `${n}m`}</option>)}
              </select>
            </div>

            <div className="setting-row">
              <label className="setting-label">Highlight Lead</label>
              <input type="range" min="0.1" max="2" step="0.1" value={highlightLeadBeats}
                onChange={(e) => dispatch({ type: 'SET_HIGHLIGHT_LEAD', beats: parseFloat(e.target.value) })}
                className="zoom-slider" />
              <span className="setting-value">{highlightLeadBeats.toFixed(1)}b</span>
            </div>

            <div className="setting-row">
              <label className="setting-label">Highlight Range</label>
              <select value={highlightRange} onChange={(e) => dispatch({ type: 'SET_HIGHLIGHT_RANGE', count: parseInt(e.target.value) })} className="setting-select">
                {[1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n} columns</option>)}
              </select>
            </div>
          </div>

          <div className="settings-section">
            <h3>布局</h3>
            <div className="setting-row">
              <label className="setting-label">Page Width</label>
              <input type="range" min="500" max="5000" step="100" value={verovioPageWidth}
                onChange={(e) => dispatch({ type: 'SET_VEROVIO_PAGE_WIDTH', width: parseInt(e.target.value) })}
                className="zoom-slider" />
              <span className="setting-value">{verovioPageWidth}</span>
            </div>
            <div className="setting-row">
              <label className="setting-label">Page Height</label>
              <input type="range" min="500" max="6000" step="100" value={verovioPageHeight}
                onChange={(e) => dispatch({ type: 'SET_VEROVIO_PAGE_HEIGHT', height: parseInt(e.target.value) })}
                className="zoom-slider" />
              <span className="setting-value">{verovioPageHeight}</span>
            </div>
            <div className="setting-row">
              <label className="setting-label">Staff Spacing</label>
              <input type="range" min="0" max="48" step="1" value={verovioStaffSpacing}
                onChange={(e) => dispatch({ type: 'SET_VEROVIO_STAFF_SPACING', spacing: parseInt(e.target.value) })}
                className="zoom-slider" />
              <span className="setting-value">{verovioStaffSpacing}</span>
            </div>
            <div className="setting-row">
              <label className="setting-label">Note Spacing</label>
              <input type="range" min="0" max="1" step="0.05" value={verovioNoteSpacing}
                onChange={(e) => dispatch({ type: 'SET_VEROVIO_NOTE_SPACING', spacing: parseFloat(e.target.value) })}
                className="zoom-slider" />
              <span className="setting-value">{verovioNoteSpacing.toFixed(2)}</span>
            </div>
          </div>

          <div className="settings-section">
            <h3>性能</h3>
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

          <div className="settings-section">
            <h3>MIDI</h3>
            <div className="setting-row">
              <label className="setting-label">Enable MIDI</label>
              <input
                type="checkbox"
                checked={midiEnabled}
                onChange={(e) => dispatch({ type: 'SET_MIDI_ENABLED', enabled: e.target.checked })}
              />
              <span className={`midi-status-dot ${midiStatus}`} />
              <span className="setting-value midi-status-text">
                {midiStatus === 'unavailable' ? 'Unavailable' :
                 midiStatus === 'denied' ? 'Denied' :
                 midiStatus === 'connecting' ? 'Connecting...' :
                 midiStatus === 'connected' ? 'Connected' :
                 'Disconnected'}
              </span>
            </div>
            <div className="setting-row">
              <label className="setting-label">Device</label>
              <select
                value={midiDeviceId}
                onChange={(e) => dispatch({ type: 'SET_MIDI_DEVICE_ID', deviceId: e.target.value })}
                className="setting-select"
                disabled={deviceSelectDisabled}
              >
                <option value="">Auto</option>
                {midiDevices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="setting-row">
              <button
                className="ctrl-btn"
                onClick={handleMidiConnect}
                disabled={midiStatus === 'connecting' || midiStatus === 'unavailable'}
              >
                {connectBtnText}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>声部颜色</h3>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((v) => (
              <div className="setting-row" key={v}>
                <label className="setting-label">{VOICE_LABELS[v]}</label>
                <input
                  type="color"
                  value={voiceColors[v] ?? '#111111'}
                  onChange={(e) => dispatch({ type: 'SET_VOICE_COLOR', voice: v, color: e.target.value })}
                  className="color-picker"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="settings-footer">
          <button className="ctrl-btn" onClick={resetDefaults}>Reset Defaults</button>
        </div>
      </div>
    </div>
  )
}
