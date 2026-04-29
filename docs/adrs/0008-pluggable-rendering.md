# ADR 0008: Pluggable Viewport / Render Backend / Exporter Interfaces

**Status:** Accepted

## Context

The product roadmap includes more than ASCII output: SVG export, an experimental Three.js viewport, and possibly retro sprite tilesets. If rendering, export, and viewport interaction were entangled in one class (as they were in the original `Renderer.js`), each new format would require touching the same file and risk regressions in the others.

## Decision

Three orthogonal interfaces split rendering and export concerns, each with multiple implementations.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Editor (orchestrator only)                   │
└────────────────┬───────────────────┬──────────────┬─────────────┘
                 │                   │              │
       ┌─────────▼─────────┐  ┌──────▼─────┐  ┌─────▼──────┐
       │   IViewport       │  │ IRender-   │  │ IExporter  │
       │ (interactive)     │  │  Backend   │  │ (file out) │
       │                   │  │ (content)  │  │            │
       │ Canvas2DViewport  │  │ Canvas-    │  │ ASCII-     │
       │ ThreeJSViewport   │  │  ASCII-    │  │  Exporter  │
       │                   │  │  Backend   │  │ (future:   │
       │                   │  │            │  │  SVG/HTML/ │
       │                   │  │            │  │  ANSI)     │
       └─────────┬─────────┘  └────────────┘  └────────────┘
                 │
        ┌────────▼─────────┐
        │ IOverlayRenderer │
        │ (transient UI)   │  See ADR 0009
        │                  │
        │ Canvas2DOverlay  │
        └──────────────────┘
```

### IViewport

Owns coordinate transforms, camera, navigation, and event target. The viewport is the sole bridge between screen pixels and cell coordinates ([ADR 0006](0006-coordinate-system.md)).

```javascript
class IViewport {
  attach(container); detach();

  // The key abstraction
  screenToCell(x, y) → { col, row }
  cellToScreen(col, row) → { x, y }

  setCellDimensions(w, h); getCellDimensions();

  pan(dx, dy); zoom(factor, cx, cy); resetView();

  // 3D-specific (no-op in 2D)
  setTilt(angle); setIsometric(enabled); setCameraAngle(angle);

  setRenderBackend(backend); getRenderBackend();
  setOverlayRenderer(overlay); getOverlayRenderer();

  render(renderState); requestRender();

  getEventTarget();   // For mouse/keyboard listeners

  setGridVisible(visible); setGridDimensions(cols, rows);
}
```

Implementations: `Canvas2DViewport` (current default), `ThreeJSViewport` (experimental, working with `MapControls` + view presets).

### IRenderBackend

Renders **document content** — the cells, objects, and grid that *will be exported*. It does not draw selection highlights, marquees, or any other transient UI.

```javascript
class IRenderBackend {
  initialize(viewport); dispose();
  beginFrame(); endFrame(); clear();

  drawCell(col, row, char, style);
  drawText(col, row, text, style);

  drawBox(obj, options);
  drawLine(obj, options);
  drawSymbol(obj, options);
  drawWire(obj, options);
  drawJunction(obj, options);
  drawWireJunction(obj, options);
  drawWireNoConnect(obj, options);

  drawGrid(cols, rows, visible);

  getCharacterSet();   // Available glyphs/mappings
}
```

Implementations: `CanvasASCIIBackend` (current). Future: `ThreeJSASCIIBackend` (text meshes), `ThreeJSSVGBackend` (3D SVG), `SpriteBackend` (8-bit tilesets).

### IExporter

Produces file output. Decoupled from the on-screen render path because export has different requirements: no overlays, deterministic ordering, sometimes different character sets (e.g., ANSI vs plain ASCII).

```javascript
class IExporter {
  export(state, options)   → string | Blob
  getName(); getFileExtension(); getMimeType();
  getDefaultOptions(); validateOptions(options);
}
```

Implementations: `ASCIIExporter` (current). Future: `SVGExporter`, `HTMLExporter`, `ANSIExporter`, netlist/BOM exporters.

## Consequences

**Positive:**
- Each new render format is a new file, not a modification to a shared one.
- Three.js can be loaded conditionally (only when the user enables 3D mode).
- Tools work in any viewport unchanged because they only see `IViewport.screenToCell()`.
- Exporters are pure functions over state — they're easy to unit-test (`test/export.test.js`, `test/IExporter.test.js`).
- The interfaces double as documentation: a contributor adding a new backend has a clear contract to satisfy.

**Negative:**
- Multiple parallel render paths exist during the transition. The legacy `js/rendering/Renderer.js` is still loaded as a fallback. The new path runs through `Editor._renderWithNewArchitecture`. Until the legacy path is removed, both must be maintained.
- Cell-level vs object-level drawing creates redundancy: a backend that wants to render a box can use `drawCell` repeatedly or implement `drawBox` directly. Most use the latter for performance.
- The interface surface is wide — adding a new object type requires touching every backend. Today there's only one backend, so the cost is small; growth amplifies it.
