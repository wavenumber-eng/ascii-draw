# Architecture Overview

This document is the master index for the project's architecture. Individual decisions are captured as numbered ADRs (Architecture Decision Records) in this directory. For functional requirements (what the product does), see `../requirements/`. For active implementation plans, see `../plans/`.

---

## What this is

A **cell-based (grid-based) diagram editor**. The current primary output is ASCII art (Berkeley Mono + UTF box-drawing characters), but the architecture treats this as one rendering of a more general model: a grid of cells where each cell holds one graphical element. Conceptually identical to tile-based engines from 8/16-bit games — the same object model can be rendered as ASCII text, sprite tiles, SVG paths, or 3D meshes.

Targeted use cases:
1. **ASCII diagrams** — block diagrams, flowcharts, architecture docs (README/comments).
2. **Schematic capture** — symbols, pins, wires, netlists ("napkin to netlist").
3. **3D visualization** (future) — isometric or tilted view for presentations.

---

## Layered architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Object model (page.objects[])                 │
│            boxes, symbols, lines, wires, text, pins              │
│                  All positions in CELL coordinates               │
└──────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
   │ Domain logic  │  │   Viewport    │  │   Exporters   │
   │ (pure fns)    │  │ (interactive) │  │  (file out)   │
   │ Wire/Symbol/  │  │ Canvas2D /    │  │ ASCII / SVG / │
   │ Line          │  │ ThreeJS       │  │ HTML / ANSI   │
   └───────────────┘  └───────┬───────┘  └───────────────┘
                              │
                  ┌───────────┴───────────┐
                  ▼                       ▼
        ┌──────────────────┐   ┌──────────────────┐
        │ Render backend   │   │ Overlay renderer │
        │ (cell content,   │   │ (transient UI,   │
        │  exportable)     │   │  never exported) │
        └──────────────────┘   └──────────────────┘
```

| Layer | Responsibility | Knows about |
|---|---|---|
| Object model | Plain JSON-serializable data | Cell coordinates only |
| Domain logic | Business rules for objects | Object relationships, validation |
| Tools | User input → commands | Cell coords, viewport, domain |
| Viewport | Coordinate transforms, camera, events | Screen ↔ cell mapping |
| Render backend | Visual representation of cells (exportable) | How to draw cells |
| Overlay renderer | Transient UI (selection, marquee, hints) | Screen-aligned drawing |
| Exporter | File output | How to serialize cells |

The state flows: `User action → Tool handler → Command → HistoryManager → New state → Subscribers → DerivedStateComputer → renderList → Viewport.render → Backend.draw`.

---

## Namespace map (`AsciiEditor.*`)

```
AsciiEditor.core           utils, CharacterGrid, Command, HistoryManager,
                           State, HotkeyManager, lineUtils, DerivedStateComputer, debug
AsciiEditor.domain         Wire, Symbol, Line  (pure functions, fully unit-tested)
AsciiEditor.viewport       IViewport, Canvas2DViewport, ThreeJSViewport
AsciiEditor.backends       IRenderBackend, CanvasASCIIBackend
AsciiEditor.overlays       IOverlayRenderer, Canvas2DOverlay
AsciiEditor.export         IExporter, ASCIIExporter
AsciiEditor.tools          Tool, ToolManager, Select/Box/Line/Text/Symbol/Pin/Wire
AsciiEditor.input          InputRouter (keyboard dispatch — see ADR 0013)
AsciiEditor.Editor         Main orchestrator
```

---

## ADR index

| # | Decision | Status |
|---|---|---|
| [0001](0001-cell-based-engine.md) | Cell-based diagram engine (the core concept) | Accepted |
| [0002](0002-vanilla-js-no-build.md) | Vanilla JavaScript, no build step | Accepted |
| [0003](0003-namespace-pattern.md) | `AsciiEditor.*` namespace over ES6 modules | Accepted |
| [0004](0004-command-pattern-undo-redo.md) | Command pattern for undo/redo | Accepted |
| [0005](0005-immutable-state.md) | Single immutable state tree + subscribers | Accepted |
| [0006](0006-coordinate-system.md) | Cell coordinates as the single source of truth | Accepted |
| [0007](0007-tool-framework.md) | Tool base class + ToolManager + context | Accepted |
| [0008](0008-pluggable-rendering.md) | Pluggable viewport / backend / exporter interfaces | Accepted |
| [0009](0009-content-vs-overlay-separation.md) | Content rendering separate from transient overlays | Accepted |
| [0010](0010-derived-state.md) | Junctions and no-connects as derived (ephemeral) state | Accepted |
| [0011](0011-domain-modules.md) | Pure-function domain layer (Wire/Symbol/Line) | Accepted |
| [0012](0012-testing-strategy.md) | Jest + jsdom, namespace setup, contract tests | Accepted |
| [0013](0013-keyboard-input-routing.md) | Keyboard input routing — modes + precedence + InputRouter | Accepted |

---

## How to extend

### Add a new tool

1. Create `js/tools/NewTool.js`:
   ```javascript
   AsciiEditor.tools.NewTool = class NewTool extends AsciiEditor.tools.Tool {
     constructor() { super('newtool'); this.cursor = 'crosshair'; }
     // implement onMouseDown / onMouseMove / onMouseUp / renderOverlay
   };
   ```
2. Add `<script src="js/tools/NewTool.js">` to `index.html` after `Tool.js` and `ToolManager.js`.
3. Register in `Editor.setupTools()`: `this.toolManager.register(new AsciiEditor.tools.NewTool());`
4. Add a toolbar button in `index.html` with `data-tool="newtool"`.
5. Bind a hotkey in `Editor.setupHotkeys()`.

### Add a new object type

1. Add a `case 'newtype':` to `_drawObjectWithBackend()` in `Editor.js`.
2. Add a `drawNewType()` method to `CanvasASCIIBackend.js` (and any other render backends).
3. Add a render-order entry in `DerivedStateComputer.renderOrder`.
4. Add an exporter case in `ASCIIExporter`.
5. Add a Properties Panel renderer in `Editor.updatePropertiesPanel()`.
6. (Optional) Add a domain module under `js/domain/` if there's reusable business logic.

### Add a new render backend

1. Implement the `IRenderBackend` interface in `js/backends/<Name>Backend.js`.
2. Wire it into `Editor.setupViewport()` (or behind a UI toggle).
3. Run the contract tests in `test/IRenderBackend.test.js` against it.

---

## CSS variables (theme)

All colors are defined as CSS variables in `style.css` for easy theming.

```css
/* Backgrounds */
--bg-primary: #1e1e1e;      /* Main UI background */
--bg-secondary: #252526;    /* Panel backgrounds */
--bg-tertiary: #2d2d30;     /* Hover/active states */
--bg-canvas: #1a1a1a;       /* Drawing canvas */
--bg-grid: #2a2a2a;         /* Grid lines */

/* Text */
--text-primary: #cccccc;
--text-secondary: #858585;
--text-canvas: #cccccc;
--text-shadow: #555555;

/* Accents */
--accent: #007acc;
--accent-secondary: #00cc7a;

/* Selection & Marquee */
--selection-stroke: #007acc;
--marquee-enclosed-stroke: #007acc;
--marquee-enclosed-fill: rgba(0, 122, 204, 0.1);
--marquee-intersect-stroke: #00cc7a;
--marquee-intersect-fill: rgba(0, 204, 122, 0.1);

/* Borders */
--border-color: #3c3c3c;
--border-focus: #007acc;
```

UI rules (from `claude.md`): sharp corners only (`border-radius: 0`), Berkeley Mono throughout, dark theme, accent `#007acc`.

Berkeley Mono at 16px renders cells of 10px × 20px (measured dynamically).

---

## Development & deployment

Open `index.html` in a browser — no build step. Works with `file://`. For local dev:
```bash
python -m http.server 8000
```

`npm` is required only for tests (`npm test`), not for running the app.

For single-file deployment (future), simple concatenation works because of the namespace pattern:
```bash
cat js/core/*.js js/domain/*.js js/viewport/*.js js/backends/*.js \
    js/overlays/*.js js/export/*.js js/tools/*.js js/rendering/*.js \
    js/Editor.js js/main.js > bundle.js
```
