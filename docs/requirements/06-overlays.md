# Overlay Renderer Requirements (`OVER-*`)

Overlay rendering handles transient UI elements that are NOT part of the document.

See [ADR 0009: Content vs overlay separation](../adrs/0009-content-vs-overlay-separation.md).

## Overlay abstraction

- [ ] **OVER-1**: IOverlayRenderer interface separate from IRenderBackend
- [ ] **OVER-2**: Overlays are NEVER exported
- [ ] **OVER-3**: Overlays may be screen-aligned (don't rotate with 3D camera)
- [ ] **OVER-4**: Viewport owns both render backend and overlay renderer

## Selection overlays

- [x] **OVER-10**: Selection highlight around selected objects
- [x] **OVER-11**: Multi-selection bounding box
- [x] **OVER-12**: Resize handles on single selection
- [x] **OVER-13**: Vertex handles on lines/wires
- [x] **OVER-14**: Segment handles on lines/wires

## Marquee selection overlay

- [x] **OVER-20**: Enclosed mode marquee (solid border)
- [x] **OVER-21**: Intersect mode marquee (dashed border)
- [x] **OVER-22**: Different fill colors for each mode

## Tool hints and previews

- [x] **OVER-30**: Box/symbol preview while creating
- [x] **OVER-31**: Line/wire preview while drawing
- [~] **OVER-32**: Snap indicator at grid positions
- [~] **OVER-33**: Connection hints ("PIN", "CONNECT")
- [~] **OVER-34**: Hover highlight on objects

## Drag feedback

- [x] **OVER-40**: Drag ghost showing objects being moved
- [x] **OVER-41**: Rubber-band line while drawing wires

## Inline editing overlays

- [x] **OVER-50**: Blinking text cursor
- [ ] **OVER-51**: Text selection highlight

## Three.js overlay strategy

- [ ] **OVER-60**: 2D canvas overlay option (screen-aligned, on top of WebGL)
- [ ] **OVER-61**: 3D billboard option (rotate with scene, face camera)
- [ ] **OVER-62**: Hybrid option (hints 2D, handles 3D)
- [ ] **OVER-63**: Configurable per-element screen-alignment
