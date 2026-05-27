import type { ScoreData, ScoreEvent, MeasureEvent, StaffData, TempoPoint, PedalEvent, Dynamics } from './ScoreTypes'

function pitchToMidi(step: string, alter: number, octave: number): number {
  const stepMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  const base = stepMap[step.toUpperCase()] ?? 0
  return (octave + 1) * 12 + base + alter
}

function extractTitle(xmlText: string): string {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
  if (doc.querySelector('parsererror')) return 'Untitled'
  return (
    doc.querySelector('movement-title')?.textContent ??
    doc.querySelector('work > work-title')?.textContent ??
    doc.querySelector('credit > credit-words')?.textContent ??
    'Untitled'
  )
}

export function parseFromXml(xmlText: string): ScoreData {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML document')
  }

  const part = doc.querySelector('part')
  if (!part) {
    throw new Error('No <part> element found in MusicXML')
  }

  const measureEls = Array.from(part.querySelectorAll('measure'))
  if (measureEls.length === 0) {
    throw new Error('No measures found in MusicXML')
  }

  const measures: MeasureEvent[] = []
  const pedalEvents: PedalEvent[] = []
  let currentBeat = 0
  let divisions = 1
  let currentTimeSig: [number, number] = [4, 4]
  let currentDynamics: Dynamics = 'mf'
  const tempoMap: TempoPoint[] = []

  // Try to extract tempo from <direction><sound tempo="..."/>
  const firstDirection = doc.querySelector('direction sound[tempo]')
  if (firstDirection) {
    const tempoAttr = firstDirection.getAttribute('tempo')
    if (tempoAttr) {
      const bpm = parseInt(tempoAttr, 10)
      if (!isNaN(bpm)) {
        tempoMap.push({ time: 0, bpm })
      }
    }
  }

  // Also try <metronome>
  const metronome = doc.querySelector('metronome beat-unit')
  if (metronome && tempoMap.length === 0) {
    const perMin = metronome.parentElement?.querySelector('per-minute')?.textContent
    if (perMin) {
      const bpm = parseInt(perMin, 10)
      if (!isNaN(bpm)) {
        tempoMap.push({ time: 0, bpm })
      }
    }
  }

  if (tempoMap.length === 0) {
    tempoMap.push({ time: 0, bpm: 120 })
  }

  for (let mi = 0; mi < measureEls.length; mi++) {
    const measureEl = measureEls[mi]
    const staffMap = new Map<number, StaffData>()

    // Process attributes
    for (const attrEl of Array.from(measureEl.querySelectorAll('attributes'))) {
      const divEl = attrEl.querySelector('divisions')
      if (divEl) {
        const d = parseInt(divEl.textContent || '1', 10)
        if (d > 0) divisions = d
      }

      const timeEl = attrEl.querySelector('time')
      if (timeEl) {
        const beats = parseInt(timeEl.querySelector('beats')?.textContent || '4', 10)
        const beatType = parseInt(timeEl.querySelector('beat-type')?.textContent || '4', 10)
        currentTimeSig = [beats, beatType]
      }

      for (const clefEl of Array.from(attrEl.querySelectorAll('clef'))) {
        const staffNum = parseInt(clefEl.getAttribute('number') || '1', 10)
        const sign = clefEl.querySelector('sign')?.textContent || 'G'
        const clef: 'treble' | 'bass' = sign === 'F' ? 'bass' : 'treble'
        staffMap.set(staffNum, { clef, events: [] })
      }
    }

    // Default staff 1 if no clef defined
    if (!staffMap.has(1)) {
      staffMap.set(1, { clef: 'treble', events: [] })
    }

    // Track current offset within measure per staff:voice
    const offsetMap = new Map<string, number>()
    const lastOnsetMap = new Map<string, number>()

    for (const child of Array.from(measureEl.children)) {
      if (child.tagName === 'note') {
        const isChord = child.querySelector('chord') !== null
        const isRest = child.querySelector('rest') !== null

        let duration = 0
        const durEl = child.querySelector('duration')
        if (durEl) {
          duration = parseInt(durEl.textContent || '0', 10)
        }

        const staffNum = parseInt(child.querySelector('staff')?.textContent || '1', 10)
        const voiceNum = parseInt(child.querySelector('voice')?.textContent || '1', 10)
        const offsetKey = `${staffNum}:${voiceNum}`

        // Ensure staff exists
        if (!staffMap.has(staffNum)) {
          staffMap.set(staffNum, { clef: 'treble', events: [] })
        }

        let pitch = 0
        if (!isRest) {
          const step = child.querySelector('step')?.textContent || 'C'
          const alter = parseInt(child.querySelector('alter')?.textContent || '0', 10)
          const octave = parseInt(child.querySelector('octave')?.textContent || '4', 10)
          pitch = pitchToMidi(step, alter, octave)
        }

        // Calculate onset time within measure
        let noteOffset: number
        if (isChord) {
          // Chord notes share the onset of the preceding note in this voice
          noteOffset = lastOnsetMap.get(offsetKey) || 0
        } else {
          noteOffset = offsetMap.get(offsetKey) || 0
          lastOnsetMap.set(offsetKey, noteOffset)
          offsetMap.set(offsetKey, noteOffset + duration / divisions)
        }

        const time = currentBeat + noteOffset

        const event: ScoreEvent = {
          pitch,
          time,
          duration: duration / divisions,
          measureIndex: mi,
          isRest: isRest,
          voice: voiceNum - 1,
          staffIndex: staffNum - 1,
          dynamics: currentDynamics,
        }

        staffMap.get(staffNum)!.events.push(event)
      } else if (child.tagName === 'direction') {
        const pedalEl = child.querySelector('direction-type > pedal')
        if (pedalEl) {
          const pedalType = pedalEl.getAttribute('type') as 'start' | 'stop' | null
          if (pedalType === 'start' || pedalType === 'stop') {
            let minOffset = Infinity
            for (const offset of offsetMap.values()) {
              if (offset < minOffset) minOffset = offset
            }
            if (!isFinite(minOffset)) minOffset = 0
            pedalEvents.push({
              beat: currentBeat + minOffset,
              type: pedalType,
              measureIndex: mi,
            })
          }
        }
        const dynamicsEl = child.querySelector('direction-type > dynamics')
        if (dynamicsEl) {
          const markings = ['pp', 'p', 'mp', 'mf', 'f', 'ff'] as const
          for (const m of markings) {
            if (dynamicsEl.querySelector(m)) {
              currentDynamics = m
              break
            }
          }
        }
      } else if (child.tagName === 'backup') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10)
        const beatDur = dur / divisions
        for (const key of offsetMap.keys()) {
          const current = offsetMap.get(key) || 0
          offsetMap.set(key, Math.max(0, current - beatDur))
        }
        // Also adjust lastOnsetMap so chords after backup use correct onset
        for (const key of lastOnsetMap.keys()) {
          const current = lastOnsetMap.get(key) || 0
          lastOnsetMap.set(key, Math.max(0, current - beatDur))
        }
      } else if (child.tagName === 'forward') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10)
        const beatDur = dur / divisions
        for (const key of offsetMap.keys()) {
          const current = offsetMap.get(key) || 0
          offsetMap.set(key, current + beatDur)
        }
        for (const key of lastOnsetMap.keys()) {
          const current = lastOnsetMap.get(key) || 0
          lastOnsetMap.set(key, current + beatDur)
        }
      }
    }

    // Convert staffMap to array sorted by staff number
    const staves: StaffData[] = []
    const sortedStaffNums = Array.from(staffMap.keys()).sort((a, b) => a - b)
    for (const sn of sortedStaffNums) {
      staves.push(staffMap.get(sn)!)
    }

    // Calculate measure duration in beats based on time signature
    const measureDuration = currentTimeSig[0] * (4 / currentTimeSig[1])

    measures.push({
      index: mi,
      staves,
      timeSignature: currentTimeSig,
      startBeat: currentBeat,
      duration: measureDuration,
    })

    currentBeat += measureDuration
  }

  const totalBeats = measures.length > 0
    ? measures[measures.length - 1].startBeat + measures[measures.length - 1].duration
    : 0

  const bpm = tempoMap[0]?.bpm ?? 120

  return {
    title: extractTitle(xmlText),
    measures,
    totalBeats,
    bpm,
    tempoMap,
    pedalEvents,
  }
}
