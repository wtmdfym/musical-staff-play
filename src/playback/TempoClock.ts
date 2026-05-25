import type { TempoPoint } from '../score/ScoreTypes'

function getBpmAt(beat: number, tempoMap: TempoPoint[]): number {
  if (tempoMap.length === 0) return 120
  let bpm = tempoMap[0].bpm
  for (let i = 0; i < tempoMap.length; i++) {
    if (tempoMap[i].time <= beat) {
      bpm = tempoMap[i].bpm
    } else {
      break
    }
  }
  return bpm
}

function beatToTime(beatTarget: number, tempoMap: TempoPoint[]): number {
  if (tempoMap.length === 0 || beatTarget <= 0) return 0
  let timeSec = 0
  let prevBeat = 0
  let prevBpm = tempoMap[0].bpm

  for (let i = 0; i < tempoMap.length; i++) {
    const tp = tempoMap[i]
    if (tp.time >= beatTarget) {
      timeSec += (beatTarget - prevBeat) / (prevBpm / 60)
      return timeSec
    }
    timeSec += (tp.time - prevBeat) / (prevBpm / 60)
    prevBeat = tp.time
    prevBpm = tp.bpm
  }

  timeSec += (beatTarget - prevBeat) / (prevBpm / 60)
  return timeSec
}

function timeToBeat(elapsedSec: number, tempoMap: TempoPoint[]): number {
  if (tempoMap.length === 0 || elapsedSec <= 0) return 0
  let accumulatedBeat = 0
  let prevTimeSec = 0
  let prevBpm = tempoMap[0].bpm
  let prevBeat = 0

  for (let i = 1; i < tempoMap.length; i++) {
    const tp = tempoMap[i]
    const beatDelta = tp.time - prevBeat
    const sectionDurationSec = beatDelta / (prevBpm / 60)
    const remainingSec = elapsedSec - prevTimeSec

    if (remainingSec <= sectionDurationSec) {
      accumulatedBeat += remainingSec * (prevBpm / 60)
      return accumulatedBeat
    }

    accumulatedBeat += beatDelta
    prevTimeSec += sectionDurationSec
    prevBpm = tp.bpm
    prevBeat = tp.time
  }

  accumulatedBeat += (elapsedSec - prevTimeSec) * (prevBpm / 60)
  return accumulatedBeat
}

export class TempoClock {
  private _originalMap: TempoPoint[] = [{ time: 0, bpm: 120 }]
  private _effectiveMap: TempoPoint[] = [{ time: 0, bpm: 120 }]
  private _bpmOverrideEnabled = false
  private _bpmOverride = 0
  private _speedRatio = 1

  configure(rawMap: TempoPoint[], bpmOverrideEnabled: boolean, bpmOverride: number, speedRatio: number): void {
    this._originalMap = (rawMap && rawMap.length > 0) ? rawMap : [{ time: 0, bpm: 120 }]
    this._bpmOverrideEnabled = bpmOverrideEnabled
    this._bpmOverride = bpmOverride
    this._speedRatio = speedRatio
    if (bpmOverrideEnabled && bpmOverride > 0) {
      const baseBpm = this._originalMap[0].bpm
      const ratio = bpmOverride / baseBpm
      this._effectiveMap = this._originalMap.map(tp => ({
        time: tp.time,
        bpm: Math.round(tp.bpm * ratio),
      }))
    } else {
      const sr = Math.max(0.25, Math.min(4, speedRatio))
      if (sr !== 1) {
        this._effectiveMap = this._originalMap.map(tp => ({
          time: tp.time,
          bpm: Math.round(tp.bpm * sr),
        }))
      } else {
        this._effectiveMap = this._originalMap
      }
    }
  }

  get originalMap(): TempoPoint[] { return this._originalMap }
  get effectiveMap(): TempoPoint[] { return this._effectiveMap }
  get bpmOverrideEnabled(): boolean { return this._bpmOverrideEnabled }
  get bpmOverride(): number { return this._bpmOverride }
  get speedRatio(): number { return this._speedRatio }

  beatToTime(beat: number): number {
    return beatToTime(beat, this._effectiveMap)
  }

  beatToTimeOriginal(beat: number): number {
    return beatToTime(beat, this._originalMap)
  }

  timeToBeat(timeSec: number): number {
    return timeToBeat(timeSec, this._effectiveMap)
  }

  getBpmAt(beat: number): number {
    return getBpmAt(beat, this._effectiveMap)
  }
}
