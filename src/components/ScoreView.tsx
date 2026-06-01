import { useRef, useEffect, useState, useCallback } from "react"
import { usePractice } from "../context/usePractice"
import { getGameLoop } from "../core/GameLoop"
import type { PlaybackEventSink } from "../core/PlaybackEvents"
import { ScoreRenderer } from "../renderer/ScoreRenderer"
import { parseFromXml } from "../score/MusicxmlParser"
import { getRecentFiles, addRecentFile } from "../data/recentFiles"
import { loadScoreFromFile } from "../score/loadScoreFile"
import ScrollTimeline from "./ScrollTimeline"
import PageTimeline from "./PageTimeline"

const glInstance = getGameLoop()

export default function ScoreView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<ScoreRenderer | null>(null)

  const { state, dispatch } = usePractice()
  const {
    displayMode,
    zoom,
    currentPage,
    score,
    playState,
    emptyMeasures,
    highlightLeadBeats,
    highlightRange,
    midiEnabled,
    midiDeviceId,
    rawDocument,
    verovioPageWidth,
    verovioPageHeight,
    verovioStaffSpacing,
    verovioNoteSpacing,
    bpmOverrideEnabled,
    bpmOverride,
    speedRatio,
    logicFps,
    renderFps,
    autoPlay,
    autoPlayVolume,
    autoPlayDelay,
    velocityJudgmentEnabled,
    pedalJudgmentEnabled,
    noteOffJudgmentEnabled,
    highlightPadX,
    highlightPadY,
    stats,
    layoutCommitVersion,
  } = state

  const [committedZoom, setCommittedZoom] = useState(zoom)
  const prevGlConfigKeyRef = useRef('')
  const prevRendererConfigKeyRef = useRef('')

  useEffect(() => {
    const eventSink: PlaybackEventSink = {
      emit(event) {
        switch (event.type) {
          case 'playback-ended':
            dispatch({ type: 'STOP' })
            rendererRef.current?.clearHighlights()
            rendererRef.current?.resetScroll()
            break
          case 'scroll-offset-changed':
            dispatch({ type: 'SET_SCROLL_OFFSET', offset: event.offset })
            break
          case 'judgment-fired': {
            dispatch({ type: 'JUDGE', result: event.result })
            const r = event.result
            const eventKey = `${r.measureIndex}:${r.staffIndex}:${r.noteIndex}`
            rendererRef.current?.showJudgment(eventKey, r.grade, r.type)
            break
          }
        }
      }
    }
    glInstance.init(eventSink)

    const renderer = new ScoreRenderer(glInstance)
    rendererRef.current = renderer

    if (containerRef.current) {
      renderer.init(containerRef.current, {
        onPageChange(page) {
          dispatch({ type: 'SET_PAGE', page })
        },
        onTotalPagesChange(total) {
          dispatch({ type: 'SET_TOTAL_PAGES', total })
        },
        onPageAdvanceRequested(dir) {
          dispatch({ type: dir === 'next' ? 'NEXT_PAGE' : 'PREV_PAGE' })
        },
      })
    }

    return () => {
      renderer.destroy()
      glInstance.destroy()
    }
  }, [dispatch])

  useEffect(() => {
    if (!score || !rawDocument) return
    glInstance.loadScore(score)
    rendererRef.current?.loadScore(rawDocument, {
      zoom,
      pageWidth: verovioPageWidth,
      pageHeight: verovioPageHeight,
      staffSpacing: verovioStaffSpacing,
      noteSpacing: verovioNoteSpacing,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutOpts read on trigger, not deps
  }, [rawDocument, score])

  useEffect(() => {
    if (!rawDocument) return
    rendererRef.current?.applyLayout({
      zoom,
      pageWidth: verovioPageWidth,
      pageHeight: verovioPageHeight,
      staffSpacing: verovioStaffSpacing,
      noteSpacing: verovioNoteSpacing,
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cache zoom at commit for visual scale
    setCommittedZoom(zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opts read on trigger, not deps
  }, [layoutCommitVersion])

  useEffect(() => {
    const key = `${emptyMeasures}|${midiEnabled}|${midiDeviceId}|${bpmOverrideEnabled}|${bpmOverride}|${speedRatio}|${logicFps}|${autoPlay}|${autoPlayVolume}|${autoPlayDelay}|${velocityJudgmentEnabled}|${pedalJudgmentEnabled}|${noteOffJudgmentEnabled}`
    if (key === prevGlConfigKeyRef.current) return
    prevGlConfigKeyRef.current = key
    glInstance.setConfig({
      emptyMeasures,
      midiEnabled,
      midiDeviceId,
      bpmOverrideEnabled,
      bpmOverride,
      speedRatio,
      logicFps,
      autoPlay,
      autoPlayVolume,
      autoPlayDelay,
      velocityJudgmentEnabled,
      pedalJudgmentEnabled,
      noteOffJudgmentEnabled,
    })
  }, [emptyMeasures, midiEnabled, midiDeviceId, bpmOverrideEnabled, bpmOverride, speedRatio, logicFps, autoPlay, autoPlayVolume, autoPlayDelay, velocityJudgmentEnabled, pedalJudgmentEnabled, noteOffJudgmentEnabled])

  useEffect(() => {
    const key = `${displayMode}|${currentPage}|${renderFps}|${highlightLeadBeats}|${highlightRange}|${highlightPadX}|${highlightPadY}`
    if (key === prevRendererConfigKeyRef.current) return
    prevRendererConfigKeyRef.current = key
    rendererRef.current?.setConfig({
      displayMode,
      currentPage,
      renderFps,
      highlightLeadBeats,
      highlightRange,
      highlightPadX,
      highlightPadY,
    })
  }, [displayMode, currentPage, renderFps, highlightLeadBeats, highlightRange, highlightPadX, highlightPadY])

  useEffect(() => {
    if (playState === 'playing') {
      glInstance.play()
      rendererRef.current?.clearHighlights()
    } else if (playState === 'paused') {
      glInstance.pause()
    } else if (playState === 'stopped') {
      glInstance.stop()
      rendererRef.current?.clearHighlights()
      rendererRef.current?.resetScroll()
    }
  }, [playState])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const recentFiles = getRecentFiles()

  const processFile = useCallback(async (file: File) => {
    try {
      const { xml, fileName, format } = await loadScoreFromFile(file)
      const score = parseFromXml(xml)
      addRecentFile(fileName)
      dispatch({ type: 'LOAD_SCORE', score, fileName, rawDocument: xml, documentFormat: format })
    } catch (err) {
      console.error('Score parse failed:', err)
    }
  }, [dispatch])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const totalJudged =
    stats.noteOn.perfect + stats.noteOn.great + stats.noteOn.good + stats.noteOn.miss

  const handleOpenHeatmap = useCallback(() => {
    if (totalJudged > 0) {
      dispatch({ type: 'SHOW_HEATMAP' })
    }
  }, [totalJudged, dispatch])

  const handleScrollTimelineClick = useCallback((beat: number) => {
    rendererRef.current?.scrollToPosition(beat)
  }, [])

  const showTimeline = score && score.measures.length > 0

  return (
    <>
    <div className="score-view-container" style={{ position: "relative", overflow: "hidden", background: "var(--score-bg, #faf9f6)" }}>
      <button
        className="heatmap-icon-btn"
        onClick={handleOpenHeatmap}
        disabled={totalJudged === 0}
        title={totalJudged > 0 ? '查看练习回顾' : '暂无统计'}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          border: 'none',
          borderRadius: 8,
          background: totalJudged > 0 ? 'var(--accent-bg)' : 'transparent',
          color: totalJudged > 0 ? 'var(--accent)' : 'var(--text)',
          cursor: totalJudged > 0 ? 'pointer' : 'default',
          opacity: totalJudged > 0 ? 1 : 0.3,
          transition: 'opacity 0.2s, background 0.2s',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>
      {!rawDocument && (
        <div
          className={`score-placeholder${dragOver ? ' dragover' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".musicxml,.mxl,.xml,.mei"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <div className="placeholder-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="5" r="2" />
              <circle cx="19" cy="5" r="2" />
              <circle cx="5" cy="19" r="2" />
              <line x1="12" y1="7" x2="5" y2="17" />
              <line x1="19" y1="7" x2="12" y2="17" />
            </svg>
          </div>
          <div className="placeholder-text">
            Drop a MusicXML file here or click to browse
          </div>
          <div className="placeholder-hint">
            Supports .musicxml, .mxl, .xml, .mei
          </div>
          {recentFiles.length > 0 && (
            <div className="placeholder-recent">
              <div className="recent-title">Recent</div>
              {recentFiles.map((f) => (
                <div key={`${f.name}-${f.timestamp}`} className="recent-item">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="recent-name">{f.name}</span>
                  <span className="recent-time" title={new Date(f.timestamp).toLocaleString()}>
                    {(() => {
                      const diff = Date.now() - f.timestamp
                      if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
                      if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
                      return `${Math.round(diff / 86400000)}d ago`
                    })()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${committedZoom > 0 ? zoom / committedZoom : 1})`,
          transformOrigin: "top left",
        }}
      >
        <div
          ref={containerRef}
          style={{ position: "absolute", inset: 0 }}
        />
      </div>
    </div>
    {showTimeline && (displayMode === 'page'
      ? <PageTimeline />
      : <ScrollTimeline onScrollToPosition={handleScrollTimelineClick} />
    )}
    </>
  )
}
