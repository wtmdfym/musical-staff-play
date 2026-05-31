import { usePractice } from '../../context/usePractice'

const VOICE_LABELS: Record<number, string> = {
  0: 'Voice 1', 1: 'Voice 2', 2: 'Voice 3', 3: 'Voice 4',
  4: 'Voice 5', 5: 'Voice 6', 6: 'Voice 7', 7: 'Voice 8',
}

export default function VoiceColorSettings() {
  const { state, dispatch } = usePractice()
  const { voiceColors } = state

  return (
    <div className="section-content">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((v) => (
        <div className="setting-row" key={v}>
          <label className="setting-label">{VOICE_LABELS[v]}</label>
          <input type="color" value={voiceColors[v] ?? '#111111'} onChange={(e) => dispatch({ type: 'SET_VOICE_COLOR', voice: v, color: e.target.value })} className="color-picker" />
        </div>
      ))}
    </div>
  )
}
