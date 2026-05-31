export default function FpsDisplay({ logicFps, renderFps }: { logicFps: number; renderFps: number }) {
  return (
    <span className="timeline-fps">
      <span className="stat-fps-label">L:</span>{logicFps}
      <span className="stat-fps-label"> R:</span>{renderFps}
    </span>
  )
}
