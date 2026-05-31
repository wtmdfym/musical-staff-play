export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const OFFSET_X = 500
const OFFSET_Y = 500
const DEFAULT_PAD_X = 60
const DEFAULT_PAD_Y = 60
const POINTER_EVENTS_STYLE = 'pointer-events:none'

export function getNotesInLayer(layer: Element, requireId = true): Element[] {
  const notes: Element[] = []
  const stack: Element[] = [layer]
  while (stack.length) {
    const el = stack.pop()!
    if (el.classList.contains('note') && (!requireId || el.id)) {
      notes.push(el)
      continue
    }
    for (let i = 0; i < el.children.length; i++) {
      stack.push(el.children[i])
    }
  }
  return notes
}

export class OverlayManager {
  private _svgWrapRef: { current: HTMLDivElement | null } | null = null

  bind(svgWrapRef: { current: HTMLDivElement | null }): void {
    this._svgWrapRef = svgWrapRef
  }

  unbind(): void {
    this._svgWrapRef = null
  }

  private _wrap(): HTMLDivElement | null {
    return this._svgWrapRef?.current ?? null
  }

  // ── 叠加组生命周期 ──

  ensureAllGroups(className: string): void {
    const wrap = this._wrap()
    if (!wrap) return
    const pageSvgs = wrap.querySelectorAll('svg')
    for (let i = 0; i < pageSvgs.length; i++) {
      this._ensureGroup(pageSvgs[i], className)
    }
  }

  getOrCreateGroup(svgId: string, className: string): Element | null {
    const el = document.getElementById(svgId)
    if (!el) return null
    const pageSvg = el.closest('svg')
    if (!pageSvg) return null
    return this._ensureGroup(pageSvg, className)
  }

  clearGroups(className: string): void {
    const wrap = this._wrap()
    if (!wrap) return
    const groups = wrap.querySelectorAll(`.${className}`)
    groups.forEach((g) => { g.innerHTML = '' })
  }

  removeGroups(className: string): void {
    const groups = document.querySelectorAll(`.${className}`)
    groups.forEach((g) => g.remove())
  }

  private _ensureGroup(pageSvg: Element, className: string): Element {
    let group = pageSvg.querySelector(`.${className}`)
    if (!group) {
      group = document.createElementNS(SVG_NS, 'g')
      group.classList.add(className)
      group.setAttribute('style', POINTER_EVENTS_STYLE)
      pageSvg.appendChild(group)
    }
    return group
  }

  // ── BBox 计算 ──

  getNoteBBox(svgId: string): BBox | null {
    const el = document.getElementById(svgId)
    if (!(el instanceof SVGGraphicsElement)) return null
    try {
      const b = el.getBBox()
      if (!b || (b.width === 0 && b.height === 0)) return null
      return { x: b.x, y: b.y, width: b.width, height: b.height }
    } catch {
      return null
    }
  }

  unionBBox(noteIds: string[]): BBox | null {
    const id = noteIds.pop() ?? ''
    const el = document.getElementById(id)
    if (!(el instanceof SVGGraphicsElement)) return null

    const b = el.getBBox()
    if (!b || (b.width === 0 && b.height === 0)) return null
    let minX = b.x
    let minY = b.y
    let maxX = b.x + b.width
    let maxY = b.y + b.height
    const anyEl: SVGGraphicsElement = el

    for (const id of noteIds) {
      const el = document.getElementById(id)
      if (!(el instanceof SVGGraphicsElement)) continue

      const b = el.getBBox()
      if (!b || (b.width === 0 && b.height === 0)) continue
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.width)
      maxY = Math.max(maxY, b.y + b.height)
    }
    if (noteIds.length > 0) {
      const stem = this.findStemElement(anyEl)
      if (stem) {
        const sb = stem.getBBox()
        if (sb && sb.height > 0) {
          minY = Math.min(minY, sb.y)
          maxY = Math.max(maxY, sb.y + sb.height)
        }
      }
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  finalizeBBox(bbox: BBox, padX = DEFAULT_PAD_X, padY = DEFAULT_PAD_Y): BBox {
    return {
      x: Math.floor(bbox.x - padX + OFFSET_X),
      y: Math.floor(bbox.y - padY + OFFSET_Y),
      width: Math.floor(bbox.width + padX * 2),
      height: Math.floor(bbox.height + padY * 2),
    }
  }

  // ── 工具 ──

  findStemElement(noteEl: SVGGraphicsElement): SVGGraphicsElement | null {
    const stem = noteEl.parentElement?.querySelector(':scope > g.stem')
    if (stem instanceof SVGGraphicsElement) return stem
    return null
  }

  get pageSvgs(): NodeListOf<SVGSVGElement> {
    const wrap = this._wrap()
    if (!wrap) return document.querySelectorAll('svg') as NodeListOf<SVGSVGElement>
    return wrap.querySelectorAll('svg') as NodeListOf<SVGSVGElement>
  }
}

let _instance: OverlayManager | null = null

export function getOverlayManager(): OverlayManager {
  if (!_instance) _instance = new OverlayManager()
  return _instance
}
