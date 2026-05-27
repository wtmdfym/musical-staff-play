export const PITCH_NAMES: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

export function midiFromPnameOct(pname: string, oct: string): number | null {
  const semitone = PITCH_NAMES[pname]
  if (semitone === undefined) return null
  const octNum = parseInt(oct, 10)
  if (isNaN(octNum)) return null
  return (octNum + 1) * 12 + semitone
}

export const MIDI_TO_PNAME: Record<number, string> = { 0: 'c', 1: 'c', 2: 'd', 3: 'd', 4: 'e', 5: 'f', 6: 'f', 7: 'g', 8: 'g', 9: 'a', 10: 'a', 11: 'b' }

export function midiToPnameOct(pitch: number): { pname: string; oct: string } | null {
  if (pitch < 0 || pitch > 127) return null
  const semitone = pitch % 12
  const pname = MIDI_TO_PNAME[semitone]
  if (!pname) return null
  const oct = Math.floor(pitch / 12) - 1
  return { pname, oct: String(oct) }
}
