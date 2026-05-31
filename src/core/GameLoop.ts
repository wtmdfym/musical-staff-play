import type {
  PlayState,
  ScoreData,
  JudgmentResult,
} from "../score/ScoreTypes";
import { PlaybackDriver } from "./PlaybackDriver";
import { EventRegistry } from "./EventRegistry";
import { NoteInputPipeline } from "./NoteInputPipeline";
import { ViewportPositioner } from "./ViewportPositioner";
import type { PlaybackEventSink } from "./PlaybackEvents";
import type { VerovioLayoutOptions } from "../renderer/VerovioEngine";
import { TempoClock } from "../playback/TempoClock";
import { JudgmentEngine } from "../playback/JudgmentEngine";
import { AutoPlayer } from "../playback/AutoPlayer";
import { JudgmentDisplay } from "../feedback/JudgmentDisplay";
import {
  DomHighlightRenderer,
  type HighlightRenderer,
} from "../feedback/HighlightRenderer";
import { BoxHighlightRenderer } from "../feedback/BoxHighlightRenderer";
import { getOverlayManager } from "../feedback/OverlayManager";
import {
  getVerovioRenderer,
  type VerovioRenderer,
} from "../renderer/VerovioEngine";
import { VerovioScoreToSvgMapper } from "../renderer/ScoreToSvgMapper";
import { getMidiInputManager } from "../playback/MidiInputManager";
import type { DisplayMode } from '../score/ScoreTypes'

export interface GameLoopConfig {
  displayMode: DisplayMode;
  emptyMeasures: number;
  highlightLeadBeats: number;
  highlightRange: number;
  midiEnabled: boolean;
  midiDeviceId: string;
  currentPage: number;
  bpmOverrideEnabled: boolean;
  bpmOverride: number;
  speedRatio: number;
  logicFps: number;
  renderFps: number;
  highlightMode: 'color' | 'box';
  autoPlay: boolean;
  autoPlayVolume: number;
  autoPlayDelay: number;
  velocityJudgmentEnabled: boolean;
  pedalJudgmentEnabled: boolean;
  noteOffJudgmentEnabled: boolean;
}

export interface GameLoopDomRefs {
  container: { current: HTMLDivElement | null };
  svgWrap: { current: HTMLDivElement | null };
}

export class GameLoop {
  private _playbackDriver = new PlaybackDriver();
  private _tempoClock = new TempoClock();
  private _eventRegistry = new EventRegistry();
  private _viewportPositioner = new ViewportPositioner();

  private _logicInterval: ReturnType<typeof setInterval> | null = null;
  private _rafId = 0;
  private _lastRenderTime = 0;
  private _lastLogicDispatch = -1;

  private _logicFrameTimes: number[] = [];
  private _renderFrameTimes: number[] = [];
  logicFpsActual = 60;
  renderFpsActual = 60;
  private _lastLogicTickTime = 0;

  private _score: ScoreData | null = null;
  private _rawDocument: string | null = null;
  private _emptyBeats = 0;
  private _totalWithEmpty = 0;
  private _vrvPageCount = 0;

  private _je = new JudgmentEngine();
  private _autoPlayer = new AutoPlayer();
  private _vrv: VerovioRenderer;
  private _pipeline: NoteInputPipeline;
  private _jd = new JudgmentDisplay();

  private _eventSink: PlaybackEventSink | null = null;
  private _pendingLayoutOpts: VerovioLayoutOptions | null = null;
  private _config: GameLoopConfig = {
    displayMode: "page",
    emptyMeasures: 2,
    highlightLeadBeats: 0.5,
    highlightRange: 2,
    midiEnabled: false,
    midiDeviceId: "",
    currentPage: 0,
    bpmOverrideEnabled: false,
    bpmOverride: 0,
    speedRatio: 1,
    logicFps: 60,
    renderFps: 60,
    highlightMode: 'color',
    autoPlay: false,
    autoPlayVolume: 30,
    autoPlayDelay: 0,
    velocityJudgmentEnabled: false,
    pedalJudgmentEnabled: false,
    noteOffJudgmentEnabled: false,
  };

  private _highlightRenderer: HighlightRenderer = new DomHighlightRenderer();
  private _boxRenderer: BoxHighlightRenderer | null = null;

  private _renderTickCount = 0;
  private _doRenderCount = 0;
  private _logicTickCount = 0;
  private _highlightUpdateCount = 0;
  private _pageAdvanceCount = 0;
  private _pageNavHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this._vrv = getVerovioRenderer();
    this._pipeline = new NoteInputPipeline(
      getMidiInputManager(),
      this._playbackDriver,
      this._je,
      this._autoPlayer,
    );
  }

  get state(): PlayState {
    return this._playbackDriver.state;
  }

  init(
    eventSink: PlaybackEventSink,
    domRefs: GameLoopDomRefs,
  ): void {
    this._eventSink = eventSink;
    this._viewportPositioner.bind(domRefs);

    getOverlayManager().bind(domRefs.svgWrap);
    this._boxRenderer = new BoxHighlightRenderer();
    this._syncHighlightRenderer();

    this._pipeline.setDisplayMode(this._config.displayMode);
    this._pipeline.attachKeyboard();
    this._attachPageNav();

    this._je.onJudgment = (result: JudgmentResult) => {
      const key = `${result.measureIndex}:${result.staffIndex}:${result.noteIndex}`
      this._eventSink?.emit({ type: 'judgment-fired', result })
      const svgId = this._eventRegistry.get(key)?.svgId
      console.log(`[DEBUG-judge] type=${result.type} key=${key} beat=${result.beat.toFixed(3)} svgId=${svgId}`)
      if (svgId) {
        this._jd.show(svgId, result.grade, result.type)
      }
    }

    this._scheduleRender();
  }

  destroy(): void {
    this.stop();
    this._pipeline.detachKeyboard();
    this._detachPageNav();
    this._viewportPositioner.unbind();
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
    this._autoPlayer.reset();
    this._jd.clear();
    getOverlayManager().unbind();
    this._eventSink = null;
  }

  private _attachPageNav(): void {
    if (this._pageNavHandler) return
    this._pageNavHandler = (e: KeyboardEvent) => {
      if (this._config.displayMode !== 'page') return
      if (this._playbackDriver.state === 'playing') return
      if (e.key === 'ArrowRight') {
        this._eventSink?.emit({ type: 'page-advance-requested', direction: 'next' })
        e.preventDefault()
      } else if (e.key === 'ArrowLeft') {
        this._eventSink?.emit({ type: 'page-advance-requested', direction: 'prev' })
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', this._pageNavHandler)
  }

  private _detachPageNav(): void {
    if (this._pageNavHandler) {
      window.removeEventListener('keydown', this._pageNavHandler)
      this._pageNavHandler = null
    }
  }

  setConfig(partial: Partial<GameLoopConfig>): void {
    const prev = this._config;
    Object.assign(this._config, partial);
    this._applyConfigEffects(partial, prev);
  }

  private _applyConfigEffects(partial: Partial<GameLoopConfig>, prev: GameLoopConfig): void {
    // AutoPlay
    if (partial.autoPlay !== undefined && this._config.autoPlay) {
      this._autoPlayer.initAudio();
    }
    if (partial.autoPlayVolume !== undefined) {
      this._autoPlayer.setVolume(this._config.autoPlayVolume);
    }
    if (partial.autoPlayDelay !== undefined) {
      this._autoPlayer.setDelay(this._config.autoPlayDelay);
    }

    // Highlight mode
    if (partial.highlightMode !== undefined && partial.highlightMode !== prev.highlightMode) {
      this._syncHighlightRenderer();
    }

    // Display mode
    if (partial.displayMode !== undefined && partial.displayMode !== prev.displayMode) {
      this._pipeline.setDisplayMode(this._config.displayMode);
    }

    // BPM / tempo
    if (this._score && (
      partial.bpmOverrideEnabled !== undefined ||
      partial.bpmOverride !== undefined ||
      partial.speedRatio !== undefined
    )) {
      this._tempoClock.configure(
        this._score.tempoMap,
        this._config.bpmOverrideEnabled,
        this._config.bpmOverride,
        this._config.speedRatio,
      );
      this._eventRegistry.updateTimes(this._tempoClock);
    }

    // Logic/render FPS
    if (this._playbackDriver.state === "playing" && (
      (partial.logicFps !== undefined && partial.logicFps !== prev.logicFps) ||
      (partial.renderFps !== undefined && partial.renderFps !== prev.renderFps)
    )) {
      this._restartLogicInterval();
    }

    // MIDI
    if (
      (partial.midiEnabled !== undefined && partial.midiEnabled !== prev.midiEnabled) ||
      (partial.midiDeviceId !== undefined && partial.midiDeviceId !== prev.midiDeviceId)
    ) {
      this._pipeline.syncMidi(this._config.midiEnabled, this._config.midiDeviceId);
    }

    // Empty measures
    if (this._score && partial.emptyMeasures !== undefined && partial.emptyMeasures !== prev.emptyMeasures) {
      const timeSigBeat = this._score.measures[0]?.timeSignature[0] ?? 4;
      this._emptyBeats = this._config.emptyMeasures * timeSigBeat;
      this._totalWithEmpty = this._score.totalBeats + this._emptyBeats;
    }
  }

  loadScore(score: ScoreData, rawDocument: string, layoutOpts?: VerovioLayoutOptions): void {
    this._score = score;
    this._rawDocument = rawDocument;
    this._pendingLayoutOpts = layoutOpts ?? null;
    this._tempoClock.configure(
      score.tempoMap,
      this._config.bpmOverrideEnabled,
      this._config.bpmOverride,
      this._config.speedRatio,
    );
    this._eventRegistry.build(score, this._tempoClock);
    this._je.setRegistry(this._eventRegistry);
    this._je.setPedalEvents(score.pedalEvents, (beat) => this._tempoClock.beatToTime(beat));

    const timeSigBeat = score.measures[0]?.timeSignature[0] ?? 4;
    this._emptyBeats = this._config.emptyMeasures * timeSigBeat;
    this._totalWithEmpty = score.totalBeats + this._emptyBeats;

    this._loadVerovio();
  }

  private _loadVerovio(): void {
    if (!this._rawDocument) return;

    if (!this._vrv.isReady) {
      this._vrv.init().then(() => {
        this._doLoadVerovio();
      });
    } else {
      this._doLoadVerovio();
    }
  }

  private _doLoadVerovio(): void {
    if (!this._rawDocument) return;
    const ok = this._vrv.loadScore(this._rawDocument);
    if (ok) {
      if (this._pendingLayoutOpts) {
        this._vrv.applyLayout(this._pendingLayoutOpts);
        this._pendingLayoutOpts = null;
      }
      this._vrvPageCount = this._vrv.pageCount;
      this._eventSink?.emit({ type: 'total-pages-changed', total: this._vrvPageCount });
      if (this._config.currentPage >= this._vrvPageCount) {
        this._eventSink?.emit({
          type: 'page-advanced',
          page: Math.max(0, this._vrvPageCount - 1),
        });
      }
      this._buildFlatEventSvgIds();
    }
  }

  applyLayout(opts: VerovioLayoutOptions): void {
    if (!this._vrv.hasDocument || !this._rawDocument) return;
    this._vrv.applyLayout(opts);
    this._vrvPageCount = this._vrv.pageCount;
    this._eventSink?.emit({ type: 'total-pages-changed', total: this._vrvPageCount });
  }

  reapplyJudgments(): void {
    this._jd.applyToPage();
  }

  private _buildFlatEventSvgIds(): void {
    if (this._eventRegistry.count === 0 || !this._score) return

    const mapper = new VerovioScoreToSvgMapper()
    const svgIdMap = mapper.build(
      this._eventRegistry.all.map(e => ({
        measureIndex: e.measureIndex,
        staffIndex: e.staffIndex,
        noteIndex: e.noteIndex,
        time: e.event.time,
        pitch: e.event.pitch,
        voice: e.event.voice,
      })),
      this._vrv,
    )

    this._eventRegistry.applySvgIds(svgIdMap)
  }

  private _syncHighlightRenderer(): void {
    this._highlightRenderer.clear();
    if (this._config.highlightMode === 'box' && this._boxRenderer) {
      this._highlightRenderer = this._boxRenderer;
    } else {
      this._highlightRenderer = new DomHighlightRenderer();
    }
  }

  private _computeFps(): void {
    if (this._logicFrameTimes.length >= 2) {
      const sum = this._logicFrameTimes.reduce((a, b) => a + b, 0);
      this.logicFpsActual = Math.round(
        1000 / (sum / this._logicFrameTimes.length),
      );
    }
    if (this._renderFrameTimes.length >= 2) {
      const sum = this._renderFrameTimes.reduce((a, b) => a + b, 0);
      this.renderFpsActual = Math.round(
        1000 / (sum / this._renderFrameTimes.length),
      );
    }
  }

  play(): void {
    if (!this._playbackDriver.play()) return;
    this._je.reset(this._tempoClock.beatToTime(this._emptyBeats));
    this._lastLogicDispatch = -1;

    this._clearHighlights();
    this._startLogicInterval();

    if (this._config.autoPlay) {
      this._autoPlayer.start();
    }

    this._pipeline.syncMidi(this._config.midiEnabled, this._config.midiDeviceId);
  }

  pause(): void {
    if (!this._playbackDriver.pause()) return;
    this._stopLogicInterval();
    this._pipeline.closeMidi();
  }

  stop(): void {
    console.log(
      `[DEBUG-diagnose] STOP SUMMARY: ` +
        `_renderTicks=${this._renderTickCount} ` +
        `_doRenders=${this._doRenderCount} ` +
        `_logicTicks=${this._logicTickCount} ` +
        `_highlightUpdates=${this._highlightUpdateCount} ` +
        `_pageAdvances=${this._pageAdvanceCount}`,
    );
    this._renderTickCount = 0;
    this._doRenderCount = 0;
    this._logicTickCount = 0;
    this._highlightUpdateCount = 0;
    this._pageAdvanceCount = 0;
    this._playbackDriver.stop();
    this._stopLogicInterval();
    this._lastLogicDispatch = -1;

    this._clearHighlights();
    this._viewportPositioner.resetScroll();
    this._pipeline.closeMidi();
    this._autoPlayer.stop();
  }

  seekToBeat(beat: number): void {
    this._playbackDriver.seekToBeat(beat, this._tempoClock);
  }

  private _startLogicInterval(): void {
    this._stopLogicInterval();
    const fps = this._config.logicFps;
    const ms = fps <= 0 ? 0 : Math.round(1000 / fps);
    this._logicInterval = setInterval(() => this._logicTick(), ms);
    this._lastLogicTickTime = 0;
  }

  private _stopLogicInterval(): void {
    if (this._logicInterval !== null) {
      clearInterval(this._logicInterval);
      this._logicInterval = null;
    }
  }

  private _restartLogicInterval(): void {
    if (this._logicInterval !== null) {
      this._startLogicInterval();
    }
  }

  private _tickTiming(): void {
    this._logicTickCount++;
    const now = performance.now();
    if (this._lastLogicTickTime > 0) {
      this._logicFrameTimes.push(now - this._lastLogicTickTime);
      if (this._logicFrameTimes.length > 30) this._logicFrameTimes.shift();
    }
    this._lastLogicTickTime = now;
    this._computeFps();
  }

  private _tickContext(): { elapsed: number; beat: number; displayBeat: number; totalBeats: number; isEnded: boolean } {
    const elapsed = this._playbackDriver.elapsed;
    const beat = this._tempoClock.timeToBeat(elapsed);
    const displayBeat = beat - this._emptyBeats;
    const totalBeats = this._score!.totalBeats;
    const isEnded = displayBeat >= totalBeats;
    return { elapsed, beat, displayBeat, totalBeats, isEnded };
  }

  private _tickJudgment(elapsed: number): void {
    if (this._config.autoPlay && this._autoPlayer.active) {
      this._autoPlayer.scheduleTick(this._eventRegistry.all, this._tempoClock, this._emptyBeats);
    } else {
      this._je.checkMissed(elapsed);
    }
  }

  private _tickScrollEmit(beat: number): void {
    if (Math.abs(beat - this._lastLogicDispatch) > 0.01) {
      this._lastLogicDispatch = beat;
      if (this._logicTickCount <= 3 || this._logicTickCount % 60 === 0) {
        console.log(
          `[DEBUG-diagnose] _logicTick #${this._logicTickCount} dispatching SET_SCROLL_OFFSET beat=${beat.toFixed(2)}`,
        );
      }
      this._eventSink?.emit({ type: 'scroll-offset-changed', offset: beat });
    }
  }

  private _logicTick(): void {
    if (this._playbackDriver.state !== "playing") return;
    if (!this._score) return;

    this._tickTiming();
    const ctx = this._tickContext();
    if (ctx.isEnded) {
      this._eventSink?.emit({ type: 'playback-ended' });
      return;
    }
    this._tickJudgment(ctx.elapsed);
    this._tickScrollEmit(ctx.beat);
  }

  private _scheduleRender(): void {
    this._rafId = requestAnimationFrame(() => this._renderTick());
  }

  private _renderTick(): void {
    if (!this._eventSink) return;

    this._renderTickCount++;
    const renderFps = this._config.renderFps;
    let shouldRender = true;
    if (renderFps > 0) {
      const now = performance.now();
      if (now - this._lastRenderTime < 1000 / renderFps) {
        shouldRender = false;
      }
    }

    if (this._renderTickCount <= 5 || this._renderTickCount % 120 === 0) {
      console.log(
        `[DEBUG-diagnose] _renderTick #${this._renderTickCount} shouldRender=${shouldRender} renderFps=${renderFps}`,
      );
    }

    if (shouldRender) {
      this._doRenderCount++;
      const now = performance.now();
      if (this._lastRenderTime > 0) {
        this._renderFrameTimes.push(now - this._lastRenderTime);
        if (this._renderFrameTimes.length > 30) this._renderFrameTimes.shift();
      }
      this._lastRenderTime = now;
      this._computeFps();
      this._doRender();
    }

    this._scheduleRender();
  }

  private _doRender(): void {
    if (this._doRenderCount <= 5 || this._doRenderCount % 120 === 0) {
      console.log(
        `[DEBUG-diagnose] _doRender #${this._doRenderCount} _renderTicks=${this._renderTickCount} ratio=${((this._doRenderCount / Math.max(1, this._renderTickCount)) * 100).toFixed(1)}%`,
      );
    }

    if (this._playbackDriver.state === "playing" && this._score) {
      const elapsed = this._playbackDriver.elapsed;
      const beat = this._tempoClock.timeToBeat(elapsed);
      const displayBeat = beat - this._emptyBeats;

      const nextPage = this._viewportPositioner.tick({
        displayMode: this._config.displayMode,
        displayBeat,
        totalBeats: this._score.totalBeats,
        totalWithEmpty: this._totalWithEmpty,
        vrvPageCount: this._vrvPageCount,
        currentPage: this._config.currentPage,
      });

      if (nextPage !== undefined) {
        this._pageAdvanceCount++;
        console.log(
          `[DEBUG-diagnose] PAGE ADVANCE #${this._pageAdvanceCount}: page ${this._config.currentPage} → ${nextPage}`,
        );
        this._eventSink?.emit({ type: 'page-advanced', page: nextPage });
      }

      this._updateHighlights(displayBeat);
    }
  }

  private _updateHighlights(displayBeat: number): void {
    this._highlightUpdateCount++;

    const columns = this._eventRegistry.getUpcomingColumns(
      displayBeat,
      this._config.highlightLeadBeats,
      this._config.highlightRange,
    );

    const allIds: string[] = [];
    for (const col of columns) {
      for (const n of col.notes) {
        allIds.push(n.svgId);
      }
    }

    if (
      this._highlightUpdateCount <= 3 ||
      this._highlightUpdateCount % 60 === 0
    ) {
      console.log(
        `[DEBUG-diagnose] _updateHighlights #${this._highlightUpdateCount} (${allIds.length} ids, displayBeat=${displayBeat.toFixed(2)})`,
      );
    }

    this._highlightRenderer.update(columns);
  }

  private _clearHighlights(): void {
    this._highlightRenderer.clear();
  }

}

let _instance: GameLoop | null = null;

export function getGameLoop(): GameLoop {
  if (!_instance) _instance = new GameLoop();
  return _instance;
}
