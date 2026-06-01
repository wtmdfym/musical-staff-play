import type {
  PlayState,
  ScoreData,
  JudgmentResult,
} from "../score/ScoreTypes";
import { PlaybackDriver } from "./PlaybackDriver";
import { EventRegistry } from "./EventRegistry";
import { NoteInputPipeline } from "./NoteInputPipeline";
import type { PlaybackEventSink } from "./PlaybackEvents";
import { TempoClock } from "../playback/TempoClock";
import { JudgmentEngine } from "../playback/JudgmentEngine";
import { AutoPlayer } from "../playback/AutoPlayer";
import { getMidiInputManager } from "../playback/MidiInputManager";

export interface GameLoopConfig {
  emptyMeasures: number;
  midiEnabled: boolean;
  midiDeviceId: string;
  bpmOverrideEnabled: boolean;
  bpmOverride: number;
  speedRatio: number;
  logicFps: number;
  autoPlay: boolean;
  autoPlayVolume: number;
  autoPlayDelay: number;
  velocityJudgmentEnabled: boolean;
  pedalJudgmentEnabled: boolean;
  noteOffJudgmentEnabled: boolean;
}

export class GameLoop {
  private _playbackDriver = new PlaybackDriver();
  private _tempoClock = new TempoClock();
  private _eventRegistry = new EventRegistry();

  private _logicInterval: ReturnType<typeof setInterval> | null = null;
  private _lastLogicDispatch = -1;

  private _logicFrameTimes: number[] = [];
  logicFpsActual = 60;
  private _lastLogicTickTime = 0;

  private _score: ScoreData | null = null;
  private _emptyBeats = 0;
  private _totalWithEmpty = 0;

  private _je = new JudgmentEngine();
  private _autoPlayer = new AutoPlayer();
  private _pipeline: NoteInputPipeline;

  private _eventSink: PlaybackEventSink | null = null;
  private _config: GameLoopConfig = {
    emptyMeasures: 2,
    midiEnabled: false,
    midiDeviceId: "",
    bpmOverrideEnabled: false,
    bpmOverride: 0,
    speedRatio: 1,
    logicFps: 60,
    autoPlay: false,
    autoPlayVolume: 30,
    autoPlayDelay: 0,
    velocityJudgmentEnabled: false,
    pedalJudgmentEnabled: false,
    noteOffJudgmentEnabled: false,
  };

  private _logicTickCount = 0;

  constructor() {
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

  get eventRegistry(): EventRegistry {
    return this._eventRegistry;
  }

  get measureStartBeats(): number[] {
    return this._score?.measures.map(m => m.startBeat) ?? [];
  }

  get displayBeat(): number {
    if (!this._score) return 0;
    const elapsed = this._playbackDriver.elapsed;
    const beat = this._tempoClock.timeToBeat(elapsed);
    return beat - this._emptyBeats;
  }

  get totalBeats(): number {
    return this._score?.totalBeats ?? 0;
  }

  get totalWithEmpty(): number {
    return this._totalWithEmpty;
  }

  init(eventSink: PlaybackEventSink): void {
    this._eventSink = eventSink;

    this._je.onJudgment = (result: JudgmentResult) => {
      this._eventSink?.emit({ type: 'judgment-fired', result });
    };
  }

  destroy(): void {
    this.stop();
    this._autoPlayer.reset();
    this._eventSink = null;
  }

  setConfig(partial: Partial<GameLoopConfig>): void {
    const prev = this._config;
    Object.assign(this._config, partial);
    this._applyConfigEffects(partial, prev);
  }

  private _applyConfigEffects(partial: Partial<GameLoopConfig>, prev: GameLoopConfig): void {
    if (partial.autoPlay !== undefined && this._config.autoPlay) {
      this._autoPlayer.initAudio();
    }
    if (partial.autoPlayVolume !== undefined) {
      this._autoPlayer.setVolume(this._config.autoPlayVolume);
    }
    if (partial.autoPlayDelay !== undefined) {
      this._autoPlayer.setDelay(this._config.autoPlayDelay);
    }

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

    if (this._playbackDriver.state === "playing" && (
      partial.logicFps !== undefined && partial.logicFps !== prev.logicFps
    )) {
      this._restartLogicInterval();
    }

    if (
      (partial.midiEnabled !== undefined && partial.midiEnabled !== prev.midiEnabled) ||
      (partial.midiDeviceId !== undefined && partial.midiDeviceId !== prev.midiDeviceId)
    ) {
      this._pipeline.syncMidi(this._config.midiEnabled, this._config.midiDeviceId);
    }

    if (this._score && partial.emptyMeasures !== undefined && partial.emptyMeasures !== prev.emptyMeasures) {
      const timeSigBeat = this._score.measures[0]?.timeSignature[0] ?? 4;
      this._emptyBeats = this._config.emptyMeasures * timeSigBeat;
      this._totalWithEmpty = this._score.totalBeats + this._emptyBeats;
    }
  }

  loadScore(score: ScoreData): void {
    this._score = score;
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
  }

  play(): void {
    if (!this._playbackDriver.play()) return;
    this._je.reset(this._tempoClock.beatToTime(this._emptyBeats));
    this._lastLogicDispatch = -1;

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
        `_logicTicks=${this._logicTickCount}`,
    );
    this._logicTickCount = 0;
    this._playbackDriver.stop();
    this._stopLogicInterval();
    this._lastLogicDispatch = -1;

    this._pipeline.closeMidi();
    this._autoPlayer.stop();
  }

  seekToBeat(beat: number): void {
    this._playbackDriver.seekToBeat(beat, this._tempoClock);
  }

  noteOn(pitch: number, velocity: number): void {
    this._pipeline.noteOn(pitch, velocity);
  }

  noteOff(pitch: number): void {
    this._pipeline.noteOff(pitch);
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

  private _computeFps(): void {
    if (this._logicFrameTimes.length >= 2) {
      const sum = this._logicFrameTimes.reduce((a, b) => a + b, 0);
      this.logicFpsActual = Math.round(
        1000 / (sum / this._logicFrameTimes.length),
      );
    }
  }
}

let _instance: GameLoop | null = null;

export function getGameLoop(): GameLoop {
  if (!_instance) _instance = new GameLoop();
  return _instance;
}
