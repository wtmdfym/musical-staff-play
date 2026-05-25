import { usePractice } from '../context/usePractice'

export default function TopBar() {
  const { state } = usePractice()
  const { score } = state

  return (
    <div className="top-bar">
      <div className="top-bar-title">
        <span className="top-bar-icon">♪</span>
        <h1>Musical Staff Play</h1>
      </div>

      <div className="top-bar-info">
        {score && <span className="score-name">{score.title}</span>}
      </div>
    </div>
  )
}
