import type {
  PracticeAction,
  DisplayMode,
  PlayState,
  ScoreData,
  JudgmentResult,
} from "../score/ScoreTypes";
import type { VerovioLayoutOptions } from "../renderer/VerovioEngine";
import { TempoClock } from "../playback/TempoClock";
import { JudgmentEngine } from "../playback/JudgmentEngine";
import { JudgmentDisplay } from "../feedback/JudgmentDisplay";
import {
  getVerovioRenderer,
  type VerovioRenderer,
} from "../renderer/VerovioEngine";
import {
  getMidiInputManager,
  type MidiInputManager,
} from "../playback/MidiInputManager";

const KEY_TO_MIDI: Record<string, number> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
};

interface FlatEvent {
  measureIndex: number;
  noteIndex: number;
  time: number;
  pitch: number;
  clef: "treble" | "bass";
  duration: number;
}

export interface GameLoopConfig {
  displayMode: DisplayMode;
  emptyMeasures: number;
  playheadRatio: number;
  highlightLeadBeats: number;
  highlightRange: number;
  midiEnabled: boolean;
  midiDeviceId: string;
  currentPage: number;
  bpmOverride: number;
  logicFps: number;
  renderFps: number;
}

export interface GameLoopDomRefs {
  container: { current: HTMLDivElement | null };
  svgWrap: { current: HTMLDivElement | null };
  playhead: { current: HTMLDivElement | null };
}

export class GameLoop {
  private _playState: PlayState = "stopped";
  private _startTime = 0;
  private _pauseElapsed = 0;
  private _tempoClock = new TempoClock();

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
  private _flatEvents: FlatEvent[] = [];
  private _emptyBeats = 0;
  private _totalWithEmpty = 0;
  private _vrvPageCount = 0;
  private _judgedKeys = new Set<string>();

  private _je = new JudgmentEngine();
  private _vrv: VerovioRenderer;
  private _midi: MidiInputManager;
  private _jd = new JudgmentDisplay();

  private _dispatch: React.Dispatch<PracticeAction> | null = null;
  private _config: GameLoopConfig = {
    displayMode: "page",
    emptyMeasures: 2,
    playheadRatio: 0.25,
    highlightLeadBeats: 0.5,
    highlightRange: 2,
    midiEnabled: false,
    midiDeviceId: "",
    currentPage: 0,
    bpmOverride: 0,
    logicFps: 60,
    renderFps: 60,
  };
  private _svgWrapRef: { current: HTMLDivElement | null } | null = null;
  private _playheadRef: { current: HTMLDivElement | null } | null = null;

  private _highlightedIds = new Set<string>();
  private _lastHighlightIds: string[] = [];

  private _renderTickCount = 0;
  private _doRenderCount = 0;
  private _logicTickCount = 0;
  private _highlightUpdateCount = 0;
  private _pageAdvanceCount = 0;

  private _keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private _midiNoteHandler: ((pitch: number) => void) | null = null;

  constructor() {
    this._vrv = getVerovioRenderer();
    this._midi = getMidiInputManager();
  }

  get state(): PlayState {
    return this._playState;
  }

  init(
    dispatch: React.Dispatch<PracticeAction>,
    domRefs: GameLoopDomRefs,
  ): void {
    this._dispatch = dispatch;
    this._svgWrapRef = domRefs.svgWrap;
    this._playheadRef = domRefs.playhead;

    this._keyDownHandler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const cfg = this._config;
      if (cfg.displayMode === "page") {
        if (this._playState !== "playing") {
          if (e.key === "ArrowRight") {
            dispatch({ type: "NEXT_PAGE" });
            e.preventDefault();
            return;
          }
          if (e.key === "ArrowLeft") {
            dispatch({ type: "PREV_PAGE" });
            e.preventDefault();
            return;
          }
        }
        return;
      }
      const midi = KEY_TO_MIDI[e.key.toLowerCase()];
      if (midi !== undefined && this._playState === "playing") {
        this._handleNoteInput(midi);
      }
    };
    window.addEventListener("keydown", this._keyDownHandler);

    this._midiNoteHandler = (pitch: number) => {
      if (this._playState !== "playing") return;
      this._handleNoteInput(pitch);
    };

    this._je.onJudgment = (result: JudgmentResult) => {
      this._judgedKeys.add(`${result.measureIndex}:${result.noteIndex}`)
      dispatch({ type: 'JUDGE', result })
      const timeMs = this._tempoClock.beatToTimeOriginal(result.beat) * 1000
      const svgId = this._vrv.findNoteIdAtTime(timeMs, result.expectedPitch)
      console.log(`[DEBUG-judge] key=${result.measureIndex}:${result.noteIndex} beat=${result.beat.toFixed(3)} timeMs=${timeMs.toFixed(1)} svgId=${svgId}`)
      if (svgId) {
        this._jd.show(svgId, result.grade)
      }
    }

    this._scheduleRender();
  }

  destroy(): void {
    this.stop();
    if (this._keyDownHandler) {
      window.removeEventListener("keydown", this._keyDownHandler);
      this._keyDownHandler = null;
    }
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
    this._dispatch = null;
    this._svgWrapRef = null;
    this._playheadRef = null;
  }

  private _handleNoteInput(midiNote: number): void {
    if (!this._score) {
      this._je.onInput(midiNote, this._getElapsed());
      return;
    }
    const elapsed = this._getElapsed();
    const judgeTime = elapsed - this._tempoClock.beatToTime(this._emptyBeats);
    this._je.onInputColumn([midiNote], judgeTime);
  }

  setConfig(partial: Partial<GameLoopConfig>): void {
    const prev = this._config;
    const bpmChanged =
      partial.bpmOverride !== undefined &&
      partial.bpmOverride !== prev.bpmOverride;
    const logicChanged =
      partial.logicFps !== undefined && partial.logicFps !== prev.logicFps;
    const renderChanged =
      partial.renderFps !== undefined && partial.renderFps !== prev.renderFps;
    const midiChanged =
      partial.midiEnabled !== undefined &&
      partial.midiEnabled !== prev.midiEnabled;
    const midiDevChanged =
      partial.midiDeviceId !== undefined &&
      partial.midiDeviceId !== prev.midiDeviceId;
    const emptyChanged =
      partial.emptyMeasures !== undefined &&
      partial.emptyMeasures !== prev.emptyMeasures;

    Object.assign(this._config, partial);

    if (bpmChanged && this._score) {
      this._tempoClock.configure(this._score.tempoMap, partial.bpmOverride!);
      this._je.setClock(this._tempoClock);
    }

    if ((logicChanged || renderChanged) && this._playState === "playing") {
      this._restartLogicInterval();
    }

    if (midiChanged || midiDevChanged) {
      this._syncMidi();
    }

    if (emptyChanged && this._score) {
      const timeSigBeat = this._score.measures[0]?.timeSignature[0] ?? 4;
      this._emptyBeats = partial.emptyMeasures! * timeSigBeat;
      this._totalWithEmpty = this._score.totalBeats + this._emptyBeats;
    }
  }

  loadScore(score: ScoreData, rawDocument: string): void {
    this._score = score;
    this._rawDocument = rawDocument;
    this._tempoClock.configure(score.tempoMap, this._config.bpmOverride);
    this._je.setClock(this._tempoClock);
    this._je.score = score;
    this._judgedKeys.clear();

    const timeSigBeat = score.measures[0]?.timeSignature[0] ?? 4;
    this._emptyBeats = this._config.emptyMeasures * timeSigBeat;
    this._totalWithEmpty = score.totalBeats + this._emptyBeats;

    const events: FlatEvent[] = [];
    for (const m of score.measures) {
      for (let ni = 0; ni < m.events.length; ni++) {
        const e = m.events[ni];
        if (e.isRest) continue;
        events.push({
          measureIndex: m.index,
          noteIndex: ni,
          time: e.time,
          pitch: e.pitch,
          clef: m.clef,
          duration: e.duration,
        });
      }
    }
    events.sort((a, b) => a.time - b.time);
    this._flatEvents = events;

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
      this._vrvPageCount = this._vrv.pageCount;
      this._dispatch?.({ type: "SET_TOTAL_PAGES", total: this._vrvPageCount });
      if (this._config.currentPage >= this._vrvPageCount) {
        this._dispatch?.({
          type: "SET_PAGE",
          page: Math.max(0, this._vrvPageCount - 1),
        });
      }
      this._buildEventIdMap();
    }
  }

  applyLayout(opts: VerovioLayoutOptions): void {
    if (!this._vrv.hasDocument || !this._rawDocument) return;
    this._vrv.applyLayout(opts);
    this._vrvPageCount = this._vrv.pageCount;
    this._dispatch?.({ type: "SET_TOTAL_PAGES", total: this._vrvPageCount });
    this._buildEventIdMap();
  }

  reapplyJudgments(): void {
    if (this._config.displayMode !== "page") return;
    this._jd.applyToPage();
  }

  private _buildEventIdMap(): void {
    if (this._flatEvents.length === 0 || !this._score) return;
    this._vrv.buildEventIdMap(
      this._flatEvents.map((e) => ({
        measureIndex: e.measureIndex,
        noteIndex: e.noteIndex,
        timeMs: this._tempoClock.beatToTimeOriginal(e.time) * 1000,
        pitch: e.pitch,
      })),
    );
  }

  private _getElapsed(): number {
    if (this._playState === "stopped") return 0;
    if (this._playState === "paused") return this._pauseElapsed;
    return performance.now() / 1000 - this._startTime + this._pauseElapsed;
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
    if (this._playState === "playing") return;
    this._playState = "playing";
    this._startTime = performance.now() / 1000;
    this._je.reset();
    this._judgedKeys.clear();
    this._lastLogicDispatch = -1;
    this._lastHighlightIds = [];

    this._clearHighlights();
    this._startLogicInterval();
    this._syncMidi();
  }

  pause(): void {
    if (this._playState !== "playing") return;
    this._pauseElapsed =
      performance.now() / 1000 - this._startTime + this._pauseElapsed;
    this._playState = "paused";
    this._stopLogicInterval();
    this._midi.close();
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
    this._playState = "stopped";
    this._pauseElapsed = 0;
    this._startTime = 0;
    this._stopLogicInterval();
    this._lastLogicDispatch = -1;
    this._lastHighlightIds = [];

    this._clearHighlights();
    const svgWrap = this._svgWrapRef?.current;
    if (svgWrap) svgWrap.style.transform = "";
    this._midi.close();
  }

  seekToBeat(beat: number): void {
    const wasPlaying = this._playState === "playing";
    this._pauseElapsed = this._tempoClock.beatToTime(beat);
    if (wasPlaying) {
      this._startTime = performance.now() / 1000;
    }
  }

  private _syncMidi(): void {
    if (this._playState === "playing" && this._config.midiEnabled) {
      this._midi.onNoteOn = this._midiNoteHandler;
      this._midi.open(this._config.midiDeviceId || undefined);
    }
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

  private _logicTick(): void {
    if (this._playState !== "playing") return;
    if (!this._score) return;

    this._logicTickCount++;
    const now = performance.now();
    if (this._lastLogicTickTime > 0) {
      this._logicFrameTimes.push(now - this._lastLogicTickTime);
      if (this._logicFrameTimes.length > 30) this._logicFrameTimes.shift();
    }
    this._lastLogicTickTime = now;
    this._computeFps();

    const elapsed = this._getElapsed();
    const beat = this._tempoClock.timeToBeat(elapsed);
    const displayBeat = beat - this._emptyBeats;
    const totalBeats = this._score.totalBeats;

    if (displayBeat >= totalBeats) {
      this._dispatch?.({ type: "STOP" });
      return;
    }

    const judgeTime = elapsed - this._tempoClock.beatToTime(this._emptyBeats);
    this._je.checkMissed(judgeTime);

    if (Math.abs(beat - this._lastLogicDispatch) > 0.01) {
      this._lastLogicDispatch = beat;
      if (this._logicTickCount <= 3 || this._logicTickCount % 60 === 0) {
        console.log(
          `[DEBUG-diagnose] _logicTick #${this._logicTickCount} dispatching SET_SCROLL_OFFSET beat=${beat.toFixed(2)}`,
        );
      }
      this._dispatch?.({ type: "SET_SCROLL_OFFSET", offset: beat });
    }
  }

  private _scheduleRender(): void {
    this._rafId = requestAnimationFrame(() => this._renderTick());
  }

  private _renderTick(): void {
    if (!this._dispatch) return;

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
    const svgWrap = this._svgWrapRef?.current ?? null;
    const playhead = this._playheadRef?.current ?? null;
    if (!svgWrap || !playhead) return;

    if (this._doRenderCount <= 5 || this._doRenderCount % 120 === 0) {
      console.log(
        `[DEBUG-diagnose] _doRender #${this._doRenderCount} _renderTicks=${this._renderTickCount} ratio=${((this._doRenderCount / Math.max(1, this._renderTickCount)) * 100).toFixed(1)}%`,
      );
    }

    if (this._playState === "playing" && this._score) {
      const elapsed = this._getElapsed();
      const beat = this._tempoClock.timeToBeat(elapsed);
      const displayBeat = beat - this._emptyBeats;
      const cfg = this._config;

      if (cfg.displayMode === "scroll") {
        const totalBeats = this._score.totalBeats;
        const progress = Math.max(0, Math.min(1, displayBeat / totalBeats));
        const phRatio = cfg.playheadRatio;
        const totalH = this._vrvPageCount * svgWrap.offsetHeight;
        const viewH =
          svgWrap.parentElement?.offsetHeight ?? svgWrap.offsetHeight;
        const playheadScreenY = viewH * phRatio;
        const scrollY = progress * totalH - playheadScreenY;
        svgWrap.style.transform = `translateY(${-Math.max(0, scrollY)}px)`;

        playhead.style.display = "block";
        playhead.style.top = `${playheadScreenY}px`;
        playhead.style.left = "0";
        playhead.style.width = "100%";
        playhead.style.height = "2px";
      } else {
        playhead.style.display = "block";
        playhead.style.top = "0";
        playhead.style.height = "100%";
        playhead.style.width = "2px";

        const pc = this._vrvPageCount;
        const beatsPerPage = this._totalWithEmpty / Math.max(1, pc);
        const pageStartBeat = cfg.currentPage * beatsPerPage;
        const pageProgress = (displayBeat - pageStartBeat) / beatsPerPage;
        const w = svgWrap.offsetWidth;
        playhead.style.left = `${Math.max(0, Math.min(w, pageProgress * w))}px`;

        if (displayBeat > pageStartBeat + beatsPerPage) {
          const nextPage = cfg.currentPage + 1;
          if (nextPage < pc) {
            this._pageAdvanceCount++;
            console.log(
              `[DEBUG-diagnose] PAGE ADVANCE #${this._pageAdvanceCount}: page ${cfg.currentPage} → ${nextPage}`,
            );
            this._dispatch?.({ type: "SET_PAGE", page: nextPage });
          }
        }
      }

      this._updateHighlights(displayBeat);
    } else {
      playhead.style.display = "none";
    }
  }

  private _updateHighlights(displayBeat: number): void {
    this._highlightUpdateCount++;
    const leadBeats = this._config.highlightLeadBeats;
    const range = this._config.highlightRange;
    const events = this._flatEvents;

    const upcomingColumns: { noteIds: string[] }[] = [];
    let colTime = -1;

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.time < displayBeat) continue;
      if (e.time > displayBeat + leadBeats) break;

      const key = `${e.measureIndex}:${e.noteIndex}`;
      if (this._judgedKeys.has(key)) continue;

      if (Math.abs(e.time - colTime) > 0.001) {
        colTime = e.time;
        const timeMs = this._tempoClock.beatToTimeOriginal(colTime) * 1000;
        const elements = this._vrv.getElementsAtTime(timeMs);
        const ids = elements.notes ?? [];
        upcomingColumns.push({ noteIds: ids });
        if (upcomingColumns.length > range) break;
      }
    }

    const allIds: string[] = [];
    for (const col of upcomingColumns) {
      allIds.push(...col.noteIds);
    }
    const lastIds = this._lastHighlightIds;
    const changed =
      allIds.length !== lastIds.length ||
      allIds.some((id, i) => id !== lastIds[i]);

    if (changed) {
      if (
        this._highlightUpdateCount <= 3 ||
        this._highlightUpdateCount % 60 === 0
      ) {
        console.log(
          `[DEBUG-diagnose] _updateHighlights #${this._highlightUpdateCount} CHANGED (${allIds.length} ids, displayBeat=${displayBeat.toFixed(2)})`,
        );
      }
      const prevHighlighted = this._highlightedIds;
      for (const id of prevHighlighted) {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove("highlight-active", "highlight-preview");
        }
      }
      prevHighlighted.clear();

      for (let ci = 0; ci < upcomingColumns.length; ci++) {
        const col = upcomingColumns[ci];
        if (col.noteIds.length === 0) continue;
        const cls = ci === 0 ? "highlight-active" : "highlight-preview";
        for (const id of col.noteIds) {
          const el = document.getElementById(id);
          if (el) {
            el.classList.add(cls);
            prevHighlighted.add(id);
          }
        }
      }
      this._lastHighlightIds = allIds;
    }
  }

  private _clearHighlights(): void {
    for (const id of this._highlightedIds) {
      const el = document.getElementById(id);
      if (el) el.classList.remove("highlight-active", "highlight-preview");
    }
    this._highlightedIds.clear();
    this._lastHighlightIds = [];
  }

  get vrvPageCount(): number {
    return this._vrvPageCount;
  }

  hasVerovioDoc(): boolean {
    return this._vrv.hasDocument;
  }

  renderSvg(pageNo: number): string {
    return this._vrv.renderSVG(pageNo);
  }

  renderAllSvgs(): string[] {
    return this._vrv.renderAllSVGs();
  }

  get pageCount(): number {
    return this._vrv.pageCount;
  }
}

let _instance: GameLoop | null = null;

export function getGameLoop(): GameLoop {
  if (!_instance) _instance = new GameLoop();
  return _instance;
}
