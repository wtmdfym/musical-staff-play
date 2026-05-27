import { useRef, useEffect, useMemo, useState, memo } from "react"
import { usePractice } from "../context/usePractice"
import { getGameLoop } from "../core/GameLoop"
import { getVerovioRenderer } from "../renderer/VerovioEngine"
import type { PlaybackEventSink } from "../core/PlaybackEvents"

const glInstance = getGameLoop()

let _svgContentRecomputeCount = 0
let _setConfigCallCount = 0
let _domMutHitCount = 0

const SvgRenderer = memo(function SvgRenderer({ svgContent }: { svgContent: string | { svg: string; page: number }[] | null }) {
  if (svgContent === null) return null

  if (typeof svgContent === 'string') {
    return (
      <div
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    )
  }

  if (Array.isArray(svgContent)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {svgContent.map(({ svg, page }) => (
          <div
            key={page}
            style={{ width: '100%', flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ))}
      </div>
    )
  }

  return null
})

export default function ScoreView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgWrapRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)

  const { state, dispatch } = usePractice()
  const {
    displayMode,
    zoom,
    currentPage,
    score,
    playState,
    emptyMeasures,
    playheadRatio,
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
    totalPages,
    highlightMode,
    autoPlay,
    autoPlayVolume,
    autoPlayDelay,
    velocityJudgmentEnabled,
    pedalJudgmentEnabled,
    noteOffJudgmentEnabled,
  } = state

  const [vrvReady, setVrvReady] = useState(() => getVerovioRenderer().isReady)

  useEffect(() => {
    const eventSink: PlaybackEventSink = {
      emit(event) {
        switch (event.type) {
          case 'playback-ended':
            dispatch({ type: 'STOP' })
            break
          case 'scroll-offset-changed':
            dispatch({ type: 'SET_SCROLL_OFFSET', offset: event.offset })
            break
          case 'page-advance-requested':
            dispatch({ type: event.direction === 'next' ? 'NEXT_PAGE' : 'PREV_PAGE' })
            break
          case 'page-advanced':
            dispatch({ type: 'SET_PAGE', page: event.page })
            break
          case 'total-pages-changed':
            dispatch({ type: 'SET_TOTAL_PAGES', total: event.total })
            break
          case 'judgment-fired':
            dispatch({ type: 'JUDGE', result: event.result })
            break
        }
      }
    }
    glInstance.init(eventSink, {
      container: containerRef,
      svgWrap: svgWrapRef,
      playhead: playheadRef,
    })
    return () => {
      glInstance.destroy()
    }
  }, [dispatch])

  useEffect(() => {
    const vrv = getVerovioRenderer()
    if (!vrv.isReady) {
      let cancelled = false
      vrv.init().then(() => { if (!cancelled) setVrvReady(true) })
      return () => { cancelled = true }
    }
  }, [])

  useEffect(() => {
    if (!score || !rawDocument) return
    console.log(`[DEBUG-diagnose] loadScore called (rawDocument=${rawDocument.length} chars)`)
    glInstance.loadScore(score, rawDocument)
  }, [rawDocument, score])

  useEffect(() => {
    if (!rawDocument) return
    console.log(`[DEBUG-diagnose] applyLayout called (zoom=${zoom})`)
    glInstance.applyLayout({
      zoom,
      pageWidth: verovioPageWidth,
      pageHeight: verovioPageHeight,
      staffSpacing: verovioStaffSpacing,
      noteSpacing: verovioNoteSpacing,
    })
  }, [zoom, verovioPageWidth, verovioPageHeight, verovioStaffSpacing, verovioNoteSpacing, rawDocument])

  useEffect(() => {
    _setConfigCallCount++
    if (_setConfigCallCount <= 3 || _setConfigCallCount % 120 === 0) {
      console.log(`[DEBUG-diagnose] setConfig called #${_setConfigCallCount} (page=${currentPage}, scrollOffset=${state.scrollOffset})`)
    }
    glInstance.setConfig({
      displayMode,
      emptyMeasures,
      playheadRatio,
      highlightLeadBeats,
      highlightRange,
      midiEnabled,
      midiDeviceId,
      currentPage,
      bpmOverrideEnabled,
      bpmOverride,
      speedRatio,
      logicFps,
      renderFps,
      highlightMode,
      autoPlay,
      autoPlayVolume,
      autoPlayDelay,
      velocityJudgmentEnabled,
      pedalJudgmentEnabled,
      noteOffJudgmentEnabled,
    })
  })

  useEffect(() => {
    console.log(`[DEBUG-diagnose] playState → "${playState}"`)
    if (playState === 'playing') {
      glInstance.play()
    } else if (playState === 'paused') {
      glInstance.pause()
    } else if (playState === 'stopped') {
      glInstance.stop()
    }
  }, [playState])

  useEffect(() => {
    if (displayMode === 'page' && getVerovioRenderer().hasDocument) {
      console.log(`[DEBUG-diagnose] reapplyJudgments (page=${currentPage})`)
      glInstance.reapplyJudgments()
    }
  }, [currentPage, displayMode])

  const svgContent = useMemo(() => {
    _svgContentRecomputeCount++
    console.log(
      `[DEBUG-diagnose] svgContent recompute #${_svgContentRecomputeCount} ` +
      `(mode=${displayMode} page=${currentPage} totalPages=${totalPages} zoom=${zoom} rawDoc=${rawDocument ? rawDocument.length : 'null'})`
    )
    if (!getVerovioRenderer().hasDocument || !rawDocument) return null
    if (displayMode === 'page') {
      const pageNo = Math.min(currentPage + 1, Math.max(1, totalPages))
      return getVerovioRenderer().renderSVG(pageNo)
    } else {
      const svgs = getVerovioRenderer().renderAllSVGs()
      return svgs.map((s, i) => ({ svg: s, page: i + 1 }))
    }
  }, [rawDocument, displayMode, currentPage, totalPages, zoom])

  // DEBUG: MutationObserver to detect SVG DOM rebuilds
  useEffect(() => {
    const target = svgWrapRef.current
    if (!target) return
    const observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        if (mut.type === 'childList') {
          const added = mut.addedNodes.length
          const removed = mut.removedNodes.length
          if (added > 0 || removed > 0) {
            _domMutHitCount++
            const addedTags: string[] = []
            const removedTags: string[] = []
            mut.addedNodes.forEach(n => { if (n instanceof Element) addedTags.push(n.tagName) })
            mut.removedNodes.forEach(n => { if (n instanceof Element) removedTags.push(n.tagName) })
            console.log(
              `[DEBUG-diagnose] DOM MUTATION #${_domMutHitCount}: ` +
              `childList added=[${addedTags.join(',')}] removed=[${removedTags.join(',')}] ` +
              `target=<${(mut.target as Element).tagName?.toLowerCase()}>`
            )
          }
        }
      }
    })
    observer.observe(target, { childList: true, subtree: true })
    console.log('[DEBUG-diagnose] MutationObserver installed on svgWrap')
    return () => observer.disconnect()
  }, [rawDocument])

  const showPlaceholder = !rawDocument || !svgContent

  return (
    <div ref={containerRef} className="score-view-container" style={{ position: "relative", overflow: "hidden", background: "#fff" }}>
      {showPlaceholder && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "100%", color: "#999", fontSize: 14, userSelect: "none",
        }}>
          {vrvReady ? "Open a MusicXML or MEI file to begin" : "Loading Verovio..."}
        </div>
      )}

      {svgContent !== null && (
        <div
          ref={svgWrapRef}
          style={{
            position: "absolute",
            inset: 0,
            willChange: "transform",
          }}
        >
          <SvgRenderer svgContent={svgContent} />
        </div>
      )}

      <div
        ref={playheadRef}
        style={{
          position: "absolute",
          pointerEvents: "none",
          zIndex: 10,
          background: "#ef4444",
          display: "none",
        }}
      />

      {displayMode === "page" && totalPages > 0 && (
        <div style={{
          position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
          fontSize: 12, color: "#777", pointerEvents: "none",
        }}>
          {currentPage + 1} / {totalPages}
        </div>
      )}
    </div>
  )
}
