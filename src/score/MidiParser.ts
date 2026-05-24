import type { ScoreData, MeasureEvent, ScoreEvent } from './ScoreTypes'

function readUint16(data: Uint8Array, offset: number): number {
  return (data[offset] << 8) | data[offset + 1]
}

function readUint32(data: Uint8Array, offset: number): number {
  return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]
}

function readString(data: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...data.slice(offset, offset + length))
}

function readVLQ(data: Uint8Array, offset: number): [number, number] {
  let value = 0
  let byte: number
  do {
    byte = data[offset++]
    value = (value << 7) | (byte & 0x7F)
  } while (byte & 0x80)
  return [value, offset]
}

export function parseMidi(arrayBuffer: ArrayBuffer): ScoreData {
  const data = new Uint8Array(arrayBuffer)
  let offset = 0

  const headerId = readString(data, offset, 4)
  offset += 4
  if (headerId !== 'MThd') throw new Error('Not a MIDI file: missing MThd header')

  offset += 6
  const numTracks = readUint16(data, offset)
  offset += 2
  const rawDivision = readUint16(data, offset)
  offset += 2

  if (rawDivision & 0x8000) throw new Error('SMPTE time division not supported')
  const ticksPerQuarter = rawDivision
  if (ticksPerQuarter === 0) throw new Error('Invalid MIDI: ticks per quarter note is 0')

  interface RawNote {
    pitch: number
    startTick: number
    endTick: number
  }

  const allNotes: RawNote[] = []
  const tempoEvents: { tick: number; tempo: number }[] = []
  const timeSigEvents: { tick: number; numerator: number; denominator: number }[] = []

  for (let t = 0; t < numTracks; t++) {
    const trackId = readString(data, offset, 4)
    offset += 4
    if (trackId !== 'MTrk') throw new Error(`Expected MTrk at track ${t}, got ${trackId}`)

    const trackLength = readUint32(data, offset)
    offset += 4
    const trackEnd = offset + trackLength

    const trackNotes: RawNote[] = []
    let runningStatus = 0
    let absTick = 0
    const activeNotes = new Map<string, number>()

    while (offset < trackEnd) {
      const [delta, newOffset] = readVLQ(data, offset)
      offset = newOffset
      absTick += delta

      const firstByte = data[offset]

      if (firstByte === 0xFF) {
        offset++
        const metaType = data[offset++]
        const [evtLen, newOff2] = readVLQ(data, offset)
        offset = newOff2

        if (metaType === 0x2F) {
          break
        } else if (metaType === 0x51 && evtLen >= 3) {
          const tempo = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2]
          tempoEvents.push({ tick: absTick, tempo })
        } else if (metaType === 0x58 && evtLen >= 4) {
          const numerator = data[offset]
          const denominator = 1 << data[offset + 1]
          timeSigEvents.push({ tick: absTick, numerator, denominator })
        }

        offset += evtLen
        runningStatus = 0
        continue
      }

      if (firstByte === 0xF0 || firstByte === 0xF7) {
        offset++
        const [evtLen, newOff2] = readVLQ(data, offset)
        offset = newOff2 + evtLen
        runningStatus = 0
        continue
      }

      let status: number
      if (firstByte & 0x80) {
        status = firstByte
        runningStatus = status
        offset++
      } else {
        status = runningStatus
        if (status === 0) throw new Error('MIDI running status without prior status byte')
      }

      const eventType = status & 0xF0
      const channel = status & 0x0F

      if (eventType === 0x80 || eventType === 0x90) {
        const note = data[offset++]
        const velocity = data[offset++]

        if (eventType === 0x80 || velocity === 0) {
          const key = `${channel}:${note}`
          const startTick = activeNotes.get(key)
          if (startTick !== undefined) {
            trackNotes.push({ pitch: note, startTick, endTick: absTick })
            activeNotes.delete(key)
          }
        } else {
          const key = `${channel}:${note}`
          if (activeNotes.has(key)) {
            const oldStart = activeNotes.get(key)!
            trackNotes.push({ pitch: note, startTick: oldStart, endTick: absTick })
          }
          activeNotes.set(key, absTick)
        }
      } else if (eventType === 0xA0 || eventType === 0xB0 || eventType === 0xE0) {
        offset += 2
      } else if (eventType === 0xC0 || eventType === 0xD0) {
        offset += 1
      } else {
        break
      }
    }

    for (const [, startTick] of activeNotes) {
      trackNotes.push({ pitch: 0, startTick, endTick: absTick })
    }

    allNotes.push(...trackNotes)
  }

  tempoEvents.sort((a, b) => a.tick - b.tick)
  timeSigEvents.sort((a, b) => a.tick - b.tick)

  const initialTempo = tempoEvents.length > 0 ? tempoEvents[0].tempo : 500000
  const bpm = Math.round(60000000 / initialTempo)

  const tempoMap: { time: number; bpm: number }[] = []
  for (const te of tempoEvents) {
    const beatTime = te.tick / ticksPerQuarter
    const bpmVal = Math.round(60000000 / te.tempo)
    tempoMap.push({ time: beatTime, bpm: bpmVal })
  }
  if (tempoMap.length === 0) {
    tempoMap.push({ time: 0, bpm })
  }
  tempoMap.sort((a, b) => a.time - b.time)

  const scoreEvents: ScoreEvent[] = []
  for (const note of allNotes) {
    const startBeat = note.startTick / ticksPerQuarter
    const duration = Math.max((note.endTick - note.startTick) / ticksPerQuarter, 1 / ticksPerQuarter)
    scoreEvents.push({
      pitch: note.pitch,
      time: startBeat,
      duration,
      measureIndex: 0,
      isRest: false,
      voice: 0,
    })
  }

  scoreEvents.sort((a, b) => a.time - b.time)

  const lastBeat = scoreEvents.length > 0
    ? Math.max(...scoreEvents.map(e => e.time + e.duration))
    : 0
  const totalBeats = Math.max(Math.ceil(lastBeat) + 4, 4)

  function getTimeSigAtTick(tick: number): [number, number] {
    let result: [number, number] = [4, 4]
    for (const ts of timeSigEvents) {
      if (ts.tick <= tick) result = [ts.numerator, ts.denominator]
      else break
    }
    return result
  }

  const measures: MeasureEvent[] = []
  const measureBoundaries: { start: number; end: number }[] = []
  let currentBeat = 0

  while (currentBeat < totalBeats) {
    const ts = getTimeSigAtTick(currentBeat * ticksPerQuarter)
    const beatInMeasure = currentBeat
    const nextBeat = currentBeat + ts[0]
    measureBoundaries.push({ start: beatInMeasure, end: Math.min(nextBeat, totalBeats) })
    currentBeat = nextBeat
  }

  const measureEvents: ScoreEvent[][] = measureBoundaries.map(() => [])
  for (const evt of scoreEvents) {
    const midTime = evt.time + evt.duration / 2
    let mi = 0
    for (let i = 0; i < measureBoundaries.length; i++) {
      if (midTime >= measureBoundaries[i].start && midTime < measureBoundaries[i].end) {
        mi = i
        break
      }
    }
    measureEvents[mi].push({ ...evt, measureIndex: mi })
  }

  for (let i = 0; i < measureBoundaries.length; i++) {
    const ts = getTimeSigAtTick(measureBoundaries[i].start * ticksPerQuarter)
    measures.push({
      index: i,
      events: measureEvents[i],
      timeSignature: ts,
      clef: 'treble',
      startBeat: measureBoundaries[i].start,
      duration: measureBoundaries[i].end - measureBoundaries[i].start,
    })
  }

  return {
    title: 'Imported MIDI',
    measures,
    totalBeats,
    bpm,
    tempoMap,
  }
}
