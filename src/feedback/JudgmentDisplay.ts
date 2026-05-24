export class JudgmentDisplay {
  private _judgedSvgIds = new Map<string, string>()

  show(svgId: string | undefined, grade: string): void {
    if (!svgId) return
    this._judgedSvgIds.set(svgId, grade)
    const el = document.getElementById(svgId)
    if (el) {
      el.setAttribute('data-judgment', grade)
    }
  }

  applyToPage(): void {
    for (const [svgId, grade] of this._judgedSvgIds) {
      const el = document.getElementById(svgId)
      if (el) {
        el.setAttribute('data-judgment', grade)
      }
    }
  }

  reset(): void {
    this._judgedSvgIds.clear()
  }
}
