import type { ScoreData } from './ScoreTypes'
import { parseMidi } from './MidiParser'
import { getVerovioRenderer } from '../renderer/VerovioEngine'

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
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
  const vrv = getVerovioRenderer()
  if (!vrv.isReady) throw new Error('Renderer not ready')
  if (!vrv.loadScore(xmlText)) throw new Error('Failed to load score data')

  const base64Midi = vrv.renderToMIDI()
  if (!base64Midi) throw new Error('Failed to render MIDI')

  const buf = base64ToArrayBuffer(base64Midi)
  const score = parseMidi(buf)
  return { ...score, title: extractTitle(xmlText) }
}
