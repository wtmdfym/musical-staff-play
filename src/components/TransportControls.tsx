import { usePractice } from '../context/usePractice'
import { useMidi } from '../playback/useMidi'

export default function TransportControls() {
  const { state, dispatch } = usePractice()
  const { playState, midiEnabled } = state
  const { status: midiStatus, connect: midiConnect } = useMidi()

  const isPlaying = playState === 'playing'

  const handlePlay = async () => {
    if (midiEnabled && (midiStatus === 'disconnected' || midiStatus === 'denied')) {
      await midiConnect()
    }
    dispatch({ type: 'PLAY' })
  }

  return (
    <div className="transport-controls">
      <button
        className="ctrl-btn transport-btn"
        onClick={() => dispatch({ type: 'RESTART' })}
        title="Return to start"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
        </svg>
      </button>

      {isPlaying ? (
        <button
          className="ctrl-btn transport-btn play-btn"
          onClick={() => dispatch({ type: 'PAUSE' })}
          title="Pause"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        </button>
      ) : (
        <button
          className="ctrl-btn transport-btn play-btn"
          onClick={handlePlay}
          title="Play"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      )}

      <button
        className="ctrl-btn transport-btn"
        onClick={() => dispatch({ type: 'STOP' })}
        title="Stop"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" />
        </svg>
      </button>
    </div>
  )
}
