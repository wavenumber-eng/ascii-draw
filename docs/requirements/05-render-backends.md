# Render Backend Requirements (`BACK-*`)

The render backend determines what visual elements fill each cell.

See [ADR 0008: Pluggable rendering](../adrs/0008-pluggable-rendering.md) and [ADR 0009: Content vs overlay separation](../adrs/0009-content-vs-overlay-separation.md).

## Backend abstraction

- [ ] **BACK-1**: IRenderBackend interface abstracts rendering implementation
- [ ] **BACK-2**: Backends render cells, not pixels
- [ ] **BACK-3**: Backends support object-level drawing (box, line, symbol)
- [ ] **BACK-4**: Backends support overlay drawing (selection, handles, marquee)

## ASCII backend (current)

- [x] **BACK-10**: UTF-8 box-drawing characters for borders
- [x] **BACK-11**: Monospace character rendering
- [x] **BACK-12**: Shadow effects using `░ ▒ ▓` characters
- [x] **BACK-13**: Fill patterns (none, light, medium, dark, solid, dots)

## SVG backend (future)

- [ ] **BACK-20**: SVG elements for cell content
- [ ] **BACK-21**: Lines rendered as SVG `<line>` or `<path>`
- [ ] **BACK-22**: Boxes rendered as SVG `<rect>`
- [ ] **BACK-23**: Text rendered as SVG `<text>`
- [ ] **BACK-24**: Scalable vector output

## 3D extruded backend (future)

- [ ] **BACK-30**: Z-height extrusion for boxes/symbols when tilted
- [ ] **BACK-31**: Depth effect visible only at non-90° camera angles
- [ ] **BACK-32**: Optional per-object Z-index for extrusion height
