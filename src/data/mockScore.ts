import type { ScoreData } from '../score/ScoreTypes'

function note(pitch: number, time: number, duration: number, measureIndex: number) {
  return { pitch, time, duration, measureIndex, isRest: false, voice: 0 }
}

const BPM = 120
const MEASURES: ScoreData = {
  title: 'C Major Scale',
  bpm: BPM,
  totalBeats: 20,
  tempoMap: [{ time: 0, bpm: BPM }],
  measures: [
    {
      index: 0,
      timeSignature: [4, 4],
      clef: 'treble',
      startBeat: 0,
      duration: 4,
      events: [
        note(60, 0, 1, 0),
        note(62, 1, 1, 0),
        note(64, 2, 1, 0),
        note(65, 3, 1, 0),
      ],
    },
    {
      index: 1,
      timeSignature: [4, 4],
      clef: 'treble',
      startBeat: 4,
      duration: 4,
      events: [
        note(67, 4, 1, 1),
        note(69, 5, 1, 1),
        note(71, 6, 1, 1),
        note(72, 7, 1, 1),
      ],
    },
    {
      index: 2,
      timeSignature: [4, 4],
      clef: 'treble',
      startBeat: 8,
      duration: 4,
      events: [
        note(72, 8, 1, 2),
        note(71, 9, 1, 2),
        note(69, 10, 1, 2),
        note(67, 11, 1, 2),
      ],
    },
    {
      index: 3,
      timeSignature: [4, 4],
      clef: 'treble',
      startBeat: 12,
      duration: 4,
      events: [
        note(65, 12, 1, 3),
        note(64, 13, 1, 3),
        note(62, 14, 1, 3),
        note(60, 15, 1, 3),
      ],
    },
    {
      index: 4,
      timeSignature: [4, 4],
      clef: 'treble',
      startBeat: 16,
      duration: 4,
      events: [
        note(60, 16, 1, 4),
        note(64, 17, 1, 4),
        note(67, 18, 1, 4),
        note(72, 19, 1, 4),
      ],
    },
  ],
}

export function getMockScore(): ScoreData {
  return MEASURES
}
