import { usePractice } from '../../context/usePractice'
import { useMidi } from '../../playback/useMidi'

export default function MidiSettings() {
  const { state, dispatch } = usePractice()
  const { midiEnabled, midiDeviceId } = state
  const { devices: midiDevices, status: midiStatus, statusLabel, isAccessGranted: midiAccessGranted, connect: midiConnect } = useMidi()

  const deviceSelectDisabled = midiDevices.length === 0 || midiStatus === 'unavailable'

  const connectBtnText =
    midiStatus === 'connected'
      ? 'Refresh Devices'
      : midiAccessGranted
      ? 'Re-request Access'
      : 'Connect MIDI'

  return (
    <div className="section-content">
      <div className="setting-row">
        <label className="setting-label">Enable MIDI</label>
        <input type="checkbox" checked={midiEnabled} onChange={(e) => dispatch({ type: 'SET_MIDI_ENABLED', enabled: e.target.checked })} />
        <span className={`midi-status-dot ${midiStatus}`} />
        <span className="setting-value midi-status-text">{statusLabel}</span>
      </div>
      <div className="setting-row">
        <label className="setting-label">Device</label>
        <select value={midiDeviceId} onChange={(e) => dispatch({ type: 'SET_MIDI_DEVICE_ID', deviceId: e.target.value })} className="setting-select" disabled={deviceSelectDisabled}>
          <option value="">Auto</option>
          {midiDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="setting-row">
        <button className="ctrl-btn" onClick={() => midiConnect()} disabled={midiStatus === 'connecting' || midiStatus === 'unavailable'}>
          {connectBtnText}
        </button>
      </div>
    </div>
  )
}
