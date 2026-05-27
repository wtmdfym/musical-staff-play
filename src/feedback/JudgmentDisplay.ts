import type { JudgmentType } from '../score/ScoreTypes'

interface JudgmentEntry {
  grade: string
  types: Set<JudgmentType>
}

export class JudgmentDisplay {
  private _judged = new Map<string, JudgmentEntry>()

  show(svgId: string | undefined, grade: string, jtype?: JudgmentType): void {
    if (!svgId) return

    let entry = this._judged.get(svgId)
    if (!entry) {
      entry = { grade, types: new Set() }
      this._judged.set(svgId, entry)
    }
    if (jtype) entry.types.add(jtype)

    const el = document.getElementById(svgId)
    if (!el) return

    if (!jtype || jtype === 'noteOn') {
      el.setAttribute('data-judgment', grade)
    }
    if (jtype === 'noteOff') {
      el.setAttribute('data-judgment-off', grade)
    }
    if (jtype === 'velocity') {
      el.setAttribute('data-judgment-vel', grade)
      this._addVelocityMarker(el, grade)
    }
  }

  private _addVelocityMarker(noteEl: HTMLElement, grade: string): void {
    const existing = noteEl.querySelector('.vel-marker')
    if (existing) existing.remove()

    const colorMap: Record<string, string> = {
      perfect: '#16a34a',
      great: '#3b82f6',
      good: '#eab308',
      miss: '#ef4444',
    }
    const color = colorMap[grade] || '#888'

    const ns = 'http://www.w3.org/2000/svg'
    const circle = document.createElementNS(ns, 'circle')
    circle.setAttribute('class', 'vel-marker')
    circle.setAttribute('cx', '0')
    circle.setAttribute('cy', '-12')
    circle.setAttribute('r', '4')
    circle.setAttribute('fill', color)
    circle.setAttribute('stroke', '#fff')
    circle.setAttribute('stroke-width', '1')
    noteEl.insertBefore(circle, noteEl.firstChild)
  }

  applyToPage(): void {
    for (const [svgId, entry] of this._judged) {
      const el = document.getElementById(svgId)
      if (!el) continue
      if (entry.types.has('noteOn')) {
        el.setAttribute('data-judgment', entry.grade)
      }
      if (entry.types.has('noteOff')) {
        el.setAttribute('data-judgment-off', entry.grade)
      }
      if (entry.types.has('velocity')) {
        el.setAttribute('data-judgment-vel', entry.grade)
      }
    }
  }

  reset(): void {
    this._judged.clear()
  }
}
