import type { HighlightColumn, HighlightColumnNote } from "../score/ScoreTypes";
import { getNotesInLayer, getOverlayManager, type BBox } from "./OverlayManager";

interface NoteGroup {
  overlayGroup: Element;
  noteIds: string[];
  staffIndex: number;
  voice: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg'

export class BoxHighlightRenderer {
  private _activeClass = "hl-box-active";
  private _previewClass = "hl-box-preview";

  private _om = getOverlayManager()

  update(columns: HighlightColumn[]): void {
    this._om.ensureAllGroups("hl-overlay-group");
    this._checkPageSig();

    if (columns.length === 0) return;

    this._om.clearGroups("hl-overlay-group");

    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      const cls = ci === 0 ? this._activeClass : this._previewClass;

      const groups = this._groupNotesByStaffVoice(col.notes);
      for (const group of groups) {
        const bbox = this._om.unionBBox(group.noteIds);
        if (!bbox) continue;
        const final = this._om.finalizeBBox(bbox);
        this._drawRect(group.overlayGroup, final, cls);

        const tieBoxes = this._computeTieBoxes(group);
        for (const tieBox of tieBoxes) {
          const tfinal = this._om.finalizeBBox(tieBox);
          this._drawRect(group.overlayGroup, tfinal, cls + " hl-box-tie");
        }
      }
    }
  }

  clear(): void {
    this._om.clearGroups("hl-overlay-group");
  }

  rebuildTieInfo(): void {
    this._tieMap = this._buildTieMap();
  }

  private _tieMap = new Map<string, string[]>();
  private _lastPageSig = "";

  private _checkPageSig(): void {
    const pageSvgs = this._om.pageSvgs;
    let pageSig = String(pageSvgs.length);
    for (let i = 0; i < pageSvgs.length; i++) {
      pageSig += "|" + (pageSvgs[i].getAttribute("viewBox") ?? "");
    }
    if (this._lastPageSig !== pageSig) {
      this.rebuildTieInfo();
      this._lastPageSig = pageSig;
    }
  }

  private _groupNotesByStaffVoice(notes: HighlightColumnNote[]): NoteGroup[] {
    if (notes.length === 0) return [];

    const groups = new Map<string, NoteGroup>();

    for (const note of notes) {
      const el = document.getElementById(note.svgId);
      if (!el) continue;
      const overlayGroup = this._om.getOrCreateGroup(note.svgId, "hl-overlay-group");
      if (!overlayGroup) continue;

      const key = `${note.staffIndex}:${note.voice}`;
      if (!groups.has(key)) {
        groups.set(key, {
          overlayGroup,
          noteIds: [],
          staffIndex: note.staffIndex,
          voice: note.voice,
        });
      }
      groups.get(key)!.noteIds.push(note.svgId);
    }

    return Array.from(groups.values());
  }

  private _drawRect(overlayGroup: Element, bbox: BBox, cls: string): void {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(bbox.x));
    rect.setAttribute("y", String(bbox.y));
    rect.setAttribute("width", String(Math.max(0, bbox.width)));
    rect.setAttribute("height", String(Math.max(0, bbox.height)));
    rect.classList.add(cls);
    overlayGroup.appendChild(rect);
  }

  private _computeTieBoxes(group: NoteGroup): BBox[] {
    if (this._tieMap.size === 0) return [];

    const boxes: BBox[] = [];
    const processed = new Set<string>();

    for (const id of group.noteIds) {
      const tiedIds = this._tieMap.get(id);
      if (!tiedIds || tiedIds.length === 0) continue;
      if (processed.has(id)) continue;

      for (const tiedId of tiedIds) {
        if (processed.has(tiedId)) continue;
        const el1 = document.getElementById(id);
        const el2 = document.getElementById(tiedId);
        if (
          !(el1 instanceof SVGGraphicsElement) ||
          !(el2 instanceof SVGGraphicsElement)
        )
          continue;

        const svg1 = el1.closest("svg");
        const svg2 = el2.closest("svg");
        if (!svg1 || !svg2) continue;

        let bbox1: BBox | null = null;
        let bbox2: BBox | null = null;
        try {
          const b1 = el1.getBBox();
          if (b1 && (b1.width > 0 || b1.height > 0))
            bbox1 = { x: b1.x, y: b1.y, width: b1.width, height: b1.height };
          const b2 = el2.getBBox();
          if (b2 && (b2.width > 0 || b2.height > 0))
            bbox2 = { x: b2.x, y: b2.y, width: b2.width, height: b2.height };
        } catch {
          continue;
        }
        if (!bbox1 || !bbox2) continue;

        if (svg1 === svg2) {
          boxes.push({
            x: Math.min(bbox1.x, bbox2.x),
            y: Math.min(bbox1.y, bbox2.y),
            width:
              Math.max(bbox1.x + bbox1.width, bbox2.x + bbox2.width) -
              Math.min(bbox1.x, bbox2.x),
            height:
              Math.max(bbox1.y + bbox1.height, bbox2.y + bbox2.height) -
              Math.min(bbox1.y, bbox2.y),
          });
          processed.add(id);
          processed.add(tiedId);
        } else {
          const overlayGroup = group.overlayGroup;
          if (overlayGroup === svg1.querySelector(".hl-overlay-group")) {
            boxes.push(this._extendEdgeBBox(bbox1, true));
          } else if (overlayGroup === svg2.querySelector(".hl-overlay-group")) {
            boxes.push(this._extendEdgeBBox(bbox2, false));
          }
          processed.add(id);
          processed.add(tiedId);
        }
      }
    }

    return boxes;
  }

  private _extendEdgeBBox(bbox: BBox, extendRight: boolean): BBox {
    const ext = bbox.width * 1.5;
    if (extendRight) {
      return {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width + ext,
        height: bbox.height,
      };
    }
    return {
      x: bbox.x - ext,
      y: bbox.y,
      width: bbox.width + ext,
      height: bbox.height,
    };
  }

  private _buildTieMap(): Map<string, string[]> {
    const tieMap = new Map<string, string[]>();
    const pageSvgs = this._om.pageSvgs;

    for (const pageSvgEl of pageSvgs) {
      const ties = pageSvgEl.querySelectorAll("path.tie");
      if (ties.length === 0) continue;

      const layers = pageSvgEl.querySelectorAll(".layer");
      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li];
        const layerTies = layer.querySelectorAll(":scope > path.tie");
        if (layerTies.length === 0) continue;

        const layerNotes = getNotesInLayer(layer);
        for (let ti = 0; ti < layerTies.length; ti++) {
          const tiePath = layerTies[ti];
          if (!(tiePath instanceof SVGGraphicsElement)) continue;

          let tieBBox: BBox | null = null;
          try {
            const b = tiePath.getBBox();
            if (b && (b.width > 0 || b.height > 0)) {
              tieBBox = { x: b.x, y: b.y, width: b.width, height: b.height };
            }
          } catch {
            continue;
          }
          if (!tieBBox) continue;

          const tieMidX = tieBBox.x + tieBBox.width / 2;

          const candidates: { id: string; dist: number }[] = [];
          for (const noteEl of layerNotes) {
            if (!(noteEl instanceof SVGGraphicsElement) || !noteEl.id) continue;
            let noteBBox: BBox | null = null;
            try {
              const nb = noteEl.getBBox();
              if (nb && (nb.width > 0 || nb.height > 0)) {
                noteBBox = {
                  x: nb.x,
                  y: nb.y,
                  width: nb.width,
                  height: nb.height,
                };
              }
            } catch {
              continue;
            }
            if (!noteBBox) continue;
            const noteMidX = noteBBox.x + noteBBox.width / 2;
            candidates.push({
              id: noteEl.id,
              dist: Math.abs(noteMidX - tieMidX),
            });
          }

          candidates.sort((a, b) => a.dist - b.dist);

          const startNote = candidates[0];
          const endNote = candidates[1];
          if (startNote && endNote) {
            if (!tieMap.has(startNote.id)) tieMap.set(startNote.id, []);
            if (!tieMap.has(endNote.id)) tieMap.set(endNote.id, []);
            tieMap.get(startNote.id)!.push(endNote.id);
            tieMap.get(endNote.id)!.push(startNote.id);
          }
        }
      }
    }

    return tieMap;
  }

}
