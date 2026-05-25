# 0001 — Bounding-box highlighting via per-page SVG overlays

Highlighting was CSS color-fill on `<g class="note">` — barely visible against the score. The replacement renders semi-transparent `<rect>` elements on an SVG overlay layer, wrapping note/ chord groups with optional tie extension. We chose per-page SVG overlays over DOM-positioned divs because: in scroll mode the overlay inherits `svgWrap`'s `transform: translateY` automatically, meaning highlight positions only update on column change, not every frame. DOM divs would require per-frame `getBoundingClientRect` for every visible note.

**Considered Options**

- **DOM-positioned divs**: simpler to inject (a div per box, absolutely positioned), but in scroll mode the svgWrap transform changes every frame, forcing `getBoundingClientRect` recalculation at 60 fps. Rejected on performance grounds.
- **Single global overlay SVG**: one `<svg>` covering all pages, would need synthetic viewBox stitching across per-page coordinate systems. Rejected because page SVGs are independent with no shared coordinate space.
