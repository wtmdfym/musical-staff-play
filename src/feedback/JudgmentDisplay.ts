import type { JudgmentType } from '../score/ScoreTypes'
import { getOverlayManager } from './OverlayManager'

interface JudgmentEntry {
  grade: string
  types: Set<JudgmentType>
  rects: Map<string, SVGElement>
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const PAD_X = 8
const PAD_Y = 6

export class JudgmentDisplay {
  private _judged = new Map<string, JudgmentEntry>()
  private _om = getOverlayManager()

  show(svgId: string | undefined, grade: string, jtype?: JudgmentType): void {
    if (!svgId) return

    let entry = this._judged.get(svgId)
    if (!entry) {
      entry = { grade, types: new Set(), rects: new Map() }
      this._judged.set(svgId, entry)
    }
    const typeKey = jtype ?? 'noteOn'
    if (jtype) entry.types.add(jtype)

    const overlayGroup = this._om.getOrCreateGroup(svgId, 'jd-overlay-group')
    if (!overlayGroup) return

    const oldRect = entry.rects.get(typeKey)
    if (oldRect) {
      oldRect.remove()
      entry.rects.delete(typeKey)
    }

    const bbox = this._om.getNoteBBox(svgId)
    if (!bbox) return

    const final = this._om.finalizeBBox(bbox, PAD_X, PAD_Y)
    const rect = this._buildRect(final, grade, jtype)
    overlayGroup.appendChild(rect)
    entry.rects.set(typeKey, rect)
  }

  applyToPage(): void {
    for (const [svgId, entry] of this._judged) {
      let anyDisconnected = false
      for (const rect of entry.rects.values()) {
        if (!rect.isConnected) {
          anyDisconnected = true
          rect.remove()
        }
      }
      if (!anyDisconnected) continue

      entry.rects.clear()

      const overlayGroup = this._om.getOrCreateGroup(svgId, 'jd-overlay-group')
      if (!overlayGroup) continue

      const bbox = this._om.getNoteBBox(svgId)
      if (!bbox) continue

      const final = this._om.finalizeBBox(bbox, PAD_X, PAD_Y)

      for (const jtype of entry.types) {
        const rect = this._buildRect(final, entry.grade, jtype)
        overlayGroup.appendChild(rect)
        entry.rects.set(jtype, rect)
      }
    }
  }

  clear(): void {
    this._judged.clear()
    this._om.removeGroups('jd-overlay-group')
  }

  private _buildRect(bbox: { x: number; y: number; width: number; height: number }, grade: string, jtype?: JudgmentType): SVGElement {
    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.setAttribute('x', String(bbox.x))
    rect.setAttribute('y', String(bbox.y))
    rect.setAttribute('width', String(Math.max(0, bbox.width)))
    rect.setAttribute('height', String(Math.max(0, bbox.height)))

    if (!jtype || jtype === 'noteOn') {
      rect.classList.add('jd-grade', `jd-${grade}`)
    } else if (jtype === 'noteOff') {
      rect.classList.add('jd-off', `jd-off-${grade}`)
    } else if (jtype === 'velocity') {
      rect.classList.add('jd-vel', `jd-vel-${grade}`)
    }

    return rect
  }
}
