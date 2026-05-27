import type { HighlightColumn, HighlightColumnNote } from '../score/ScoreTypes'

export type { HighlightColumn, HighlightColumnNote }

export interface HighlightRenderer {
  update(columns: HighlightColumn[]): void
  clear(): void
}

export class DomHighlightRenderer implements HighlightRenderer {
  private _lastIds: string[] = []
  private _highlightedIds = new Set<string>()

  update(columns: HighlightColumn[]): void {
    const allIds: string[] = []
    for (const col of columns) {
      for (const n of col.notes) {
        allIds.push(n.svgId)
      }
    }

    const changed =
      allIds.length !== this._lastIds.length ||
      allIds.some((id, i) => id !== this._lastIds[i])

    if (!changed) return

    for (const id of this._highlightedIds) {
      const el = document.getElementById(id)
      if (el) {
        el.classList.remove("highlight-preview")
      }
    }
    this._highlightedIds.clear()

    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci]
      if (col.notes.length === 0) continue
      const cls = ci === 0 ? "highlight-active" : "highlight-preview"
      for (const n of col.notes) {
        const el = document.getElementById(n.svgId)
        if (el) {
          el.classList.add(cls)
          this._highlightedIds.add(n.svgId)
        }
      }
    }

    this._lastIds = allIds
  }

  clear(): void {
    for (const id of this._highlightedIds) {
      const el = document.getElementById(id)
      if (el) el.classList.remove("highlight-active", "highlight-preview")
    }
    this._highlightedIds.clear()
    this._lastIds = []
  }
}
