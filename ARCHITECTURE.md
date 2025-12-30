# Cell-Based Diagram Editor - Architecture

This document describes the technical design, patterns, and code organization for the Cell-Based Diagram Editor. For functional requirements (what the product does), see `REQUIREMENTS.md`.

---

## 0. Core Concept: Cell-Based Diagram Engine

### What This Really Is

While the current primary output is ASCII art, this is fundamentally a **cell-based (grid-based) diagram editor**. The constraint is that all content is placed on a grid of cells, where each cell contains a single graphical element.

This is conceptually identical to **tile-based engines** from 8-bit and 16-bit games — a grid where each cell contains one graphical element. In ASCII mode, that element is a character. In other modes, it could be an SVG element, a 3D mesh, or any other visual representation.

### Key Abstractions

```
┌─────────────────────────────────────────────────────────────────┐
│                    ABSTRACT OBJECT MODEL                        │
│     (boxes, symbols, lines, wires in CELL coordinates)          │
│              Cell dimensions: CONFIGURABLE                      │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  DOMAIN LOGIC    │ │ VIEWPORT         │ │ EXPORT           │
│  (business rules)│ │ (interactive)    │ │ (file output)    │
│  ┌────────────┐  │ │ ┌────────────┐   │ │ ┌────────────┐   │
│  │ Wire.js    │  │ │ │ Canvas2D   │   │ │ │ ASCII text │   │
│  │ Symbol.js  │  │ │ │ Three.js   │   │ │ │ SVG file   │   │
│  │ Line.js    │  │ │ └────────────┘   │ │ │ HTML file  │   │
│  └────────────┘  │ └──────────────────┘ └──────────────────┘
└──────────────────┘          │
                              ▼
                    ┌──────────────────┐
                    │ RENDER BACKEND   │
                    │ (glyph → visual) │
                    │ ┌────────────┐   │
                    │ │ ASCII char │   │
                    │ │ Sprite     │   │
                    │ │ SVG path   │   │
                    │ │ 3D mesh    │   │
                    │ └────────────┘   │
                    └──────────────────┘
```

### Cell Content as Glyphs

Each cell stores a **character glyph** — this is the semantic data. How that glyph is rendered is determined by the render backend:

| Glyph | ASCII Backend | Sprite Backend | SVG Backend |
|-------|--------------|----------------|-------------|
| `─` | `fillText("─")` | `drawImage(tile_horizontal)` | `<line x1.../>` |
| `│` | `fillText("│")` | `drawImage(tile_vertical)` | `<line y1.../>` |
| `┌` | `fillText("┌")` | `drawImage(tile_corner_tl)` | `<path d="..."/>` |

This separation means the same document can be rendered as:
- ASCII text (current)
- Pixel art sprites (retro style)
- Clean vector graphics (SVG)
- 3D extruded blocks (Three.js)

### Cell Dimensions

Cell dimensions are **configurable**, not hardcoded:

| Font | Cell Width | Cell Height | Aspect Ratio |
|------|-----------|-------------|--------------|
| Berkeley Mono 16px | 10px | 20px | 1:2 (tall) |
| Press Start 2P | 8px | 8px | 1:1 (square) |
| Custom | configurable | configurable | any |

The rendering backend maps cells to visual output. The object model and tools are **agnostic** to cell dimensions — they work purely in cell coordinates (col, row).

### Separation of Concerns

| Layer | Responsibility | Knows About |
|-------|----------------|-------------|
| **Object Model** | Data structures for boxes, lines, symbols | Cell coordinates only |
| **Domain Logic** | Business rules for objects (Wire, Symbol, Line) | Object relationships, validation |
| **Tools** | User interaction, mouse/keyboard → commands | Cell coordinates, IViewport, Domain |
| **Viewport** | Coordinate transforms, camera, events | Screen ↔ Cell mapping |
| **Render Backend** | Visual representation of cells | How to draw cells |
| **Exporter** | File output | How to serialize cells |

Tools should **never** know whether they're running in a 2D canvas or a Three.js 3D environment. They receive cell coordinates from the viewport and operate on the object model.

### Domain Logic Layer

Domain logic modules contain **business rules** that are:
- Independent of UI/mouse events
- Reusable across multiple tools
- Unit testable in isolation

```
┌─────────────────────────────────────────────────────────────────┐
│                      DOMAIN MODULES                              │
├─────────────────────────────────────────────────────────────────┤
│  Wire.js                                                        │
│  ├─ isFloatingEndpoint(wire, endIndex, objects)                 │
│  ├─ findPinAtPoint(col, row, objects)                           │
│  ├─ canBindToPin(wireEndpoint, pin)                             │
│  ├─ getConnectedWires(wire, objects)                            │
│  └─ moveEndpointWithSymbol(wire, symbol, delta)                 │
├─────────────────────────────────────────────────────────────────┤
│  Symbol.js                                                      │
│  ├─ getPinWorldPosition(symbol, pin)                            │
│  ├─ findSymbolEdge(col, row, symbol)                            │
│  ├─ getNextDesignatorNumber(prefix, objects)                    │
│  └─ isPinOnEdge(symbol, pin)                                    │
├─────────────────────────────────────────────────────────────────┤
│  Line.js                                                        │
│  ├─ getSegments(line)                                           │
│  ├─ pointOnSegment(col, row, segment)                           │
│  ├─ findIntersections(lines)                                    │
│  └─ mergeLines(line1, line2)                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Why this matters:**

Before (logic in tools):
```javascript
// SelectTool.js - 2700+ lines, wire logic mixed with mouse handling
onMouseMove(event, context) {
  // 50 lines of wire endpoint detection
  // 30 lines of pin binding logic
  // 20 lines of floating end detection
  // ... impossible to unit test
}
```

After (domain modules):
```javascript
// SelectTool.js - thin, just UI
onMouseMove(event, context) {
  const pin = Wire.findPinAtPoint(col, row, objects);
  if (pin && Wire.canBindToPin(this.draggedEndpoint, pin)) {
    this.showBindingHint(pin);
  }
}

// test/domain/Wire.test.js - easy to test
test('findPinAtPoint returns pin at exact position', () => {
  const objects = [createSymbolWithPin(10, 5, 'left')];
  const result = Wire.findPinAtPoint(10, 5, objects);
  expect(result).not.toBeNull();
  expect(result.pin.edge).toBe('left');
});
```

---

## 1. Code Organization

### Module Structure

- **ARCH-1**: Vanilla JavaScript with clean file separation (no build step required)
- **ARCH-2**: Multiple `<script>` tags load files in dependency order
- **ARCH-3**: Separate concerns into logical modules
- **ARCH-4**: Each module file shall list the requirements it implements in a header comment
- **ARCH-5**: New tools can be added without modifying core code
- **ARCH-6**: New object types can be added without modifying core code
- **ARCH-7**: Single-file bundling optional for deployment (can be done later via simple concatenation)

### Namespace Pattern

All code lives under the `AsciiEditor` global namespace to avoid pollution:

```javascript
// In each file:
var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

AsciiEditor.core.CharacterGrid = class CharacterGrid {
  // ...
};
```

### Directory Layout (Current)

```
ascii_draw/
├── js/
│   ├── core/
│   │   ├── utils.js              # AsciiEditor.core (generateId, clamp, deepClone)
│   │   ├── CharacterGrid.js      # AsciiEditor.core.CharacterGrid
│   │   ├── Command.js            # AsciiEditor.core.Command (base + all commands)
│   │   ├── HistoryManager.js     # AsciiEditor.core.HistoryManager
│   │   ├── State.js              # AsciiEditor.core.createInitialState
│   │   └── HotkeyManager.js      # AsciiEditor.core.HotkeyManager
│   │
│   ├── tools/
│   │   ├── Tool.js               # AsciiEditor.tools.Tool (base class)
│   │   ├── ToolManager.js        # AsciiEditor.tools.ToolManager
│   │   ├── SelectTool.js         # AsciiEditor.tools.SelectTool [TOOL-20]
│   │   └── BoxTool.js            # AsciiEditor.tools.BoxTool [TOOL-21]
│   │
│   ├── rendering/
│   │   └── Renderer.js           # AsciiEditor.rendering.Renderer
│   │
│   ├── Editor.js                 # AsciiEditor.Editor (main orchestrator)
│   └── main.js                   # Bootstrap, create editor instance
│
├── style.css                     # External stylesheet with CSS variables
├── index.html                    # Entry point (multiple script tags)
├── ascii_editor.html             # Legacy monolithic version (reference only)
│
├── BerkeleyMono-Regular.ttf      # Font files
├── BerkeleyMono-Regular.woff2
│
├── REQUIREMENTS.md               # What the product does (with status)
├── ARCHITECTURE.md               # How the code is structured
├── CLAUDE.md                     # Development guidelines
└── .gitignore
```

### Implemented Directories

These directories have been implemented:

```
js/
├── viewport/                 # Viewport implementations ✅
│   ├── IViewport.js          # Interface definition
│   ├── Canvas2DViewport.js   # 2D canvas viewport
│   └── ThreeJSViewport.js    # Three.js 3D viewport (experimental)
│
├── backends/                 # Render backend implementations ✅
│   ├── IRenderBackend.js     # Content rendering interface
│   └── CanvasASCIIBackend.js # ASCII renderer
│
├── overlays/                 # Overlay renderer implementations ✅
│   ├── IOverlayRenderer.js   # UI overlay interface
│   └── Canvas2DOverlay.js    # 2D canvas overlay
│
├── export/                   # Export formats ✅
│   ├── IExporter.js          # Interface definition
│   └── ASCIIExporter.js      # Plain text export
│
├── domain/                   # Domain logic (pure functions) ✅ NEW
│   ├── Line.js               # Point/segment utilities, intersections
│   ├── Symbol.js             # Pin positions, edge detection
│   └── Wire.js               # Binding, floating ends, merging
│
├── tools/                    # All tools implemented ✅
│   ├── SelectTool.js         # Selection, move, resize
│   ├── BoxTool.js            # Text boxes
│   ├── TextTool.js           # Borderless text
│   ├── LineTool.js           # Lines/polylines
│   ├── SymbolTool.js         # Schematic symbols
│   ├── WireTool.js           # Electrical wires
│   └── PinTool.js            # Add pins to symbols
```

### Future Directories (Planned)

```
js/
├── backends/                 # Additional backends (future)
│   ├── ThreeJSASCIIBackend.js# ASCII in Three.js (text meshes)
│   └── ThreeJSSVGBackend.js  # SVG elements in Three.js
│
├── export/                   # Additional export formats (future)
│   ├── ANSIExporter.js       # Terminal escape codes
│   ├── HTMLExporter.js       # Styled HTML
│   └── SVGExporter.js        # Vector graphics
│
├── objects/                  # Object type definitions (future)
│   ├── ObjectRegistry.js
│   ├── Box.js, Text.js, Line.js, etc.
│
└── ui/                       # UI components (future extraction)
    ├── PropertiesPanel.js
    ├── Toolbar.js
    └── PageTabs.js
```

### Script Loading Order

In `index.html`, scripts load in dependency order:

```html
<!-- Core (no dependencies) -->
<script src="js/core/utils.js"></script>
<script src="js/core/CharacterGrid.js"></script>
<script src="js/core/Command.js"></script>
<script src="js/core/HistoryManager.js"></script>
<script src="js/core/State.js"></script>

<!-- Objects (depends on core) -->
<script src="js/objects/ObjectRegistry.js"></script>
<script src="js/objects/Box.js"></script>
<!-- ... other objects ... -->

<!-- Tools (depends on core) -->
<script src="js/tools/Tool.js"></script>
<script src="js/tools/ToolManager.js"></script>
<script src="js/tools/SelectTool.js"></script>
<script src="js/tools/BoxTool.js"></script>
<!-- ... other tools ... -->

<!-- UI (depends on core, objects) -->
<script src="js/ui/PropertiesPanel.js"></script>
<!-- ... other UI ... -->

<!-- Rendering (depends on core, objects) -->
<script src="js/rendering/Renderer.js"></script>

<!-- Main (depends on everything) -->
<script src="js/Editor.js"></script>
<script src="js/main.js"></script>
```

---

## 2. Command Pattern (Undo/Redo)

- **ARCH-10**: All state-modifying operations use Command pattern
- **ARCH-11**: Commands implement `execute(state)` and `undo(state)`
- **ARCH-12**: HistoryManager maintains undo/redo stacks
- **ARCH-13**: Commands may implement `canMerge()` and `merge()` for combining (e.g., continuous moves)
- **ARCH-14**: Maximum history depth configurable (default: 100)

### Command Interface

```javascript
class Command {
  execute(state) { return state; }  // Returns new state
  undo(state) { return state; }     // Returns previous state
  canMerge(other) { return false; } // Can this merge with another command?
  merge(other) { return this; }     // Return merged command
}
```

### Command Types

| Command | Purpose | Mergeable |
|---------|---------|-----------|
| `CreateObjectCommand` | Add new object to page | No |
| `DeleteObjectCommand` | Remove object from page | No |
| `MoveObjectCommand` | Change object position | Yes (continuous drag) |
| `ModifyObjectCommand` | Change object properties | No |

### History Manager

```javascript
class HistoryManager {
  execute(command)    // Execute and push to undo stack
  undo()              // Pop from undo, push to redo
  redo()              // Pop from redo, push to undo
  updateState(fn)     // Non-undoable state change (selection, view)
  subscribe(listener) // Register for state change notifications
}
```

---

## 3. State Management

- **ARCH-20**: Single immutable state object as source of truth
- **ARCH-21**: State updates create new state objects (no mutation)
- **ARCH-22**: Subscriber pattern for UI updates on state change
- **ARCH-23**: Non-undoable state (selection, view) updated via `updateState()` without commands

### State Shape

```javascript
{
  project: {
    name: "Untitled",
    parameters: {},           // Global key-value params
    pages: [
      {
        id: "page-1",
        name: "Page 1",
        width: 120,
        height: 60,
        objects: [...]        // Array of object data
      }
    ]
  },
  activePageId: "page-1",
  selection: {
    ids: [],                  // Selected object IDs
    handles: null             // Active resize handle
  },
  view: {
    zoom: 1.0,
    scrollX: 0,
    scrollY: 0,
    showGrid: true
  }
}
```

### State Update Flow

```
User Action → Tool Handler → Command → HistoryManager → New State → Subscribers → UI Update
```

---

## 4. Coordinate System

- **ARCH-30**: Viewport abstraction handles screen-to-cell coordinate transforms
- **ARCH-31**: All object positions stored in cell coordinates (col, row)
- **ARCH-32**: Viewport converts screen coordinates to cell coordinates
- **ARCH-33**: Grid snapping automatic for all placement operations
- **ARCH-34**: Cell dimensions are configurable (not hardcoded to any font)
- **ARCH-35**: Tools receive cell coordinates from viewport, never raw screen coordinates

### Coordinate Transform Abstraction

The coordinate system is **viewport-agnostic**. Whether using 2D canvas or Three.js, tools always work in cell coordinates:

```
Screen Input (mouse x,y) → Viewport.screenToCell() → Cell Coords (col, row) → Tools
```

For Three.js, this involves raycasting to a plane and converting world coordinates to cells. For 2D canvas, this is simple division by cell dimensions.

### CharacterGrid (Legacy - To Be Refactored)

The current `CharacterGrid` class will be **absorbed into Canvas2DViewport**:

```javascript
class CharacterGrid {
  constructor(charWidth, charHeight)

  pixelToChar(px, py)     // Returns { col, row }
  charToPixel(col, row)   // Returns { x, y }
  getCellBounds(col, row) // Returns { x, y, width, height }
  snapToGrid(px, py)      // Returns snapped { x, y }
}
```

### Cell Dimensions (Configurable)

Cell dimensions adapt to the font or rendering style:

| Font/Style | Cell Width | Cell Height | Notes |
|------------|-----------|-------------|-------|
| Berkeley Mono 16px | 10px | 20px | Current default |
| Press Start 2P | 8px | 8px | Square pixel font |
| Custom SVG | any | any | User-defined |

All objects use integer cell coordinates for clean alignment. The actual pixel/world dimensions are determined by the viewport and render backend.

---

## 5. Tool Framework

### Tool Base Class

- **TOOL-1**: All tools extend base Tool class
- **TOOL-2**: Tools implement lifecycle methods: `activate()`, `deactivate()`
- **TOOL-3**: Tools implement event handlers: `onMouseDown()`, `onMouseMove()`, `onMouseUp()`, `onKeyDown()`, `onDoubleClick()`
- **TOOL-4**: Tools implement `renderOverlay()` for tool-specific visual feedback
- **TOOL-5**: Only one tool active at a time
- **TOOL-6**: Each tool has a keyboard shortcut for activation

```javascript
class Tool {
  constructor(name) {
    this.name = name;
    this.cursor = 'default';
  }

  activate(context) {}    // Called when tool becomes active
  deactivate() {}         // Called when switching away

  onMouseDown(event, context) { return false; }
  onMouseMove(event, context) { return false; }
  onMouseUp(event, context) { return false; }
  onKeyDown(event, context) { return false; }
  onDoubleClick(event, context) { return false; }

  renderOverlay(ctx, context) {}  // Draw tool-specific UI
}
```

### Tool Context

Tools receive a context object providing access to shared resources. **Critically**, tools receive a `viewport` abstraction instead of direct canvas/grid access:

```javascript
{
  viewport: IViewport,        // Coordinate transforms (screenToCell, cellToScreen)
  history: HistoryManager,    // State management and undo/redo
  startInlineEdit: Function,  // For text editing
  startLabelEdit: Function,   // For designator/parameter editing
  startPinEdit: Function,     // For pin name editing
  setTool: Function,          // Switch active tool
  // ... other shared resources
}
```

**Important**: Tools should use `context.viewport.screenToCell(x, y)` for all coordinate conversion. They should **never** access raw canvas coordinates or assume a specific rendering backend.

### Tool Manager

- **TOOL-10**: ToolManager orchestrates tool switching
- **TOOL-11**: Tool switching via keyboard shortcut or toolbar click
- **TOOL-12**: Escape key returns to Select tool
- **TOOL-13**: Tool state preserved during switch (where appropriate)

```javascript
class ToolManager {
  constructor(tools, defaultTool)

  setActiveTool(name)     // Switch to named tool
  getActiveTool()         // Get current tool

  onMouseDown(event)      // Delegate to active tool
  onMouseMove(event)
  onMouseUp(event)
  onKeyDown(event)
  onDoubleClick(event)

  renderOverlay(ctx)      // Delegate to active tool
}
```

---

## 6. Adding New Tools

To add a new tool (ARCH-5):

1. Create `src/tools/NewTool.js`:
```javascript
/**
 * NewTool - Description
 * Implements: TOOL-XX
 */
import { Tool } from './Tool.js';

export class NewTool extends Tool {
  constructor() {
    super('newtool');
    this.cursor = 'crosshair';
  }
  // ... implement handlers
}
```

2. Register in `src/tools/index.js`:
```javascript
export { NewTool } from './NewTool.js';
```

3. Add to ToolManager initialization in `Editor.js`
4. Add toolbar button in `index.html`
5. Add keyboard shortcut in hotkey setup

---

## 7. Adding New Object Types

To add a new object type (ARCH-6):

1. Create `src/objects/NewObject.js`:
```javascript
/**
 * NewObject - Description
 * Implements: OBJ-XX to OBJ-YY
 */
export class NewObject {
  static type = 'newobject';

  static create(x, y, options = {}) {
    return {
      id: generateId(),
      type: 'newobject',
      x, y,
      // ... properties
    };
  }

  static hitTest(obj, col, row) {
    // Return true if point is inside object
  }

  static render(ctx, obj, grid, options) {
    // Draw object to canvas
  }

  static toAscii(obj, buffer) {
    // Write to ASCII export buffer
  }
}
```

2. Register in `src/objects/index.js`:
```javascript
import { NewObject } from './NewObject.js';

export const ObjectRegistry = {
  box: Box,
  newobject: NewObject,
  // ...
};
```

3. Create corresponding tool if needed
4. Add Properties Panel support in `PropertiesPanel.js`

---

## 8. Rendering Pipeline

### Render Order

1. Clear viewport
2. Draw grid (if enabled)
3. For each object in renderList (sorted by zIndex):
   - Draw shadow (if enabled)
   - Draw object via render backend
4. Draw selection highlights
5. Draw tool overlay (marquee, resize handles, etc.)
6. Draw inline edit cursor (if editing)

### Rendering Architecture

The rendering pipeline is now **backend-agnostic**:

```
State → DerivedStateComputer → RenderList → Viewport.render(renderList) → Backend.draw()
```

The **Viewport** owns the render backend and delegates drawing to it. This allows:
- Canvas2DViewport + CanvasASCIIBackend (current)
- ThreeJSViewport + ThreeJSASCIIBackend (3D ASCII)
- ThreeJSViewport + ThreeJSSVGBackend (3D SVG)
- ThreeJSViewport + ExtrudedBackend (3D with Z-height)

### Object Rendering (Backend-Agnostic)

Each object type is rendered through the backend interface:

```javascript
// Backend receives cell-based drawing commands
backend.drawCell(col, row, char, style);
backend.drawText(col, row, text, style);
backend.drawLine(fromCol, fromRow, toCol, toRow, style);
```

The backend translates these to actual visual output (canvas fillText, Three.js meshes, SVG elements, etc.).

---

## 9. Development & Deployment

### Development

Simply open `index.html` in a browser (works with `file://` protocol):

```bash
# Or serve with any static server for live reload tools
python -m http.server 8000
```

No build step required. Edit JS files, refresh browser.

### Production (Optional Single File)

If a single-file deployment is needed later, a simple script can concatenate:

```bash
# Simple concatenation (future, if needed)
cat js/core/*.js js/objects/*.js js/tools/*.js js/ui/*.js js/rendering/*.js js/Editor.js js/main.js > bundle.js
```

Or inline into HTML manually. The namespace pattern (`AsciiEditor.*`) ensures no conflicts.

### No Build Tools Required (for runtime)

- No transpilation (ES6 classes work in all modern browsers)
- No bundler (Webpack, Rollup, esbuild)
- No framework (React, Vue, Angular)
- Pure vanilla JavaScript

**Note:** npm/node IS required for running unit tests (Jest), but NOT for running the application itself.

---

## 10. Testing

### Test Framework

- **Jest** with **jsdom** for unit testing
- Tests run in Node.js with DOM simulation
- Browser-based tests for canvas/visual verification

### Directory Structure

```
test/
├── setup.js           # Loads AsciiEditor namespace into Jest
├── utils.test.js      # Core utility function tests
├── commands.test.js   # Command pattern (undo/redo) tests
├── export.test.js     # ASCII export rendering tests
└── test-export.html   # Browser-based interactive testing
```

### Running Tests

```bash
npm install            # First time only
npm test               # Run all tests
npm test -- --watch    # Watch mode
npm test -- --coverage # Coverage report
npm test -- export     # Run specific test file
```

### Test Requirements

All new logic functions MUST have corresponding unit tests:

1. **Pure functions** (utils, calculations): Test inputs/outputs
2. **Commands**: Test `execute()` and `undo()` return correct state
3. **Export functions**: Test ASCII output matches expected strings
4. **State functions**: Test state transformations

### Writing Tests

```javascript
// test/example.test.js
describe('functionName', () => {
  test('describes expected behavior', () => {
    const result = AsciiEditor.core.functionName(input);
    expect(result).toBe(expectedOutput);
  });
});
```

### Test Setup (test/setup.js)

The setup file loads modules into the global `AsciiEditor` namespace:

```javascript
global.AsciiEditor = {};
global.AsciiEditor.core = {};
require('../js/core/utils.js');
require('../js/core/Command.js');
// ... other modules
```

### Browser-Based Testing

For canvas rendering and visual verification, use `test/test-export.html`:
- Interactive box JSON input
- Visual output comparison
- Character-by-character analysis

---

## 12. Design Decisions

### Why Vanilla JavaScript (No Framework)?

- **Simplicity**: No build step, no node_modules, no transpilation
- **Portability**: Works with `file://` protocol, runs anywhere
- **Longevity**: No framework churn, no dependency updates
- **Learning**: Code is approachable, no magic
- **Performance**: No framework overhead, direct DOM manipulation

### Why Namespace Pattern (Not ES6 Modules)?

- ES6 modules require a server (CORS issues with `file://`)
- Namespace pattern works everywhere
- Script tag ordering is explicit and clear
- Easy to concatenate for single-file deployment later
- IDE still provides decent autocomplete with JSDoc

### Why Command Pattern for Undo?

- Clean separation of "what changed" from "how to change it"
- Each command is self-contained with execute/undo
- Enables command merging for smoother UX (drag operations)
- Easy to serialize for potential collaboration features

### Why Character Coordinates?

- Natural fit for ASCII output
- Grid snapping is automatic
- Objects align perfectly
- Simplifies hit testing and layout

### Why Immutable State Updates?

- Predictable state changes
- Easy undo (just store previous state reference)
- Clear data flow through the application
- Prevents accidental mutation bugs

### Why Static Methods on Object Classes?

- Objects are plain data (JSON-serializable)
- Behavior lives in class static methods
- Easy to add new object types
- No prototype chain complexity in serialization

---

## 13. Pluggable Architecture Interfaces

### IViewport Interface

The viewport abstraction handles all interaction between the user and the canvas/3D scene. It provides coordinate transforms and event handling.

```javascript
/**
 * IViewport - Workspace abstraction for different rendering surfaces
 * Implementations: Canvas2DViewport, ThreeJSViewport
 */
interface IViewport {
  // Lifecycle
  attach(container: HTMLElement): void;
  detach(): void;

  // Coordinate transforms (THE KEY ABSTRACTION)
  screenToCell(screenX: number, screenY: number): { col: number, row: number };
  cellToScreen(col: number, row: number): { x: number, y: number };

  // Cell dimensions
  setCellDimensions(width: number, height: number): void;
  getCellDimensions(): { width: number, height: number };

  // Navigation
  pan(dx: number, dy: number): void;
  zoom(factor: number, centerX?: number, centerY?: number): void;
  resetView(): void;

  // Three.js specific (optional, no-op for 2D)
  setTilt(angle: number): void;        // Drafting table tilt
  setIsometric(enabled: boolean): void; // Snap to isometric view
  setCameraAngle(angle: number): void;  // Arbitrary camera angle

  // Rendering (content)
  setRenderBackend(backend: IRenderBackend): void;
  getRenderBackend(): IRenderBackend;

  // Rendering (overlays)
  setOverlayRenderer(overlay: IOverlayRenderer): void;
  getOverlayRenderer(): IOverlayRenderer;

  // Frame rendering
  render(renderState: RenderState): void;
  requestRender(): void;  // Request next frame

  // Events (tools register handlers)
  getEventTarget(): HTMLElement;  // Element for mouse/keyboard events

  // Grid
  setGridVisible(visible: boolean): void;
  setGridDimensions(cols: number, rows: number): void;
}
```

### Rendering: Two Separate Concerns

Rendering is split into **two distinct interfaces** with different responsibilities:

| Interface | Renders | Exported? | Transforms with Camera? |
|-----------|---------|-----------|------------------------|
| `IRenderBackend` | Content (cells, objects) | Yes | Yes (in 3D) |
| `IOverlayRenderer` | UI hints (selection, handles) | No | Configurable |

This separation is critical for Three.js where content rotates/tilts with the camera but UI overlays may need to stay screen-aligned.

### IRenderBackend Interface

The render backend determines **what fills the cells** — ASCII characters, SVG elements, 3D meshes, etc. This is the **document content** that gets exported.

```javascript
/**
 * IRenderBackend - Visual representation of document content (cells/objects)
 * Implementations: CanvasASCIIBackend, ThreeJSASCIIBackend, ThreeJSSVGBackend
 *
 * IMPORTANT: This interface renders CONTENT ONLY (exportable).
 * UI overlays are handled by IOverlayRenderer.
 */
interface IRenderBackend {
  // Lifecycle
  initialize(viewport: IViewport): void;
  dispose(): void;

  // Frame management
  beginFrame(): void;
  endFrame(): void;
  clear(): void;

  // Cell-level drawing
  drawCell(col: number, row: number, char: string, style: CellStyle): void;
  drawText(col: number, row: number, text: string, style: TextStyle): void;

  // Object-level drawing (higher level)
  drawBox(obj: BoxObject, options: DrawOptions): void;
  drawLine(obj: LineObject, options: DrawOptions): void;
  drawSymbol(obj: SymbolObject, options: DrawOptions): void;
  drawJunction(obj: JunctionObject, options: DrawOptions): void;

  // Grid (part of content, may be exported)
  drawGrid(cols: number, rows: number, visible: boolean): void;

  // Style support
  getCharacterSet(): CharacterSet;  // Available glyphs/mappings
}

/**
 * CellStyle - Visual properties for a cell
 */
interface CellStyle {
  foreground?: string;   // Text/stroke color
  background?: string;   // Fill color
  opacity?: number;
  zIndex?: number;       // For 3D: extrusion height
}
```

### IOverlayRenderer Interface

The overlay renderer handles **transient UI elements** — selection highlights, tool hints, drag previews. These are **never exported** and exist only during interactive editing.

```javascript
/**
 * IOverlayRenderer - Transient UI overlays (not part of document)
 * Implementations: Canvas2DOverlay, ThreeJSOverlay (2D canvas on top), ThreeJS3DOverlay
 *
 * IMPORTANT: Overlays are NEVER exported. They exist only for interactive editing.
 */
interface IOverlayRenderer {
  // Lifecycle
  initialize(viewport: IViewport): void;
  dispose(): void;

  // Frame management
  beginFrame(): void;
  endFrame(): void;
  clear(): void;

  // Selection overlays
  drawSelectionHighlight(obj: Object, style: SelectionStyle): void;
  drawMultiSelectionBox(bounds: Rect): void;
  drawResizeHandles(obj: Object, handles: Handle[]): void;

  // Marquee selection
  drawMarquee(bounds: Rect, mode: MarqueeMode): void;  // 'enclosed' | 'intersect'

  // Tool hints and previews
  drawToolPreview(preview: ToolPreview): void;         // Box preview, line preview, etc.
  drawSnapIndicator(col: number, row: number): void;   // Grid snap point
  drawConnectionHint(pos: CellPos, label: string): void; // "PIN", "CONNECT", etc.
  drawHoverHighlight(obj: Object): void;               // Object under cursor

  // Drag feedback
  drawDragGhost(objects: Object[], offset: CellPos): void;
  drawRubberBand(start: CellPos, end: CellPos, style: LineStyle): void;

  // Inline editing
  drawTextCursor(col: number, row: number, visible: boolean): void;
  drawTextSelection(start: CellPos, end: CellPos): void;

  // Vertex/segment handles (for lines/wires)
  drawVertexHandle(col: number, row: number, type: HandleType): void;
  drawSegmentHandle(col: number, row: number, orientation: 'h' | 'v'): void;

  // Pin handles (for symbols)
  drawPinHandle(pos: CellPos, selected: boolean): void;
  drawPinDropTarget(pos: CellPos, valid: boolean): void;

  // Configuration
  setScreenAligned(aligned: boolean): void;  // For 3D: stay screen-aligned vs rotate with content
}

/**
 * MarqueeMode - Selection marquee behavior
 */
type MarqueeMode = 'enclosed' | 'intersect';

/**
 * HandleType - Types of draggable handles
 */
type HandleType = 'resize-nw' | 'resize-n' | 'resize-ne' |
                  'resize-w' | 'resize-e' |
                  'resize-sw' | 'resize-s' | 'resize-se' |
                  'vertex' | 'segment' | 'pin';

/**
 * ToolPreview - Preview shape while using a tool
 */
interface ToolPreview {
  type: 'box' | 'line' | 'symbol' | 'wire' | 'text';
  bounds?: Rect;
  points?: CellPos[];
  style?: string;
}
```

### Overlay Implementation Strategies

#### Canvas2D Overlay (Current)

For 2D canvas, content and overlays can share the same canvas context:
- Draw content first
- Draw overlays on top
- Single canvas, simple z-ordering

#### Three.js Overlay Options

For Three.js, several strategies exist:

**Option A: 2D Canvas Overlay (Recommended for most cases)**
```
┌─────────────────────────────┐
│   2D Canvas (overlays)      │  ← Screen-aligned, always on top
├─────────────────────────────┤
│   WebGL Canvas (content)    │  ← Rotates/tilts with camera
└─────────────────────────────┘
```
- Overlays rendered to separate 2D canvas positioned over WebGL
- Always screen-aligned regardless of camera angle
- Simple, performant, familiar drawing API

**Option B: CSS3D Overlay**
- HTML elements positioned via CSS3DRenderer
- Good for complex UI (tooltips, menus)
- Overlays as DOM elements

**Option C: 3D Billboard Sprites**
- Overlays as 3D sprites that face camera
- Rotate with scene but always face viewer
- More complex, but unified rendering pipeline

**Option D: Hybrid**
- Selection/handles as 3D (move with content when tilted)
- Hints/tooltips as 2D overlay (always readable)

The viewport determines which strategy to use based on configuration.

### IExporter Interface

Exporters handle **file output** — converting the object model to a specific format.

```javascript
/**
 * IExporter - File output format
 * Implementations: ASCIIExporter, SVGExporter, HTMLExporter, ANSIExporter
 */
interface IExporter {
  // Export
  export(state: ProjectState, options?: ExportOptions): string | Blob;

  // Metadata
  getName(): string;           // "ASCII", "SVG", etc.
  getFileExtension(): string;  // "txt", "svg", "html"
  getMimeType(): string;       // "text/plain", "image/svg+xml"

  // Options
  getDefaultOptions(): ExportOptions;
  validateOptions(options: ExportOptions): boolean;
}

/**
 * ExportOptions - Common export options
 */
interface ExportOptions {
  pageId?: string;           // Export specific page (or all)
  includeGrid?: boolean;     // Include grid in export
  includeShadows?: boolean;  // Include shadow effects
  embedFonts?: boolean;      // For HTML/SVG: embed font data
}
```

### Viewport Implementations

#### Canvas2DViewport (Current - Refactored)

Wraps the current 2D canvas rendering:
- Uses CanvasRenderingContext2D
- Simple pixel-to-cell math
- Pan via translate, zoom via scale
- No tilt/isometric (2D only)

#### ThreeJSViewport (Experimental)

Uses Three.js for a 3D workspace:
- OrthographicCamera looking at XY plane
- MapControls for pan/zoom/tilt
- Raycasting for screenToCell()
- Optional: isometric preset, arbitrary tilt

```javascript
// Three.js specific features
viewport.setTilt(30);         // Tilt like a drafting table
viewport.setIsometric(true);  // Snap to isometric view (45° rotation)
viewport.setCameraAngle(0);   // Top-down (current default)
```

### Backend Implementations

#### CanvasASCIIBackend (Current - Refactored)

Current renderer extracted to backend interface:
- Uses canvas 2D context
- fillText() for characters
- fillRect() for backgrounds

#### ThreeJSASCIIBackend (New)

ASCII rendering in Three.js:
- TextGeometry or sprite-based characters
- Characters as 3D objects on a plane
- Optional Z-height for extrusion effect

#### ThreeJSSVGBackend (Future)

SVG elements in Three.js:
- SVGLoader to create 3D shapes from SVG paths
- Lines become actual 3D line geometry
- Boxes become extruded rectangles

---

## 14. Implementation Phases

### Phase 1: Abstraction Layer (Foundation)

Create interfaces without breaking current functionality:

1. Define `IViewport` interface
2. Create `Canvas2DViewport` wrapping current behavior
3. Define `IRenderBackend` interface
4. Create `CanvasASCIIBackend` from current Renderer.js
5. Refactor Editor to use viewport abstraction
6. Refactor tools to use `viewport.screenToCell()`
7. Make cell dimensions configurable

**Result:** Same functionality, but pluggable architecture

### Phase 2: Clean Separation

1. Separate export code from on-screen rendering
2. Create `ASCIIExporter` implementing `IExporter`
3. Extract domain logic (Wire, Symbol, Line modules)
4. Remove dead code (ghost recomputeJunctions, dual render paths)

**Result:** Clean codebase ready for new backends

### Phase 3: Three.js Experiment

1. Create `ThreeJSViewport` implementing `IViewport`
2. Implement raycasting for `screenToCell()`
3. Add MapControls (pan, zoom, tilt)
4. Create `ThreeJSASCIIBackend` (text on plane)
5. Add camera presets (top-down, isometric, custom tilt)

**Result:** Optional 3D workspace with same tools

### Phase 4: Advanced Rendering

1. SVG render backend
2. Extrusion effects (Z-height in Three.js)
3. Multiple font support with aspect detection
4. Additional export formats

---

## 15. CSS Variables Reference

All colors are defined via CSS variables for easy theming:

```css
/* Backgrounds */
--bg-primary: #1e1e1e;      /* Main UI background */
--bg-secondary: #252526;    /* Panel backgrounds */
--bg-tertiary: #2d2d30;     /* Hover/active states */
--bg-canvas: #1a1a1a;       /* Drawing canvas */
--bg-grid: #2a2a2a;         /* Grid lines */

/* Text */
--text-primary: #cccccc;    /* Main text */
--text-secondary: #858585;  /* Muted/secondary text */
--text-canvas: #cccccc;     /* Text on canvas */
--text-shadow: #555555;     /* Shadow characters */

/* Accents */
--accent: #007acc;          /* Primary accent (selection, links) */
--accent-secondary: #00cc7a; /* Secondary accent (intersect mode) */

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

### Usage in JavaScript

```javascript
const styles = getComputedStyle(document.documentElement);
const accent = styles.getPropertyValue('--accent').trim();
```

### Character Dimensions

Berkeley Mono at 16px renders:
- Character width: ~10px (measured dynamically)
- Character height: 20px
