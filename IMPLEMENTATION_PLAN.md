# Implementation & Test Plan

This document outlines the implementation phases, specific tasks, and test requirements for the pluggable architecture refactor.

**Related Documents:**
- `ARCHITECTURE.md` - Technical design and interfaces
- `REQUIREMENTS.md` - Functional requirements with status

---

## Overview

The refactor transforms the current monolithic rendering system into a pluggable architecture with:
- **Viewport abstraction** (Canvas2D, Three.js)
- **Render backend abstraction** (ASCII, SVG, 3D)
- **Overlay renderer abstraction** (2D overlays, 3D billboards)
- **Exporter abstraction** (ASCII, SVG, HTML)
- **Domain logic extraction** (Wire, Symbol, Line utilities)

```
Current Architecture:
┌─────────────────────────────────────────────┐
│ Editor.js (canvas, events, tools, render)   │
├─────────────────────────────────────────────┤
│ Renderer.js (content + overlays + export)   │
├─────────────────────────────────────────────┤
│ Tools (use canvas/grid directly)            │
└─────────────────────────────────────────────┘

Target Architecture:
┌─────────────────────────────────────────────┐
│ Editor.js (orchestrator only)               │
├──────────────┬──────────────────────────────┤
│ IViewport    │ Canvas2DViewport             │
│              │ ThreeJSViewport              │
├──────────────┼──────────────────────────────┤
│ IRenderBackend│ CanvasASCIIBackend          │
│              │ ThreeJSASCIIBackend          │
├──────────────┼──────────────────────────────┤
│ IOverlayRenderer│ Canvas2DOverlay           │
│              │ ThreeJSOverlay               │
├──────────────┼──────────────────────────────┤
│ IExporter    │ ASCIIExporter                │
│              │ SVGExporter                  │
├──────────────┴──────────────────────────────┤
│ Tools (use viewport.screenToCell() only)    │
├─────────────────────────────────────────────┤
│ Domain (Wire.js, Symbol.js, Line.js)        │
└─────────────────────────────────────────────┘
```

---

## Phase 1: Interface Definitions & Infrastructure

**Goal:** Define all interfaces and create infrastructure without breaking existing functionality.

### 1.1 Create Interface Definition Files

These files document the interfaces (JavaScript doesn't have formal interfaces, but we use JSDoc and base classes).

| File | Purpose | Priority |
|------|---------|----------|
| `js/viewport/IViewport.js` | Viewport interface definition | High |
| `js/backends/IRenderBackend.js` | Content rendering interface | High |
| `js/overlays/IOverlayRenderer.js` | UI overlay interface | High |
| `js/export/IExporter.js` | File export interface | Medium |

#### Task 1.1.1: Create `js/viewport/IViewport.js`

```javascript
/**
 * IViewport - Abstract viewport interface
 *
 * Implementations must provide:
 * - Coordinate transforms (screenToCell, cellToScreen)
 * - Navigation (pan, zoom, tilt for 3D)
 * - Render backend and overlay management
 * - Event target for mouse/keyboard
 */
var AsciiEditor = AsciiEditor || {};
AsciiEditor.viewport = AsciiEditor.viewport || {};

AsciiEditor.viewport.IViewport = class IViewport {
  // Lifecycle
  attach(container) { throw new Error('Not implemented'); }
  detach() { throw new Error('Not implemented'); }

  // Coordinate transforms
  screenToCell(screenX, screenY) { throw new Error('Not implemented'); }
  cellToScreen(col, row) { throw new Error('Not implemented'); }

  // Cell dimensions
  setCellDimensions(width, height) { throw new Error('Not implemented'); }
  getCellDimensions() { throw new Error('Not implemented'); }

  // Navigation
  pan(dx, dy) { throw new Error('Not implemented'); }
  zoom(factor, centerX, centerY) { throw new Error('Not implemented'); }
  resetView() { throw new Error('Not implemented'); }

  // 3D-specific (no-op for 2D)
  setTilt(angle) {}
  setIsometric(enabled) {}
  setCameraAngle(angle) {}

  // Rendering
  setRenderBackend(backend) { throw new Error('Not implemented'); }
  getRenderBackend() { throw new Error('Not implemented'); }
  setOverlayRenderer(overlay) { throw new Error('Not implemented'); }
  getOverlayRenderer() { throw new Error('Not implemented'); }
  render(renderState) { throw new Error('Not implemented'); }
  requestRender() { throw new Error('Not implemented'); }

  // Events
  getEventTarget() { throw new Error('Not implemented'); }

  // Grid
  setGridVisible(visible) { throw new Error('Not implemented'); }
  setGridDimensions(cols, rows) { throw new Error('Not implemented'); }
};
```

#### Task 1.1.2: Create `js/backends/IRenderBackend.js`

```javascript
/**
 * IRenderBackend - Content rendering interface (exportable content only)
 */
AsciiEditor.backends = AsciiEditor.backends || {};

AsciiEditor.backends.IRenderBackend = class IRenderBackend {
  // Lifecycle
  initialize(viewport) { throw new Error('Not implemented'); }
  dispose() {}

  // Frame management
  beginFrame() {}
  endFrame() {}
  clear() { throw new Error('Not implemented'); }

  // Cell-level drawing
  drawCell(col, row, char, style) { throw new Error('Not implemented'); }
  drawText(col, row, text, style) { throw new Error('Not implemented'); }

  // Object-level drawing
  drawBox(obj, options) { throw new Error('Not implemented'); }
  drawLine(obj, options) { throw new Error('Not implemented'); }
  drawSymbol(obj, options) { throw new Error('Not implemented'); }
  drawJunction(obj, options) { throw new Error('Not implemented'); }

  // Grid
  drawGrid(cols, rows, visible) { throw new Error('Not implemented'); }

  // Style support
  getCharacterSet() { throw new Error('Not implemented'); }
};
```

#### Task 1.1.3: Create `js/overlays/IOverlayRenderer.js`

```javascript
/**
 * IOverlayRenderer - Transient UI overlay interface (never exported)
 */
AsciiEditor.overlays = AsciiEditor.overlays || {};

AsciiEditor.overlays.IOverlayRenderer = class IOverlayRenderer {
  // Lifecycle
  initialize(viewport) { throw new Error('Not implemented'); }
  dispose() {}

  // Frame management
  beginFrame() {}
  endFrame() {}
  clear() { throw new Error('Not implemented'); }

  // Selection overlays
  drawSelectionHighlight(obj, style) { throw new Error('Not implemented'); }
  drawMultiSelectionBox(bounds) { throw new Error('Not implemented'); }
  drawResizeHandles(obj, handles) { throw new Error('Not implemented'); }

  // Marquee
  drawMarquee(bounds, mode) { throw new Error('Not implemented'); }

  // Tool hints
  drawToolPreview(preview) { throw new Error('Not implemented'); }
  drawSnapIndicator(col, row) {}
  drawConnectionHint(pos, label) {}
  drawHoverHighlight(obj) {}

  // Drag feedback
  drawDragGhost(objects, offset) {}
  drawRubberBand(start, end, style) {}

  // Inline editing
  drawTextCursor(col, row, visible) {}
  drawTextSelection(start, end) {}

  // Handle drawing
  drawVertexHandle(col, row, type) { throw new Error('Not implemented'); }
  drawSegmentHandle(col, row, orientation) { throw new Error('Not implemented'); }
  drawPinHandle(pos, selected) {}
  drawPinDropTarget(pos, valid) {}

  // 3D configuration
  setScreenAligned(aligned) {}
};
```

#### Task 1.1.4: Create `js/export/IExporter.js`

```javascript
/**
 * IExporter - File export interface
 */
AsciiEditor.export = AsciiEditor.export || {};

AsciiEditor.export.IExporter = class IExporter {
  // Export
  export(state, options) { throw new Error('Not implemented'); }

  // Metadata
  getName() { throw new Error('Not implemented'); }
  getFileExtension() { throw new Error('Not implemented'); }
  getMimeType() { throw new Error('Not implemented'); }

  // Options
  getDefaultOptions() { return {}; }
  validateOptions(options) { return true; }
};
```

### 1.2 Create Directory Structure

```bash
# Create new directories
mkdir -p js/viewport
mkdir -p js/backends
mkdir -p js/overlays
mkdir -p js/export
mkdir -p js/domain
```

### 1.3 Tests for Phase 1

| Test File | Purpose |
|-----------|---------|
| `test/viewport.test.js` | Interface contract tests |
| `test/backends.test.js` | Backend interface contract tests |
| `test/overlays.test.js` | Overlay interface contract tests |

---

## Phase 2: Extract Canvas2D Implementation

**Goal:** Refactor current code into the new interfaces without changing behavior.

### 2.1 Extract Canvas2DViewport

Extract viewport logic from `Editor.js` into `Canvas2DViewport.js`.

#### Task 2.1.1: Create `js/viewport/Canvas2DViewport.js`

Extract from Editor.js:
- Canvas element creation/management
- Mouse/keyboard event handling (but dispatch to tools)
- Pan/zoom state and transforms
- `screenToCell()` / `cellToScreen()` (currently in CharacterGrid)
- Grid dimensions

```javascript
/**
 * Canvas2DViewport - 2D canvas viewport implementation
 * Refactored from: Editor.js canvas management + CharacterGrid
 */
AsciiEditor.viewport.Canvas2DViewport = class Canvas2DViewport extends AsciiEditor.viewport.IViewport {
  constructor(options = {}) {
    super();
    this.canvas = null;
    this.ctx = null;
    this.cellWidth = options.cellWidth || 10;
    this.cellHeight = options.cellHeight || 20;
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.gridCols = options.cols || 120;
    this.gridRows = options.rows || 60;
    this.gridVisible = true;
    this.renderBackend = null;
    this.overlayRenderer = null;
  }

  attach(container) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);
    this._setupEventListeners();
    this._resize();
  }

  screenToCell(screenX, screenY) {
    // Account for pan and zoom
    const x = (screenX - this.panX) / this.zoom;
    const y = (screenY - this.panY) / this.zoom;
    return {
      col: Math.floor(x / this.cellWidth),
      row: Math.floor(y / this.cellHeight)
    };
  }

  cellToScreen(col, row) {
    return {
      x: col * this.cellWidth * this.zoom + this.panX,
      y: row * this.cellHeight * this.zoom + this.panY
    };
  }

  // ... rest of implementation
};
```

#### Task 2.1.2: Update CharacterGrid.js

Keep CharacterGrid for backward compatibility but mark as deprecated. New code should use viewport methods.

```javascript
/**
 * @deprecated Use viewport.screenToCell() and viewport.cellToScreen() instead
 */
```

### 2.2 Extract CanvasASCIIBackend

Extract content rendering from `Renderer.js` into `CanvasASCIIBackend.js`.

#### Task 2.2.1: Create `js/backends/CanvasASCIIBackend.js`

Extract from Renderer.js:
- `drawBox()`, `drawLine()`, `drawSymbol()`, `drawJunction()`
- `drawWire()`, `drawWireJunction()`, `drawWireNoConnect()`
- `drawText()` for content
- `drawGrid()` (grid is content, may be exported)
- Box-drawing character sets
- Fill patterns

```javascript
/**
 * CanvasASCIIBackend - ASCII content rendering to 2D canvas
 * Refactored from: Renderer.js content drawing methods
 */
AsciiEditor.backends.CanvasASCIIBackend = class CanvasASCIIBackend extends AsciiEditor.backends.IRenderBackend {
  constructor() {
    super();
    this.viewport = null;
    this.ctx = null;
    this.characterSet = { /* box drawing chars */ };
  }

  initialize(viewport) {
    this.viewport = viewport;
    this.ctx = viewport.canvas.getContext('2d');
  }

  drawBox(obj, options) {
    // Extract from Renderer.drawBox()
  }

  drawLine(obj, options) {
    // Extract from Renderer.drawLine()
  }

  // ... etc
};
```

### 2.3 Extract Canvas2DOverlay

Extract overlay rendering from `Renderer.js` into `Canvas2DOverlay.js`.

#### Task 2.3.1: Create `js/overlays/Canvas2DOverlay.js`

Extract from Renderer.js:
- `drawSelectionHighlight()`
- `drawResizeHandles()`
- `drawMarquee()`
- `drawVertexHandle()`, `drawSegmentHandle()`
- Cursor rendering
- Tool preview rendering (from tool `renderOverlay()` methods)

```javascript
/**
 * Canvas2DOverlay - 2D canvas overlay rendering
 * Refactored from: Renderer.js overlay methods + tool renderOverlay()
 */
AsciiEditor.overlays.Canvas2DOverlay = class Canvas2DOverlay extends AsciiEditor.overlays.IOverlayRenderer {
  constructor() {
    super();
    this.viewport = null;
    this.ctx = null;
  }

  initialize(viewport) {
    this.viewport = viewport;
    this.ctx = viewport.canvas.getContext('2d');
  }

  drawSelectionHighlight(obj, style) {
    // Extract from Renderer selection drawing
  }

  drawMarquee(bounds, mode) {
    // Extract from Renderer/SelectTool marquee drawing
  }

  // ... etc
};
```

### 2.4 Refactor Editor.js

Update Editor.js to use the new abstractions.

#### Task 2.4.1: Update Editor Constructor

```javascript
// Before:
this.canvas = document.getElementById('canvas');
this.ctx = this.canvas.getContext('2d');
this.grid = new CharacterGrid(10, 20);
this.renderer = new Renderer(this.ctx, this.grid);

// After:
this.viewport = new Canvas2DViewport({ cellWidth: 10, cellHeight: 20 });
this.viewport.attach(document.getElementById('canvas-container'));
this.viewport.setRenderBackend(new CanvasASCIIBackend());
this.viewport.setOverlayRenderer(new Canvas2DOverlay());
```

#### Task 2.4.2: Update Tool Context

```javascript
// Before:
const context = {
  canvas: this.canvas,
  grid: this.grid,
  history: this.history,
  // ...
};

// After:
const context = {
  viewport: this.viewport,  // Tools use viewport.screenToCell()
  history: this.history,
  // ...
};
```

### 2.5 Refactor Tools

Update all tools to use `context.viewport` instead of `context.canvas/grid`.

#### Task 2.5.1: Update Tool.js Base Class

```javascript
// Add helper method
getCell(event, context) {
  const rect = context.viewport.getEventTarget().getBoundingClientRect();
  return context.viewport.screenToCell(
    event.clientX - rect.left,
    event.clientY - rect.top
  );
}
```

#### Task 2.5.2: Update Each Tool

| Tool | Changes Required |
|------|-----------------|
| SelectTool.js | Replace `grid.pixelToChar()` with `viewport.screenToCell()` |
| BoxTool.js | Replace `grid.pixelToChar()` with `viewport.screenToCell()` |
| LineTool.js | Replace `grid.pixelToChar()` with `viewport.screenToCell()` |
| WireTool.js | Replace `grid.pixelToChar()` with `viewport.screenToCell()` |
| TextTool.js | Replace `grid.pixelToChar()` with `viewport.screenToCell()` |
| SymbolTool.js | Replace `grid.pixelToChar()` with `viewport.screenToCell()` |
| PinTool.js | Replace `grid.pixelToChar()` with `viewport.screenToCell()` |

### 2.6 Tests for Phase 2

| Test File | Tests |
|-----------|-------|
| `test/Canvas2DViewport.test.js` | Coordinate transforms, pan/zoom |
| `test/CanvasASCIIBackend.test.js` | Content rendering (box, line, symbol) |
| `test/Canvas2DOverlay.test.js` | Overlay rendering (selection, marquee) |
| `test/tool-viewport.test.js` | Tools work with viewport abstraction |

---

## Phase 3: Extract Domain Logic

**Goal:** Extract business logic from tools into reusable domain modules.

### 3.1 Create Domain Modules

#### Task 3.1.1: Create `js/domain/Wire.js`

Extract from WireTool.js and SelectTool.js:
- `isFloatingEndpoint(wire, endIndex, objects)`
- `findFloatingEnds(objects)`
- `getConnectedWires(wire, objects)`
- `canBindToPin(point, objects)`
- `findPinAtPoint(point, objects)`

```javascript
/**
 * Wire domain utilities
 * Extracted from: WireTool.js, SelectTool.js
 */
AsciiEditor.domain = AsciiEditor.domain || {};

AsciiEditor.domain.Wire = {
  /**
   * Check if a wire endpoint is floating (unbound)
   */
  isFloatingEndpoint(wire, endIndex, objects) {
    const binding = endIndex === 0 ? wire.startBinding : wire.endBinding;
    if (binding) return false;

    // Check if endpoint touches another wire (junction)
    const point = wire.points[endIndex];
    // ... logic from WireTool
  },

  /**
   * Find all floating wire ends in the document
   */
  findFloatingEnds(objects) {
    const wires = objects.filter(o => o.type === 'wire');
    const results = [];
    // ... logic
    return results;
  },

  /**
   * Find a pin at the given cell position
   */
  findPinAtPoint(col, row, objects) {
    const symbols = objects.filter(o => o.type === 'symbol');
    for (const symbol of symbols) {
      for (const pin of symbol.pins || []) {
        const pinPos = AsciiEditor.domain.Symbol.getPinWorldPosition(symbol, pin);
        if (pinPos.col === col && pinPos.row === row) {
          return { symbol, pin };
        }
      }
    }
    return null;
  }
};
```

#### Task 3.1.2: Create `js/domain/Symbol.js`

Extract from Renderer.js and SelectTool.js:
- `getPinWorldPosition(symbol, pin)`
- `findSymbolEdge(point, symbol)`
- `getPinAtEdgeOffset(symbol, edge, offset)`
- `getNextDesignatorNumber(prefix, objects)`

```javascript
/**
 * Symbol domain utilities
 * Extracted from: Renderer.js, SelectTool.js, SymbolTool.js
 */
AsciiEditor.domain.Symbol = {
  /**
   * Calculate pin world position from symbol position + edge + offset
   */
  getPinWorldPosition(symbol, pin) {
    const { x, y, width, height } = symbol;
    const offset = pin.offset || 0.5;

    switch (pin.edge) {
      case 'left':
        return { col: x, row: Math.floor(y + offset * (height - 1)) };
      case 'right':
        return { col: x + width - 1, row: Math.floor(y + offset * (height - 1)) };
      case 'top':
        return { col: Math.floor(x + offset * (width - 1)), row: y };
      case 'bottom':
        return { col: Math.floor(x + offset * (width - 1)), row: y + height - 1 };
      default:
        return { col: x, row: y };
    }
  },

  /**
   * Find which edge of a symbol a point is on
   */
  findSymbolEdge(col, row, symbol) {
    const { x, y, width, height } = symbol;
    if (col === x && row >= y && row < y + height) return 'left';
    if (col === x + width - 1 && row >= y && row < y + height) return 'right';
    if (row === y && col >= x && col < x + width) return 'top';
    if (row === y + height - 1 && col >= x && col < x + width) return 'bottom';
    return null;
  },

  /**
   * Get next available designator number for a prefix
   */
  getNextDesignatorNumber(prefix, objects) {
    const symbols = objects.filter(o => o.type === 'symbol');
    const usedNumbers = symbols
      .filter(s => s.designator?.prefix === prefix)
      .map(s => s.designator?.number || 0);
    return usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
  }
};
```

#### Task 3.1.3: Create `js/domain/Line.js`

Extract from LineTool.js and DerivedStateComputer.js:
- `getSegments(line)`
- `pointOnSegment(point, segment)`
- `findIntersections(lines)`
- `mergeLines(line1, line2)`

```javascript
/**
 * Line domain utilities
 * Extracted from: LineTool.js, DerivedStateComputer.js
 */
AsciiEditor.domain.Line = {
  /**
   * Get segments from a polyline
   */
  getSegments(line) {
    const segments = [];
    for (let i = 0; i < line.points.length - 1; i++) {
      segments.push({
        start: line.points[i],
        end: line.points[i + 1],
        index: i
      });
    }
    return segments;
  },

  /**
   * Check if a point lies on a segment
   */
  pointOnSegment(col, row, segment) {
    const { start, end } = segment;
    // Horizontal segment
    if (start.y === end.y && row === start.y) {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      return col >= minX && col <= maxX;
    }
    // Vertical segment
    if (start.x === end.x && col === start.x) {
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      return row >= minY && row <= maxY;
    }
    return false;
  },

  /**
   * Find intersection points between lines
   */
  findIntersections(lines) {
    const intersections = [];
    // ... logic from DerivedStateComputer
    return intersections;
  }
};
```

### 3.2 Update Tools to Use Domain Modules

| Tool | Domain Methods to Use |
|------|----------------------|
| WireTool.js | `Wire.findPinAtPoint()`, `Wire.isFloatingEndpoint()` |
| SelectTool.js | `Symbol.getPinWorldPosition()`, `Wire.findPinAtPoint()` |
| SymbolTool.js | `Symbol.getNextDesignatorNumber()` |
| PinTool.js | `Symbol.findSymbolEdge()`, `Symbol.getPinWorldPosition()` |
| LineTool.js | `Line.pointOnSegment()`, `Line.mergeLines()` |

### 3.3 Update DerivedStateComputer

Use domain modules instead of inline logic:
- `Line.findIntersections()` for junction computation
- `Wire.isFloatingEndpoint()` for no-connect detection

### 3.4 Tests for Phase 3

| Test File | Tests |
|-----------|-------|
| `test/domain/Wire.test.js` | Floating ends, pin binding, wire joining |
| `test/domain/Symbol.test.js` | Pin positions, edge detection, designators |
| `test/domain/Line.test.js` | Segments, intersections, merging |

---

## Phase 4: Extract Exporters

**Goal:** Separate file export from on-screen rendering.

### 4.1 Create ASCIIExporter

Extract ASCII export logic from Renderer.js.

#### Task 4.1.1: Create `js/export/ASCIIExporter.js`

```javascript
/**
 * ASCIIExporter - Plain text export
 * Extracted from: Renderer.js export methods
 */
AsciiEditor.export.ASCIIExporter = class ASCIIExporter extends AsciiEditor.export.IExporter {
  constructor() {
    super();
    this.characterSet = { /* same as CanvasASCIIBackend */ };
  }

  export(state, options = {}) {
    const page = this._getPage(state, options.pageId);
    const buffer = this._createBuffer(page.width, page.height);

    // Render objects to buffer (sorted by render order)
    const objects = this._sortByRenderOrder(page.objects);
    for (const obj of objects) {
      this._renderObject(obj, buffer);
    }

    return this._bufferToString(buffer);
  }

  getName() { return 'ASCII'; }
  getFileExtension() { return 'txt'; }
  getMimeType() { return 'text/plain'; }

  _renderObject(obj, buffer) {
    switch (obj.type) {
      case 'box': this._renderBox(obj, buffer); break;
      case 'line': this._renderLine(obj, buffer); break;
      case 'symbol': this._renderSymbol(obj, buffer); break;
      // ... etc
    }
  }

  // ... rendering methods similar to CanvasASCIIBackend but write to buffer
};
```

### 4.2 Tests for Phase 4

| Test File | Tests |
|-----------|-------|
| `test/export/ASCIIExporter.test.js` | Box export, line export, symbol export |
| (existing) `test/export.test.js` | Update to use new exporter |

---

## Phase 5: Three.js Implementation

**Goal:** Add Three.js viewport as an alternative to Canvas2D.

### 5.1 Create ThreeJSViewport

#### Task 5.1.1: Create `js/viewport/ThreeJSViewport.js`

```javascript
/**
 * ThreeJSViewport - Three.js 3D viewport implementation
 */
AsciiEditor.viewport.ThreeJSViewport = class ThreeJSViewport extends AsciiEditor.viewport.IViewport {
  constructor(options = {}) {
    super();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.cellWidth = options.cellWidth || 10;
    this.cellHeight = options.cellHeight || 20;
    this.raycaster = new THREE.Raycaster();
    this.plane = null; // XY plane for raycasting
  }

  attach(container) {
    // Create Three.js scene
    this.scene = new THREE.Scene();

    // Orthographic camera (top-down view)
    this.camera = new THREE.OrthographicCamera(/* ... */);
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    // WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    container.appendChild(this.renderer.domElement);

    // MapControls for pan/zoom/tilt
    this.controls = new THREE.MapControls(this.camera, this.renderer.domElement);

    // XY plane for raycasting
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  }

  screenToCell(screenX, screenY) {
    // Raycast to XY plane
    const mouse = new THREE.Vector2(
      (screenX / this.renderer.domElement.width) * 2 - 1,
      -(screenY / this.renderer.domElement.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);

    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.plane, intersection);

    return {
      col: Math.floor(intersection.x / this.cellWidth),
      row: Math.floor(-intersection.y / this.cellHeight) // Y is inverted
    };
  }

  setTilt(angle) {
    // Rotate camera around X axis
    const radians = angle * Math.PI / 180;
    this.camera.position.y = -100 * Math.sin(radians);
    this.camera.position.z = 100 * Math.cos(radians);
    this.camera.lookAt(0, 0, 0);
  }

  setIsometric(enabled) {
    if (enabled) {
      // Isometric: 45° rotation, 35.264° tilt
      this.camera.position.set(100, -100, 100);
      this.camera.lookAt(0, 0, 0);
    } else {
      // Top-down
      this.camera.position.set(0, 0, 100);
      this.camera.lookAt(0, 0, 0);
    }
  }
};
```

### 5.2 Create ThreeJSASCIIBackend

#### Task 5.2.1: Create `js/backends/ThreeJSASCIIBackend.js`

```javascript
/**
 * ThreeJSASCIIBackend - ASCII rendering in Three.js using text sprites
 */
AsciiEditor.backends.ThreeJSASCIIBackend = class ThreeJSASCIIBackend extends AsciiEditor.backends.IRenderBackend {
  constructor() {
    super();
    this.viewport = null;
    this.textMeshes = new Map(); // Cache text meshes
  }

  initialize(viewport) {
    this.viewport = viewport;
  }

  drawCell(col, row, char, style) {
    // Create or update text sprite at cell position
    const key = `${col},${row}`;
    let mesh = this.textMeshes.get(key);

    if (!mesh) {
      mesh = this._createTextMesh(char, style);
      this.textMeshes.set(key, mesh);
      this.viewport.scene.add(mesh);
    } else {
      this._updateTextMesh(mesh, char, style);
    }

    mesh.position.set(
      col * this.viewport.cellWidth,
      -row * this.viewport.cellHeight, // Y is inverted
      style.zIndex || 0
    );
  }

  // ... etc
};
```

### 5.3 Create ThreeJSOverlay

#### Task 5.3.1: Create `js/overlays/ThreeJSOverlay.js`

```javascript
/**
 * ThreeJSOverlay - Overlays as 2D canvas on top of WebGL
 * Uses a separate 2D canvas positioned over the WebGL canvas
 */
AsciiEditor.overlays.ThreeJSOverlay = class ThreeJSOverlay extends AsciiEditor.overlays.IOverlayRenderer {
  constructor() {
    super();
    this.viewport = null;
    this.canvas = null; // 2D overlay canvas
    this.ctx = null;
    this.screenAligned = true;
  }

  initialize(viewport) {
    this.viewport = viewport;

    // Create 2D canvas overlay
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none'; // Pass events through

    viewport.getEventTarget().parentElement.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  drawMarquee(bounds, mode) {
    // Convert cell bounds to screen coordinates
    const topLeft = this.viewport.cellToScreen(bounds.x, bounds.y);
    const bottomRight = this.viewport.cellToScreen(
      bounds.x + bounds.width,
      bounds.y + bounds.height
    );

    // Draw marquee on 2D overlay canvas
    // ... same logic as Canvas2DOverlay
  }
};
```

### 5.4 Tests for Phase 5

| Test File | Tests |
|-----------|-------|
| `test/ThreeJSViewport.test.js` | Coordinate transforms, camera, raycasting |
| `test/ThreeJSASCIIBackend.test.js` | Text mesh creation, positioning |
| `test/ThreeJSOverlay.test.js` | Overlay positioning, screen alignment |

---

## Phase 6: Configurable Cell Dimensions

**Goal:** Support different fonts with different cell aspect ratios.

### 6.1 Update State.js

Add cell configuration to project settings:

```javascript
settings: {
  cellWidth: 10,
  cellHeight: 20,
  font: 'Berkeley Mono',
  fontSize: 16
}
```

### 6.2 Add Font Measurement

Create utility to measure font cell dimensions:

```javascript
AsciiEditor.core.measureFont = function(fontFamily, fontSize) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px "${fontFamily}"`;

  const metrics = ctx.measureText('M');
  return {
    width: Math.ceil(metrics.width),
    height: fontSize * 1.2 // Approximate line height
  };
};
```

### 6.3 Tests for Phase 6

| Test File | Tests |
|-----------|-------|
| `test/cellConfig.test.js` | Font measurement, dimension changes |

---

## Test Plan Summary

### New Test Files Required

| Test File | Phase | Priority | Description |
|-----------|-------|----------|-------------|
| `test/viewport/IViewport.test.js` | 1 | High | Interface contract tests |
| `test/viewport/Canvas2DViewport.test.js` | 2 | High | 2D viewport implementation |
| `test/viewport/ThreeJSViewport.test.js` | 5 | Medium | 3D viewport implementation |
| `test/backends/IRenderBackend.test.js` | 1 | High | Interface contract tests |
| `test/backends/CanvasASCIIBackend.test.js` | 2 | High | 2D ASCII rendering |
| `test/backends/ThreeJSASCIIBackend.test.js` | 5 | Medium | 3D ASCII rendering |
| `test/overlays/IOverlayRenderer.test.js` | 1 | High | Interface contract tests |
| `test/overlays/Canvas2DOverlay.test.js` | 2 | High | 2D overlay rendering |
| `test/overlays/ThreeJSOverlay.test.js` | 5 | Medium | 3D overlay rendering |
| `test/domain/Wire.test.js` | 3 | High | Wire domain logic |
| `test/domain/Symbol.test.js` | 3 | High | Symbol domain logic |
| `test/domain/Line.test.js` | 3 | High | Line domain logic |
| `test/export/ASCIIExporter.test.js` | 4 | High | ASCII export |
| `test/cellConfig.test.js` | 6 | Medium | Cell dimension configuration |

### Test Categories

#### 1. Interface Contract Tests

Verify that implementations satisfy interface contracts:

```javascript
// test/viewport/IViewport.test.js
describe('IViewport implementations', () => {
  const implementations = [
    () => new AsciiEditor.viewport.Canvas2DViewport(),
    // () => new AsciiEditor.viewport.ThreeJSViewport(), // Phase 5
  ];

  implementations.forEach(createViewport => {
    describe(createViewport().constructor.name, () => {
      test('screenToCell returns { col, row }', () => {
        const viewport = createViewport();
        viewport.attach(document.createElement('div'));
        const result = viewport.screenToCell(100, 200);
        expect(result).toHaveProperty('col');
        expect(result).toHaveProperty('row');
        expect(typeof result.col).toBe('number');
        expect(typeof result.row).toBe('number');
      });

      test('cellToScreen returns { x, y }', () => {
        const viewport = createViewport();
        viewport.attach(document.createElement('div'));
        const result = viewport.cellToScreen(5, 10);
        expect(result).toHaveProperty('x');
        expect(result).toHaveProperty('y');
      });

      test('screenToCell and cellToScreen are inverses', () => {
        const viewport = createViewport();
        viewport.attach(document.createElement('div'));
        const screen = viewport.cellToScreen(5, 10);
        const cell = viewport.screenToCell(screen.x, screen.y);
        expect(cell.col).toBe(5);
        expect(cell.row).toBe(10);
      });
    });
  });
});
```

#### 2. Domain Logic Tests

Test business logic in isolation:

```javascript
// test/domain/Symbol.test.js
describe('Symbol domain', () => {
  describe('getPinWorldPosition', () => {
    test('left edge pin at 50% offset', () => {
      const symbol = { x: 10, y: 5, width: 8, height: 6 };
      const pin = { edge: 'left', offset: 0.5 };
      const pos = AsciiEditor.domain.Symbol.getPinWorldPosition(symbol, pin);
      expect(pos.col).toBe(10);
      expect(pos.row).toBe(7); // 5 + 0.5 * 5 = 7.5 → 7
    });

    test('right edge pin at 0% offset', () => {
      const symbol = { x: 10, y: 5, width: 8, height: 6 };
      const pin = { edge: 'right', offset: 0 };
      const pos = AsciiEditor.domain.Symbol.getPinWorldPosition(symbol, pin);
      expect(pos.col).toBe(17); // 10 + 8 - 1
      expect(pos.row).toBe(5);
    });
  });

  describe('getNextDesignatorNumber', () => {
    test('returns 1 for empty objects', () => {
      const result = AsciiEditor.domain.Symbol.getNextDesignatorNumber('U', []);
      expect(result).toBe(1);
    });

    test('returns next number after existing', () => {
      const objects = [
        { type: 'symbol', designator: { prefix: 'U', number: 1 } },
        { type: 'symbol', designator: { prefix: 'U', number: 3 } },
      ];
      const result = AsciiEditor.domain.Symbol.getNextDesignatorNumber('U', objects);
      expect(result).toBe(4);
    });
  });
});
```

#### 3. Coordinate Transform Tests

Critical path testing for viewport coordinate systems:

```javascript
// test/viewport/Canvas2DViewport.test.js
describe('Canvas2DViewport', () => {
  describe('coordinate transforms', () => {
    test('screenToCell with default cell size (10x20)', () => {
      const viewport = new AsciiEditor.viewport.Canvas2DViewport({
        cellWidth: 10, cellHeight: 20
      });
      viewport.attach(document.createElement('div'));

      expect(viewport.screenToCell(0, 0)).toEqual({ col: 0, row: 0 });
      expect(viewport.screenToCell(10, 20)).toEqual({ col: 1, row: 1 });
      expect(viewport.screenToCell(15, 30)).toEqual({ col: 1, row: 1 });
      expect(viewport.screenToCell(100, 200)).toEqual({ col: 10, row: 10 });
    });

    test('screenToCell with zoom', () => {
      const viewport = new AsciiEditor.viewport.Canvas2DViewport();
      viewport.attach(document.createElement('div'));
      viewport.zoom(2.0); // 2x zoom

      // At 2x zoom, 20 screen pixels = 1 cell (instead of 10)
      expect(viewport.screenToCell(20, 40)).toEqual({ col: 1, row: 1 });
    });

    test('screenToCell with pan', () => {
      const viewport = new AsciiEditor.viewport.Canvas2DViewport();
      viewport.attach(document.createElement('div'));
      viewport.pan(50, 100); // Pan offset

      // Screen (50, 100) should now be cell (0, 0)
      expect(viewport.screenToCell(50, 100)).toEqual({ col: 0, row: 0 });
    });
  });
});
```

#### 4. Rendering Output Tests

Verify rendered output matches expected:

```javascript
// test/backends/CanvasASCIIBackend.test.js
describe('CanvasASCIIBackend', () => {
  test('drawBox renders correct characters', () => {
    // Use canvas mock or snapshot testing
  });
});

// test/export/ASCIIExporter.test.js
describe('ASCIIExporter', () => {
  test('exports simple box', () => {
    const state = createTestState([
      { type: 'box', x: 0, y: 0, width: 5, height: 3, style: 'single' }
    ]);
    const exporter = new AsciiEditor.export.ASCIIExporter();
    const result = exporter.export(state);

    expect(result).toBe(
      '┌───┐\n' +
      '│   │\n' +
      '└───┘'
    );
  });
});
```

### Test Setup Updates

Update `test/setup.js` to include new modules:

```javascript
// test/setup.js
global.AsciiEditor = {};
global.AsciiEditor.core = {};
global.AsciiEditor.viewport = {};
global.AsciiEditor.backends = {};
global.AsciiEditor.overlays = {};
global.AsciiEditor.export = {};
global.AsciiEditor.domain = {};

// Load modules in order
require('../js/core/utils.js');
require('../js/viewport/IViewport.js');
require('../js/viewport/Canvas2DViewport.js');
require('../js/backends/IRenderBackend.js');
require('../js/backends/CanvasASCIIBackend.js');
require('../js/overlays/IOverlayRenderer.js');
require('../js/overlays/Canvas2DOverlay.js');
require('../js/domain/Wire.js');
require('../js/domain/Symbol.js');
require('../js/domain/Line.js');
require('../js/export/IExporter.js');
require('../js/export/ASCIIExporter.js');
// ... etc
```

---

## Timeline Estimates (Not Calendar Time)

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Interfaces | Small | None |
| Phase 2: Extract Canvas2D | Large | Phase 1 |
| Phase 3: Domain Logic | Medium | Phase 2 |
| Phase 4: Exporters | Medium | Phase 2 |
| Phase 5: Three.js | Large | Phase 2, 3 |
| Phase 6: Cell Config | Small | Phase 2 |

**Recommended Order:** 1 → 2 → 3 → 4 → 6 → 5

Phase 5 (Three.js) is experimental and can be done in parallel after Phase 2 is stable.

---

## Risk Mitigation

### Risk 1: Breaking Existing Functionality

**Mitigation:**
- Phase 2 creates new classes that wrap existing behavior
- Keep old Renderer.js temporarily as fallback
- Feature flag to switch between old and new rendering
- Comprehensive regression tests

### Risk 2: Three.js Complexity

**Mitigation:**
- Phase 5 is isolated — doesn't affect 2D functionality
- Start with simple top-down view (same as 2D)
- Add tilt/isometric incrementally
- Can be disabled if unstable

### Risk 3: Performance Regression

**Mitigation:**
- Profile before and after refactor
- Abstraction layers should be thin
- Cache computed values where possible
- Lazy initialization of Three.js

---

## Success Criteria

### Phase 1 Complete When:
- [ ] All interface files created
- [ ] Interface tests pass
- [ ] No changes to existing functionality

### Phase 2 Complete When:
- [ ] All tools use `viewport.screenToCell()`
- [ ] All content rendering uses `CanvasASCIIBackend`
- [ ] All overlay rendering uses `Canvas2DOverlay`
- [ ] Existing test suite passes
- [ ] No visual differences in rendered output

### Phase 3 Complete When:
- [ ] Domain modules created with full test coverage
- [ ] Tools refactored to use domain modules
- [ ] No duplicate logic between tools

### Phase 4 Complete When:
- [ ] ASCIIExporter produces identical output to current export
- [ ] Export tests pass

### Phase 5 Complete When:
- [ ] Three.js viewport renders same content as 2D
- [ ] Pan/zoom works
- [ ] Tilt/isometric work
- [ ] Tools work identically in both viewports

### Phase 6 Complete When:
- [ ] Cell dimensions configurable at runtime
- [ ] Different fonts render correctly
- [ ] Grid adapts to cell dimensions
