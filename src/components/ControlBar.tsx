import ScoreFileSelector from './ScoreFileSelector'
import TransportControls from './TransportControls'
import DisplaySettings from './DisplaySettings'
import PositionControls from './PositionControls'
import { usePractice } from '../context/usePractice'
import { useMidi } from '../playback/useMidi'

export default function ControlBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { state } = usePractice()
  const { midiEnabled } = state
  const { status: midiStatus, inputName: midiInputName, connect: midiConnect, close: midiClose } = useMidi()

  const handleMidiClick = async () => {
    if (midiStatus === 'connected') {
      midiClose()
    } else {
      await midiConnect()
    }
  }

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

      <div className="control-section">
        <DisplaySettings />
      </div>

      <div className="control-divider" />

      <div className="control-section">
        <PositionControls />
      </div>

      <div className="control-divider" />

      <div className="control-section">
        <button
          className="ctrl-btn midi-btn"
          onClick={handleMidiClick}
          title={midiStatus === 'connected' ? 'MIDI Connected - click to disconnect' :
                 midiStatus === 'connecting' ? 'Connecting MIDI...' :
                 midiStatus === 'denied' ? 'MIDI access denied' :
                 midiStatus === 'unavailable' ? 'MIDI not available' :
                 'Connect MIDI device'}
          disabled={midiStatus === 'unavailable' || midiStatus === 'connecting'}
        >
          <span className={`midi-status-dot ${midiStatus}`} />
          MIDI
        </button>
        {midiEnabled && midiStatus === 'connected' && (
          <span className="midi-device-name">{midiInputName || 'MIDI'}</span>
        )}
      </div>

      <div className="control-bar-status">
        <span className={`play-indicator ${state.playState}`} />
        {state.playState === 'playing' ? 'Playing' :
         state.playState === 'paused' ? 'Paused' : 'Ready'}
      </div>

      <div className="control-section">
        <button className="ctrl-btn" onClick={onOpenSettings} title="Settings">⚙</button>
      </div>
    </div>
  )
}
