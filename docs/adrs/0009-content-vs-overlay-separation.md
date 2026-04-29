# ADR 0009: Content Rendering Separate From Transient Overlays

**Status:** Accepted

## Context

A typical "render" call mixes two very different things:

- **Document content:** the cells, objects, grid, junctions — anything that would appear in a screenshot or be exported as ASCII.
- **Transient UI:** selection highlights, marquee rectangles, resize handles, drag ghosts, snap indicators, hover hints, blinking cursors.

If both are bundled into one `render(state)` method:
- Exporters have to filter out UI elements ("oops, the marquee got into the .txt file").
- A 3D viewport has nowhere good to put screen-aligned hints — content rotates with the camera, but a marquee should stay flat.
- The render code becomes a thicket of "if interactive then draw selection else don't."

## Decision

Split rendering into two interfaces with non-overlapping responsibilities.

| Interface | Renders | Exported? | Transforms with camera (in 3D)? |
|---|---|---|---|
| **`IRenderBackend`** | Document content (cells, objects, grid) | **Yes** | Yes |
| **`IOverlayRenderer`** | Transient UI (selection, handles, hints) | **No** | Configurable (defaults to screen-aligned) |

### IOverlayRenderer

```javascript
class IOverlayRenderer {
  initialize(viewport); dispose();
  beginFrame(); endFrame(); clear();

  // Selection
  drawSelectionHighlight(obj, style);
  drawMultiSelectionBox(bounds);
  drawResizeHandles(obj, handles);

  // Marquee
  drawMarquee(bounds, mode);   // 'enclosed' | 'intersect'

  // Tool hints
  drawToolPreview(preview);              // Box preview, line preview, etc.
  drawSnapIndicator(col, row);
  drawConnectionHint(pos, label);        // "PIN", "CONNECT"
  drawHoverHighlight(obj);

  // Drag feedback
  drawDragGhost(objects, offset);
  drawRubberBand(start, end, style);

  // Inline editing
  drawTextCursor(col, row, visible);
  drawTextSelection(start, end);

  // Vertex/segment handles (lines/wires)
  drawVertexHandle(col, row, type);
  drawSegmentHandle(col, row, orientation);

  // Pin handles (symbols)
  drawPinHandle(pos, selected);
  drawPinDropTarget(pos, valid);

  setScreenAligned(aligned);   // Default true; for 3D, decide per-element
}
```

### Implementation strategies

**Canvas 2D viewport** can share the same canvas for content and overlays — content draws first, overlays on top. This is what `Canvas2DOverlay` does today.

**Three.js viewport** has several options:

- **(A) 2D canvas overlay on top of WebGL** *(recommended default).* A separate 2D canvas, positioned absolutely over the WebGL surface with `pointer-events: none`. Always screen-aligned. Familiar drawing API.
- **(B) CSS3D overlay** for HTML elements (tooltips, menus).
- **(C) 3D billboards** that rotate with the scene but always face the camera.
- **(D) Hybrid.** Selection handles in 3D (move with content when tilted), tooltips/snap indicators in 2D (always readable).

The viewport chooses the strategy based on configuration; tools don't know.

### Migration status

**Today:** `Canvas2DOverlay` exists and implements the interface, but **tools still draw their overlays directly to the 2D canvas context** in `renderOverlay(ctx, context)`. This works because the 2D canvas is shared. It blocks proper Three.js overlay support.

The migration plan is to have `Editor.toolManager.renderOverlay()` route through `viewport.getOverlayRenderer()` instead of direct `ctx` access. Each tool's `renderOverlay` would call `overlay.drawMarquee(...)`, `overlay.drawDragGhost(...)`, etc. See [the implementation plan audit](../plans/00-status-audit.md) for current status.

## Consequences

**Positive:**
- Exports never accidentally include UI. The exporter only consumes `IRenderBackend` output.
- Selection highlights stay flat in 3D mode without the renderer growing camera-awareness.
- Visual debugging is cleaner: an "export preview" can hide overlays by simply not running them.

**Negative:**
- Two render passes per frame — one for content, one for overlays. Negligible at current scale.
- The migration is incomplete. As long as tools draw directly to `ctx`, the abstraction is leaky and Three.js overlays don't fully work.
- Tools need a stable overlay API. Today some overlay needs (e.g., the inline edit cursor) bleed into the renderer rather than going through `IOverlayRenderer.drawTextCursor`.
