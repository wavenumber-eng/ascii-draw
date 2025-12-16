# ASCII Diagram Editor - Architecture

This document describes the technical design, patterns, and code organization for the ASCII Diagram Editor. For functional requirements (what the product does), see `REQUIREMENTS.md`.

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

### Future Directories (Not Yet Created)

These directories will be added as features are implemented:

```
js/
├── tools/
│   ├── TextTool.js           # [TOOL-22] - not implemented
│   ├── LineTool.js           # [TOOL-23] - not implemented
│   ├── SymbolTool.js         # [TOOL-24] - not implemented
│   ├── WireTool.js           # [TOOL-25] - not implemented
│   ├── PortTool.js           # [TOOL-26] - not implemented
│   └── PowerTool.js          # [TOOL-27] - not implemented
│
├── objects/                  # Object type definitions (future)
│   ├── ObjectRegistry.js
│   ├── Box.js, Text.js, Line.js, etc.
│
├── ui/                       # UI components (future extraction)
│   ├── PropertiesPanel.js
│   ├── Toolbar.js
│   └── PageTabs.js
│
└── export/                   # Export formats (future)
    ├── AsciiExporter.js
    ├── AnsiExporter.js
    ├── HtmlExporter.js
    └── SvgExporter.js
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

- **ARCH-30**: CharacterGrid handles pixel-to-character coordinate transforms
- **ARCH-31**: All object positions stored in character coordinates (col, row)
- **ARCH-32**: Rendering converts to pixel coordinates for canvas drawing
- **ARCH-33**: Grid snapping automatic for all placement operations

### CharacterGrid

```javascript
class CharacterGrid {
  constructor(charWidth, charHeight)

  pixelToChar(px, py)     // Returns { col, row }
  charToPixel(col, row)   // Returns { x, y }
  getCellBounds(col, row) // Returns { x, y, width, height }
  snapToGrid(px, py)      // Returns snapped { x, y }
}
```

### Character Dimensions

Berkeley Mono at 16px renders approximately:
- Character width: 10px
- Character height: 20px

All objects use integer character coordinates for clean alignment.

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

Tools receive a context object providing access to:

```javascript
{
  canvas: HTMLCanvasElement,
  grid: CharacterGrid,
  history: HistoryManager,
  startInlineEdit: Function,  // For text editing
  // ... other shared resources
}
```

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

1. Clear canvas
2. Draw grid (if enabled)
3. For each object on page (in order):
   - Draw shadow (if enabled)
   - Draw object
4. Draw selection highlights
5. Draw tool overlay (marquee, resize handles, etc.)
6. Draw inline edit cursor (if editing)

### Object Rendering

Each object type implements static `render(ctx, obj, grid, options)`:
- `ctx`: Canvas 2D context
- `obj`: Object data from state
- `grid`: CharacterGrid for coordinate conversion
- `options`: { selected, editing, theme }

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

## 13. CSS Variables Reference

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
