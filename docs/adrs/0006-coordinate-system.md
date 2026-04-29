# ADR 0006: Cell Coordinates as the Single Source of Truth

**Status:** Accepted

## Context

Every layer in the system needs to talk about positions: tools convert mouse events to grid positions, the renderer needs pixel positions to draw, exporters write characters at integer offsets, and the (future) 3D viewport needs world coordinates. If each layer chooses its own representation, conversion bugs proliferate.

## Decision

**All object positions and sizes are stored in integer cell coordinates `(col, row)`.** This is a hard invariant. Pixels and world units exist only at the rendering boundary.

### The coordinate flow

```
Screen input (mouse x,y)
        ↓
Viewport.screenToCell(x, y) → { col, row }
        ↓
Tool handler  ──────────────→ Cell coords throughout
        ↓
Object model (page.objects[].x = col, .y = row)
        ↓
DerivedStateComputer (cell coords)
        ↓
Render backend
        ↓
Backend.drawCell(col, row, char) → fillText / drawImage / mesh / SVG path
```

For 2D canvas, `screenToCell` is integer division by cell dimensions (with pan/zoom applied). For Three.js, it's a raycast against the XY plane followed by division.

### Hard rules

- **Tools never read pixel coordinates directly.** They use `context.viewport.screenToCell(x, y)`. There is no escape hatch.
- **Object positions and sizes are integers.** `obj.x`, `obj.y`, `obj.width`, `obj.height`, `line.points[i].{x,y}`, `pin.offset` (where 0..1 along an edge — the one floating-point exception, multiplied out at render time).
- **Cell dimensions are configurable, not hardcoded.** A backend declares its cell size; the viewport uses that for transforms. See [ADR 0001](0001-cell-based-engine.md).
- **Grid snapping is implicit.** Because positions are integers, there is nothing to "snap"; the question doesn't arise.

### The `CharacterGrid` legacy class

`js/core/CharacterGrid.js` predates the viewport abstraction. It still has `pixelToChar` / `charToPixel` methods used by the legacy `Renderer.js` fallback path. New code must use `viewport.screenToCell` / `viewport.cellToScreen`. CharacterGrid is slated for absorption into `Canvas2DViewport` once the legacy renderer is removed.

## Consequences

**Positive:**
- Hit testing is integer comparison.
- Snapping is automatic (there is no off-grid position to snap from).
- Tools written for the 2D canvas work in 3D unchanged — they only see cell coords.
- Save files are platform-independent (no DPR-dependent pixel offsets).
- Fonts can be swapped without re-positioning every object: the cell coordinates don't change, only the cell dimensions.

**Negative:**
- Sub-cell precision is impossible. Features like "move 0.5 cell" or "fade alignment" must use offsets or be modeled differently.
- Aspect-ratio mismatch: a "square" symbol in Berkeley Mono cells (10×20px) renders as a tall rectangle. UX must account for this when users expect visual squares.
- The legacy `CharacterGrid` and the modern `Viewport.screenToCell` both exist. Until the legacy renderer is removed, there are two coordinate paths in code.
