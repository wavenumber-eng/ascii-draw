# ADR 0001: Cell-Based Diagram Engine

**Status:** Accepted

## Context

This editor must support multiple visual representations: ASCII text in a `.md` file, vector graphics for documentation, and potentially 3D visualizations. We need a model that doesn't bake assumptions about glyph dimensions or pixel rendering into the object layer or the tools.

## Decision

Treat the editor as a **cell-based diagram engine** — conceptually identical to tile-based engines from 8/16-bit games. The grid is the universal coordinate system. Each cell holds one graphical element ("glyph"), and the rendering backend decides how to draw that glyph.

The same glyph can be rendered in multiple ways:

| Glyph | ASCII backend | Sprite backend | SVG backend |
|---|---|---|---|
| `─` | `fillText("─")` | `drawImage(tile_horizontal)` | `<line x1.../>` |
| `│` | `fillText("│")` | `drawImage(tile_vertical)` | `<line y1.../>` |
| `┌` | `fillText("┌")` | `drawImage(tile_corner_tl)` | `<path d="..."/>` |

**Cell dimensions are configurable, not hardcoded.** They depend on the font and rendering style:

| Font | Cell width | Cell height | Aspect |
|---|---|---|---|
| Berkeley Mono 16px | 10px | 20px | 1:2 (tall) |
| Press Start 2P | 8px | 8px | 1:1 (square) |
| Custom | any | any | any |

The object model and tools work in **integer cell coordinates (col, row) only**. The viewport translates between screen pixels and cells; the backend translates between cells and visual output. See [ADR 0006](0006-coordinate-system.md) for the coordinate-system rules.

## Consequences

**Positive:**
- The same document can be rendered as ASCII, SVG, or 3D without touching tools or the object model.
- Grid snapping is automatic — there are no fractional positions.
- Hit testing is trivial (compare integer coordinates).
- Objects align perfectly because everything lives on the same grid.

**Negative:**
- Sub-cell precision is impossible by design. Any feature that wants fractional placement (e.g., off-grid labels) must be modeled as cell-aligned with an offset attribute.
- Cell aspect ratios affect proportions: a "square" symbol in Berkeley Mono renders as a 1:2 tall rectangle in pixels. UI must compensate visually if needed.
- Tools must never read pixel coordinates directly. They receive cell coords from the viewport.
