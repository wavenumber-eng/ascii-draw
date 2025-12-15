# ASCII Diagram Editor - Prototype Plan

## Executive Summary

Based on research into KiCad's GAL tool framework, Excalidraw's architecture, and industry best practices, this plan outlines a clean, extensible architecture for our ASCII diagram editor.

**Key Architectural Decisions:**
- **Rendering**: HTML Canvas (with character-grid abstraction)
- **State Management**: Immutable state with Command pattern for undo/redo
- **Tool Framework**: Action-based system inspired by KiCad/Excalidraw
- **Deployment**: Single HTML file with embedded JS/CSS

---

## Part 1: Rendering Decision

### Options Analyzed

| Technology | Pros | Cons | Verdict |
|------------|------|------|---------|
| **HTML Canvas** | Fast rendering, pixel control, good for text, simple API | Manual hit-testing, no DOM events on objects | **RECOMMENDED** |
| **SVG** | DOM events, CSS styling, resolution independent | Performance degrades with many elements, complex for character grid | Not ideal |
| **WebGL** | GPU acceleration, handles thousands of objects | Complex GLSL shaders, overkill for text rendering | Overkill |
| **DOM Grid** | Simple hit-testing, native events | Very slow for large diagrams, DOM overhead | Not viable |

### Recommendation: Canvas with Character Grid Abstraction

**Why Canvas:**
1. Our use case is **text/character rendering** - Canvas excels here
2. We're dealing with a **fixed character grid** - perfect for Canvas
3. Expected object count: tens to hundreds (not thousands)
4. Canvas allows **precise font metrics** with Berkeley Mono
5. Single redraw model is simpler than managing DOM/SVG tree

**Architecture:**
```
┌─────────────────────────────────────────┐
│           Pixel Coordinates             │
│  ┌───────────────────────────────────┐  │
│  │       HTML Canvas Element         │  │
│  │                                   │  │
│  │   Character Grid Abstraction      │  │
│  │   (row, col) ←→ (px_x, px_y)     │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│           Character Coordinates         │
└─────────────────────────────────────────┘
```

---

## Part 2: Tool Framework Architecture

### Inspiration: KiCad GAL + Excalidraw Action System

KiCad's approach:
- Tools are classes providing "actions"
- Actions can be one-off (zoom) or interactive (draw polygon)
- `setTransitions()` maps events to handlers
- Event loop: `while (evt = Wait())` pattern

Excalidraw's approach:
- Actions are registered objects with `perform()` method
- ActionManager dispatches actions
- State flows through action performers

### Our Design: Hybrid Tool/Action System

```
┌─────────────────────────────────────────────────────────────┐
│                      EVENT DISPATCHER                        │
│  Receives: mouse events, keyboard events, touch events       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      TOOL MANAGER                            │
│  - Maintains active tool                                     │
│  - Routes events to active tool                              │
│  - Manages tool stack (for nested operations)                │
│  - Handles global hotkeys                                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  SELECT  │    │   BOX    │    │   LINE   │
    │   TOOL   │    │   TOOL   │    │   TOOL   │
    └──────────┘    └──────────┘    └──────────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    ACTION DISPATCHER                         │
│  Executes commands that modify state                         │
│  All state changes go through here (enables undo/redo)       │
└─────────────────────────────────────────────────────────────┘
```

### Tool Interface

```javascript
class Tool {
  name = 'base-tool';
  icon = null;
  cursor = 'default';

  // Lifecycle
  activate(context) {}    // Called when tool becomes active
  deactivate() {}         // Called when switching away

  // Event handlers - return true if handled
  onMouseDown(event, context) { return false; }
  onMouseMove(event, context) { return false; }
  onMouseUp(event, context) { return false; }
  onKeyDown(event, context) { return false; }
  onKeyUp(event, context) { return false; }

  // Rendering (tool-specific overlays)
  renderOverlay(ctx, context) {}
}
```

### Tool State Machine

```
                    ┌─────────────────┐
                    │      IDLE       │
                    │  (Select Tool)  │
                    └────────┬────────┘
                             │ click on canvas
                             ▼
              ┌──────────────────────────────┐
              │      TOOL ACTIVATED          │
              │  (e.g., Box Tool active)     │
              └──────────────┬───────────────┘
                             │ mousedown
                             ▼
              ┌──────────────────────────────┐
              │      DRAGGING/DRAWING        │
              │  (creating new object)       │
              └──────────────┬───────────────┘
                             │ mouseup
                             ▼
              ┌──────────────────────────────┐
              │      OBJECT CREATED          │
              │  (command dispatched)        │
              └──────────────┬───────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Return IDLE   │
                    └─────────────────┘
```

### Selection Tool State Machine

```
                    ┌─────────────────┐
                    │      IDLE       │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
   click empty         click object       click handle
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  MARQUEE SELECT │ │    SELECTED     │ │    RESIZING     │
│  (drag to box)  │ │  (drag=move)    │ │  (drag=resize)  │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │ mouseup
                             ▼
                    ┌─────────────────┐
                    │   Return IDLE   │
                    └─────────────────┘
```

---

## Part 3: Undo/Redo Architecture

### The Command Pattern

**Critical Insight**: Undo/redo must be foundational, not bolted on later.

Every state mutation goes through a Command:

```javascript
class Command {
  execute(state) {}   // Apply change, return new state
  undo(state) {}      // Reverse change, return new state

  // Optional: merge consecutive similar commands
  canMerge(other) { return false; }
  merge(other) { return this; }
}
```

### History Manager

```javascript
class HistoryManager {
  constructor(initialState) {
    this.state = initialState;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 100;
  }

  execute(command) {
    // Try to merge with last command (e.g., typing characters)
    if (this.undoStack.length > 0) {
      const last = this.undoStack[this.undoStack.length - 1];
      if (last.canMerge(command)) {
        this.undoStack[this.undoStack.length - 1] = last.merge(command);
        this.state = command.execute(this.state);
        this.redoStack = [];
        return;
      }
    }

    this.state = command.execute(this.state);
    this.undoStack.push(command);
    this.redoStack = [];  // Clear redo on new action

    // Limit history size
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const command = this.undoStack.pop();
    this.state = command.undo(this.state);
    this.redoStack.push(command);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const command = this.redoStack.pop();
    this.state = command.execute(this.state);
    this.undoStack.push(command);
  }
}
```

### Example Commands

```javascript
class CreateObjectCommand {
  constructor(object) {
    this.object = object;
    this.id = object.id;
  }

  execute(state) {
    return {
      ...state,
      objects: [...state.objects, this.object]
    };
  }

  undo(state) {
    return {
      ...state,
      objects: state.objects.filter(o => o.id !== this.id)
    };
  }
}

class MoveObjectCommand {
  constructor(id, fromPos, toPos) {
    this.id = id;
    this.fromPos = fromPos;
    this.toPos = toPos;
  }

  execute(state) {
    return {
      ...state,
      objects: state.objects.map(o =>
        o.id === this.id ? { ...o, x: this.toPos.x, y: this.toPos.y } : o
      )
    };
  }

  undo(state) {
    return {
      ...state,
      objects: state.objects.map(o =>
        o.id === this.id ? { ...o, x: this.fromPos.x, y: this.fromPos.y } : o
      )
    };
  }

  // Merge consecutive moves of same object
  canMerge(other) {
    return other instanceof MoveObjectCommand && other.id === this.id;
  }

  merge(other) {
    return new MoveObjectCommand(this.id, this.fromPos, other.toPos);
  }
}
```

### State Immutability

We use **shallow immutability** (not deep cloning) for performance:

```javascript
// State structure
const state = {
  canvas: { width: 200, height: 100 },
  objects: [
    { id: 'box-1', type: 'box', x: 10, y: 5, ... },
    { id: 'line-1', type: 'line', points: [...], ... }
  ],
  selection: ['box-1'],
  tool: 'select'
};

// Updating one object (efficient - only clone what changes)
const newState = {
  ...state,
  objects: state.objects.map(o =>
    o.id === 'box-1' ? { ...o, x: 20 } : o
  )
};
```

---

## Part 4: Hotkey System

### Hotkey Registry

```javascript
class HotkeyManager {
  constructor() {
    this.bindings = new Map();  // key combo -> action
    this.contexts = [];         // stack of active contexts
  }

  register(combo, action, context = 'global') {
    const key = `${context}:${combo}`;
    this.bindings.set(key, action);
  }

  handleKeyDown(event) {
    const combo = this.eventToCombo(event);

    // Check context-specific first, then global
    for (const ctx of [...this.contexts, 'global']) {
      const key = `${ctx}:${combo}`;
      if (this.bindings.has(key)) {
        event.preventDefault();
        this.bindings.get(key)();
        return true;
      }
    }
    return false;
  }

  eventToCombo(event) {
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
    if (event.shiftKey) parts.push('Shift');
    if (event.altKey) parts.push('Alt');
    parts.push(event.key.toUpperCase());
    return parts.join('+');
  }

  pushContext(context) {
    this.contexts.push(context);
  }

  popContext() {
    this.contexts.pop();
  }
}
```

### Default Hotkeys

```javascript
// Global
hotkeys.register('Ctrl+Z', () => history.undo());
hotkeys.register('Ctrl+Y', () => history.redo());
hotkeys.register('Ctrl+Shift+Z', () => history.redo());
hotkeys.register('DELETE', () => deleteSelected());
hotkeys.register('ESCAPE', () => cancelCurrentOperation());
hotkeys.register('Ctrl+A', () => selectAll());
hotkeys.register('Ctrl+C', () => copySelection());
hotkeys.register('Ctrl+V', () => paste());
hotkeys.register('Ctrl+S', () => saveProject());
hotkeys.register('Ctrl+E', () => exportASCII());

// Tool shortcuts
hotkeys.register('V', () => activateTool('select'));
hotkeys.register('B', () => activateTool('box'));
hotkeys.register('L', () => activateTool('line'));
hotkeys.register('T', () => activateTool('text'));
hotkeys.register('S', () => activateTool('symbol'));
hotkeys.register('P', () => activateTool('port'));
hotkeys.register('W', () => activateTool('wire'));
hotkeys.register('U', () => activateTool('bus'));
hotkeys.register('O', () => activateTool('power'));    // pOwer symbol

// View shortcuts
hotkeys.register('G', () => toggleGridView());      // Toggle grid/single view
hotkeys.register('Ctrl+TAB', () => nextPage());     // Next page
hotkeys.register('Ctrl+Shift+TAB', () => prevPage()); // Previous page

// Hierarchical navigation
hotkeys.register('ENTER', () => descendIntoSelected()); // Enter hierarchical block
hotkeys.register('BACKSPACE', () => ascendFromPage());  // Go back up to parent
```

---

## Part 5: Application State Structure

### Multi-Page Architecture

The data model supports **multiple pages** within a single project. This enables:
- Schematic-style multi-sheet diagrams
- Port interconnects across pages
- Hierarchical designs
- Organized documentation
- **Grid view**: See multiple pages side-by-side

### View Modes

```
┌─────────────────────────────────────────────────────────────┐
│  SINGLE PAGE VIEW (editing mode)                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │              Active Page (full canvas)                │  │
│  │                                                       │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│  [Page1] [Page2*] [Page3] [+]     <- tab bar               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  GRID VIEW (overview mode) - zoom out to see all pages      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Page 1    │ │   Page 2    │ │   Page 3    │           │
│  │   "Main"    │ │   "Power"   │ │   "IO"      │           │
│  │  ┌───┐      │ │  ┌───┐      │ │  ┌───┐      │           │
│  │  │MCU│──────┼─┼──│REG│      │ │  │USB│      │           │
│  │  └───┘      │ │  └───┘      │ │  └───┘      │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  Click page to zoom in and edit                             │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│                        PROJECT                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Page 1: "Main"                                       │   │
│  │  ┌─────┐     ┌─────┐                                │   │
│  │  │ MCU │────▶│ USB │──▶[PORT: USB_OUT]              │   │
│  │  └─────┘     └─────┘                                │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Page 2: "Power"                                      │   │
│  │  [PORT: USB_OUT]──▶┌─────┐     ┌─────┐              │   │
│  │                    │ REG │────▶│ CAP │              │   │
│  │                    └─────┘     └─────┘              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Project-Level Data Model (JSON)

```javascript
const project = {
  // Project metadata
  meta: {
    name: "My Diagram",
    version: "1.0",
    created: "2025-12-15T...",
    modified: "2025-12-15T..."
  },

  // Global settings
  settings: {
    charWidth: 10,        // pixels (from font measurement)
    charHeight: 20,
    defaultPageWidth: 120,
    defaultPageHeight: 60,
    font: "BerkeleyMono",
    fontSize: 16
  },

  // Project parameters (arbitrary key-value, used for title blocks, text substitution)
  parameters: {
    // Standard title block fields
    "PROJECT_NAME": "USB Power Supply",
    "AUTHOR": "John Doe",
    "COMPANY": "Acme Corp",
    "REVISION": "1.0",
    "DATE": "2025-12-15",

    // Custom parameters
    "PART_NUMBER": "ACME-PSU-001",
    "APPROVAL": "Jane Smith",
    "STATUS": "Draft",
    "URL": "https://example.com/docs",

    // Can add any arbitrary key-value pairs
    "VOLTAGE_IN": "5V",
    "VOLTAGE_OUT": "3.3V"
  },

  // Pages array
  pages: [
    {
      id: "page-1",
      name: "Main",
      width: 120,         // characters (can vary per page)
      height: 60,
      // Page-level parameter overrides (optional)
      parameters: {
        "PAGE_NUMBER": "1",
        "PAGE_TITLE": "Main Schematic"
      },
      objects: [
        { id: "box-1", type: "box", ... },
        { id: "port-1", type: "port", name: "USB_OUT", ... }
      ]
    },
    {
      id: "page-2",
      name: "Power",
      width: 120,
      height: 40,
      parameters: {
        "PAGE_NUMBER": "2",
        "PAGE_TITLE": "Power Supply"
      },
      objects: [
        { id: "port-2", type: "port", name: "USB_OUT", ... },
        { id: "box-2", type: "box", ... }
      ]
    }
  ],

  // Global net definitions (cross-page connections)
  nets: [
    {
      name: "USB_OUT",
      ports: ["page-1:port-1", "page-2:port-2"]
    },
    {
      name: "VCC",
      ports: ["page-1:port-3", "page-2:port-4", "page-3:port-1"]
    }
  ],

  // Interface/Bus definitions (signal bundles)
  interfaces: [
    {
      id: "iface-i2c",
      name: "I2C",
      signals: ["SDA", "SCL"]
    },
    {
      id: "iface-spi",
      name: "SPI",
      signals: ["MOSI", "MISO", "SCK", "CS"]
    },
    {
      id: "iface-data8",
      name: "DATA[7:0]",
      signals: ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7"]
    },
    {
      id: "iface-custom",
      name: "SENSOR_IF",
      signals: ["PWR", "GND", "DATA", "CLK", "INT"]
    }
  ]
};
```

### Runtime State (includes UI state)

```javascript
const initialState = {
  // Project data (serializable)
  project: {
    meta: { ... },
    settings: { ... },
    pages: [ ... ],
    nets: [ ... ]
  },

  // Current page being edited
  activePageId: "page-1",

  // View state (per-page, not serialized to project)
  viewState: {
    "page-1": { zoom: 1.0, panX: 0, panY: 0 },
    "page-2": { zoom: 1.5, panX: 100, panY: 50 }
  },

  // Current selection (page-specific)
  selection: {
    ids: [],              // selected object IDs on active page
    handles: null         // active resize handle, if any
  },

  // Current tool
  activeTool: 'select',

  // Tool-specific transient state
  toolState: {
    // e.g., for box tool: { startX, startY, currentX, currentY }
  },

  // Clipboard (can hold objects from any page)
  clipboard: {
    sourcePageId: null,
    objects: []
  },

  // UI state
  ui: {
    sidebarVisible: true,
    propertiesPanelVisible: true,
    pageListVisible: true,
    gridVisible: true,
    viewMode: 'single'      // 'single' = one page, 'grid' = all pages
  },

  // Grid view layout (when viewMode === 'grid')
  gridLayout: {
    columns: 3,             // Pages per row
    pageSpacing: 20,        // Pixels between pages
    zoom: 0.3,              // Zoom level for overview
    panX: 0,
    panY: 0
  },

  // Hierarchical navigation stack (for descend/ascend)
  navigationStack: [
    // { pageId: "page-1", blockId: "hier-1" }  // Breadcrumb trail
  ]
};
```

### Page Operations

```javascript
// Helper functions for page management
function getActivePage(state) {
  return state.project.pages.find(p => p.id === state.activePageId);
}

function getPageObjects(state, pageId = null) {
  const id = pageId || state.activePageId;
  const page = state.project.pages.find(p => p.id === id);
  return page ? page.objects : [];
}

function addPage(state, name = "New Page") {
  const newPage = {
    id: generateId(),
    name,
    width: state.project.settings.defaultPageWidth,
    height: state.project.settings.defaultPageHeight,
    objects: []
  };
  return {
    ...state,
    project: {
      ...state.project,
      pages: [...state.project.pages, newPage]
    },
    activePageId: newPage.id
  };
}

function deletePage(state, pageId) {
  // Don't delete last page
  if (state.project.pages.length <= 1) return state;

  const newPages = state.project.pages.filter(p => p.id !== pageId);
  const newActiveId = state.activePageId === pageId
    ? newPages[0].id
    : state.activePageId;

  // Also clean up nets referencing this page
  const newNets = state.project.nets.map(net => ({
    ...net,
    ports: net.ports.filter(p => !p.startsWith(pageId + ':'))
  })).filter(net => net.ports.length > 0);

  return {
    ...state,
    project: {
      ...state.project,
      pages: newPages,
      nets: newNets
    },
    activePageId: newActiveId
  };
}
```

### Port/Net Cross-Page References

```javascript
// Port object with global net reference (single signal)
const portObject = {
  id: "port-1",
  type: "port",
  x: 5,
  y: 10,
  name: "USB_DATA",      // Display name
  netName: "USB_DATA",   // Global net name (links across pages)
  direction: "out",      // in, out, bidirectional
  side: "right"          // which side the connector points
};

// Interface port (bundle of signals)
const interfacePortObject = {
  id: "iport-1",
  type: "interface-port",
  x: 5,
  y: 15,
  name: "I2C_BUS",           // Display name
  interfaceId: "iface-i2c",  // Reference to interface definition
  direction: "bidirectional",
  side: "right"
};
```

### Interface/Bus Objects

```javascript
// Interface pin on a symbol (bundle connection point)
const symbolWithInterfacePin = {
  id: "symbol-1",
  type: "symbol",
  x: 20, y: 10,
  width: 15, height: 12,
  text: "MCU",
  designator: "U1",
  pins: [
    // Regular pins
    { name: "VCC", number: "1", side: "left", position: 1, type: "power" },
    { name: "GND", number: "2", side: "left", position: 2, type: "power" },
    // Interface pin (bundle) - references an interface definition
    {
      name: "I2C",           // Display name
      number: "3-4",         // Can show range
      side: "right",
      position: 1,
      type: "interface",     // Marks this as a bundle
      interfaceId: "iface-i2c"
    },
    {
      name: "SPI",
      number: "5-8",
      side: "right",
      position: 2,
      type: "interface",
      interfaceId: "iface-spi"
    }
  ]
};

// Object parameters - arbitrary key-value attributes on any object
const symbolWithParameters = {
  id: "symbol-2",
  type: "symbol",
  x: 50, y: 10,
  width: 12, height: 8,
  text: "REG",
  designator: "U2",

  // Arbitrary parameters (key-value store)
  parameters: {
    "value": {
      value: "3.3V",
      visible: true,           // Show on sheet
      position: { dx: 0, dy: -2 }  // Offset from object (above)
    },
    "manufacturer": {
      value: "Texas Instruments",
      visible: false           // Hidden (metadata only)
    },
    "mpn": {
      value: "TPS63000",
      visible: true,
      position: { dx: 0, dy: 2 }   // Below object
    },
    "datasheet": {
      value: "https://ti.com/lit/ds/tps63000.pdf",
      visible: false
    },
    "tolerance": {
      value: "±2%",
      visible: false
    },
    // Any custom fields
    "notes": {
      value: "Check thermal pad",
      visible: false
    }
  }
};

/*
Rendered on sheet:

         3.3V        ← value (visible, above)
      ┌────────┐
      │  REG   │
      │   U2   │
      └────────┘
       TPS63000     ← mpn (visible, below)

Hidden parameters (manufacturer, datasheet, tolerance, notes)
available for BOM export, search, hover tooltips, etc.
*/

// Parameters work on any object type
const boxWithParameters = {
  id: "box-1",
  type: "box",
  x: 10, y: 5,
  width: 20, height: 8,
  text: "Power Supply",
  parameters: {
    "version": { value: "2.1", visible: true, position: { dx: 15, dy: 0 } },
    "author": { value: "John", visible: false }
  }
};

// Bus wire (carries an interface/bundle)
const busWireObject = {
  id: "bus-1",
  type: "bus",
  points: [[30, 12], [50, 12], [50, 20]],
  interfaceId: "iface-i2c",  // Which interface this bus carries
  label: "I2C_BUS",          // Optional display label
  style: "double"            // Rendered as double line ═ or thick
};

// Regular wire (single net)
const wireObject = {
  id: "wire-1",
  type: "wire",
  points: [[30, 5], [40, 5]],
  netName: "VCC",            // Single signal
  label: "VCC",
  style: "single"            // Rendered as single line ─
};

// Power symbol (VCC, GND, etc.)
const powerSymbol = {
  id: "pwr-1",
  type: "power",
  x: 25, y: 10,
  netName: "VCC",            // Global net this connects to
  style: "arrow-up",         // Visual style
  label: "+5V",              // Optional display label (default: netName)
  labelPosition: "above"     // above, below, left, right
};

/*
Power Symbol Visual Styles:

  arrow-up (positive supply):       arrow-down:
       ▲                                VCC
      VCC                                ▼

  ground (GND):                     bar (generic):
      GND                              ───
       ┴                               GND
      ═╧═

  circle (node):                    custom (text only):
       ○──                            [VBAT]──
      VCC

ASCII representations:
  arrow-up:   "  ▲  "   or   "  △  "
              " VCC "        " +5V "

  ground:     " GND "        " GND "
              "  ┴  "   or   " ═╧═ "
              " ═══ "

  bar:        "─┬─"
              "VCC"

  circle:     "○ VCC"   or   "(+) VCC"
*/

// Power symbols implicitly connect all instances with same netName
// i.e., all "VCC" power symbols are on the same net globally

// Hierarchical block (sheet symbol) - represents another page
const hierarchicalBlock = {
  id: "hier-1",
  type: "hierarchical-block",
  x: 10, y: 20,
  width: 20, height: 15,     // Auto-sized based on pins, or manual
  pageId: "page-2",          // Reference to the sub-page
  designator: "POWER",       // Instance name
  // Pins are auto-derived from page-2's ports:
  // If page-2 has ports: VIN, VOUT, GND
  // This block automatically has pins: VIN, VOUT, GND
  // Pin positions are auto-arranged or can be manually adjusted
  pinOverrides: {
    // Optional: override auto-placement of specific pins
    "VIN": { side: "left", position: 1 },
    "VOUT": { side: "right", position: 1 },
    "GND": { side: "bottom", position: 1 }
  }
};
```

### Hierarchical vs Flat Mode

```
FLAT MODE (default):
  All pages at same level, connected via ports with matching net names

  ┌─────────┐         ┌─────────┐
  │ Page 1  │         │ Page 2  │
  │         │         │         │
  │ [OUT]───┼────────►┼──[IN]   │
  └─────────┘         └─────────┘

HIERARCHICAL MODE:
  Pages can contain blocks that represent other pages

  Page 1 (Top):
  ┌─────────────────────────────────┐
  │  ┌─────────────┐                │
  │  │   POWER     │◄── This block  │
  │  │  (page-2)   │    represents  │
  │  ├─────────────┤    page-2      │
  │  │ VIN    VOUT │                │
  │  │     GND     │                │
  │  └──────┬──────┘                │
  │         │                       │
  │  ┌──────┴──────┐                │
  │  │    MCU      │                │
  │  └─────────────┘                │
  └─────────────────────────────────┘

  Double-click "POWER" block → navigates to page-2

  Page 2 (Sub-page):
  ┌─────────────────────────────────┐
  │ [VIN]──►┌─────┐──►[VOUT]        │
  │         │ REG │                 │
  │         └──┬──┘                 │
  │            │                    │
  │         [GND]                   │
  └─────────────────────────────────┘

  Ports on page-2 become pins on the hierarchical block
```

```javascript
// Get pins for a hierarchical block (derived from sub-page ports)
function getHierarchicalBlockPins(state, block) {
  const subPage = state.project.pages.find(p => p.id === block.pageId);
  if (!subPage) return [];

  // Find all ports on the sub-page
  const ports = subPage.objects.filter(o =>
    o.type === 'port' || o.type === 'interface-port'
  );

  // Convert ports to pins
  return ports.map(port => {
    const override = block.pinOverrides?.[port.name] || {};
    return {
      name: port.name,
      type: port.type === 'interface-port' ? 'interface' : 'signal',
      interfaceId: port.interfaceId,
      direction: port.direction,
      side: override.side || (port.direction === 'in' ? 'left' : 'right'),
      position: override.position || 'auto'
    };
  });
}

// Navigate into hierarchical block
function descendIntoBlock(state, blockId) {
  const block = getObjectById(state, blockId);
  if (block?.type !== 'hierarchical-block') return state;

  return {
    ...state,
    activePageId: block.pageId,
    navigationStack: [...(state.navigationStack || []), {
      pageId: state.activePageId,
      blockId: blockId
    }]
  };
}

// Navigate back up from sub-page
function ascendFromPage(state) {
  const stack = state.navigationStack || [];
  if (stack.length === 0) return state;

  const parent = stack[stack.length - 1];
  return {
    ...state,
    activePageId: parent.pageId,
    selection: { ids: [parent.blockId], handles: null },
    navigationStack: stack.slice(0, -1)
  };
}
```

### Parameter Substitution

Text objects can use `${PARAM_NAME}` syntax for dynamic values:

```javascript
// Text object with parameter substitution
const titleBlockText = {
  id: "text-title",
  type: "text",
  x: 5, y: 55,
  text: "${PROJECT_NAME} - ${PAGE_TITLE}",  // Raw text with placeholders
  // Rendered as: "USB Power Supply - Main Schematic"
};

// Another example - revision info
const revisionText = {
  id: "text-rev",
  type: "text",
  x: 100, y: 58,
  text: "Rev: ${REVISION}  Date: ${DATE}  Author: ${AUTHOR}"
  // Rendered as: "Rev: 1.0  Date: 2025-12-15  Author: John Doe"
};

// Parameter resolution function
function resolveParameters(text, state, pageId = null) {
  const page = pageId
    ? state.project.pages.find(p => p.id === pageId)
    : getActivePage(state);

  return text.replace(/\$\{(\w+)\}/g, (match, paramName) => {
    // Page params override project params
    if (page?.parameters?.[paramName] !== undefined) {
      return page.parameters[paramName];
    }
    if (state.project.parameters?.[paramName] !== undefined) {
      return state.project.parameters[paramName];
    }
    // Keep placeholder if param not found
    return match;
  });
}

// Built-in auto parameters (computed, not stored)
function getAutoParameters(state) {
  const page = getActivePage(state);
  const pageIndex = state.project.pages.findIndex(p => p.id === state.activePageId);

  return {
    "CURRENT_DATE": new Date().toISOString().split('T')[0],
    "CURRENT_TIME": new Date().toLocaleTimeString(),
    "PAGE_COUNT": String(state.project.pages.length),
    "PAGE_INDEX": String(pageIndex + 1),
    "PAGE_NAME": page?.name || "",
    "FILE_NAME": state.project.meta?.name || "Untitled"
  };
}

// Find all ports connected to a net
function getConnectedPorts(state, netName) {
  const results = [];
  for (const page of state.project.pages) {
    for (const obj of page.objects) {
      if (obj.type === 'port' && obj.netName === netName) {
        results.push({
          pageId: page.id,
          pageName: page.name,
          port: obj
        });
      }
    }
  }
  return results;
}

// Navigate to connected port
function goToPort(state, netName, excludePortId) {
  const connected = getConnectedPorts(state, netName);
  const other = connected.find(c => c.port.id !== excludePortId);
  if (other) {
    return {
      ...state,
      activePageId: other.pageId,
      selection: { ids: [other.port.id], handles: null }
    };
  }
  return state;
}
```

### Page Commands (for Undo/Redo)

```javascript
class CreatePageCommand {
  constructor(page) {
    this.page = page;
  }

  execute(state) {
    return {
      ...state,
      project: {
        ...state.project,
        pages: [...state.project.pages, this.page]
      }
    };
  }

  undo(state) {
    return {
      ...state,
      project: {
        ...state.project,
        pages: state.project.pages.filter(p => p.id !== this.page.id)
      }
    };
  }
}

class RenamePageCommand {
  constructor(pageId, oldName, newName) {
    this.pageId = pageId;
    this.oldName = oldName;
    this.newName = newName;
  }

  execute(state) {
    return this.setName(state, this.newName);
  }

  undo(state) {
    return this.setName(state, this.oldName);
  }

  setName(state, name) {
    return {
      ...state,
      project: {
        ...state.project,
        pages: state.project.pages.map(p =>
          p.id === this.pageId ? { ...p, name } : p
        )
      }
    };
  }
}
```

---

## Part 6: File Structure

### Single HTML Approach (Development)

```
ascii_editor.html
├── <style> ... </style>           // CSS
├── <div id="app">...</div>        // HTML structure
└── <script>
    ├── // === UTILITIES ===
    │   ├── generateId()
    │   ├── deepClone()
    │   └── ...
    │
    ├── // === STATE & HISTORY ===
    │   ├── class Command
    │   ├── class HistoryManager
    │   └── state management
    │
    ├── // === RENDERING ===
    │   ├── class CharacterGrid
    │   ├── class Renderer
    │   └── render functions
    │
    ├── // === OBJECTS ===
    │   ├── class Box
    │   ├── class Line
    │   ├── class Text
    │   ├── class Symbol
    │   └── class Port
    │
    ├── // === TOOLS ===
    │   ├── class Tool (base)
    │   ├── class SelectTool
    │   ├── class BoxTool
    │   ├── class LineTool
    │   ├── class TextTool
    │   └── class ToolManager
    │
    ├── // === COMMANDS ===
    │   ├── class CreateCommand
    │   ├── class DeleteCommand
    │   ├── class MoveCommand
    │   ├── class ResizeCommand
    │   └── class ModifyCommand
    │
    ├── // === HOTKEYS ===
    │   ├── class HotkeyManager
    │   └── default bindings
    │
    ├── // === SERIALIZATION ===
    │   ├── exportJSON()
    │   ├── importJSON()
    │   ├── exportASCII()
    │   └── exportSVG()
    │
    └── // === MAIN ===
        ├── initialization
        ├── event binding
        └── render loop
    </script>
```

### Modular Approach (If needed later)

```
/ascii_editor/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── state/
│   │   ├── history.js
│   │   └── commands.js
│   ├── render/
│   │   ├── grid.js
│   │   └── renderer.js
│   ├── objects/
│   │   ├── base.js
│   │   ├── box.js
│   │   ├── line.js
│   │   └── ...
│   ├── tools/
│   │   ├── manager.js
│   │   ├── select.js
│   │   ├── box.js
│   │   └── ...
│   └── io/
│       ├── json.js
│       └── ascii.js
└── fonts/
    └── BerkeleyMono-Regular.woff2
```

---

## Part 7: Implementation Phases

### Phase 1: Foundation (Core Architecture)

**Goal**: Working canvas with tool framework skeleton and multi-page data model

```
[ ] HTML structure with canvas element
[ ] Load Berkeley Mono font, measure character dimensions
[ ] CharacterGrid class (coord transforms)
[ ] Basic rendering (draw character at row,col)
[ ] Multi-page project data model
[ ] State management skeleton (project + runtime state)
[ ] HistoryManager with undo/redo
[ ] ToolManager skeleton
[ ] HotkeyManager skeleton
[ ] Event dispatcher (mouse, keyboard)
[ ] Page tab bar UI (switch between pages)
```

**Deliverable**: Empty grid with page tabs, Ctrl+Z/Y work (even if nothing to undo)

### Phase 2: Select Tool & Object Model

**Goal**: Can select, move, resize placeholder objects

```
[ ] Base Object class
[ ] Box object (simple rectangle)
[ ] SelectTool implementation:
    [ ] Click to select
    [ ] Drag to move
    [ ] Resize handles
    [ ] Marquee selection
[ ] Selection rendering (highlight, handles)
[ ] MoveCommand, ResizeCommand
[ ] Delete selected (DEL key)
```

**Deliverable**: Can select/move/resize/delete test boxes

### Phase 3: Box Tool & Text

**Goal**: Can create boxes with text

```
[ ] BoxTool implementation:
    [ ] Click-drag to create box
    [ ] CreateBoxCommand
[ ] Box rendering:
    [ ] Unicode box characters
    [ ] Multiple styles (single, double, rounded)
    [ ] Shadow effect (░ offset)
[ ] Text inside box:
    [ ] Inline text editing
    [ ] Text justification (L/C/R)
[ ] Free-floating TextTool
```

**Deliverable**: Can create styled boxes with text

### Phase 4: Lines & Connectors

**Goal**: Can draw lines with arrows

```
[ ] Line object model
[ ] LineTool implementation:
    [ ] Click to set points
    [ ] Horizontal/vertical snapping
[ ] Line rendering:
    [ ] Box-drawing characters
    [ ] Corner detection (┌ ┐ └ ┘)
    [ ] Arrow heads (← → ↑ ↓)
[ ] Connection points on boxes
[ ] Sticky connectors (lines follow box movement)
```

**Deliverable**: Can create connected diagrams

### Phase 5: Schematic Features

**Goal**: Pin boxes, wires, ports, interfaces, hierarchical blocks

```
[ ] Symbol object (box with pins)
[ ] Pin definition UI
[ ] Pin rendering (name inside, number outside)
[ ] Designator/value fields
[ ] Port object (single signal)
[ ] Wire labels (net names)
[ ] Connection tracking
[ ] Power symbols (VCC, GND, etc.)
[ ] Power symbol styles (arrow, ground, bar, circle)
[ ] Interface definitions (signal bundles)
[ ] Interface pins on symbols
[ ] Interface ports (bundle ports)
[ ] Bus wires (double-line style for bundles)
[ ] Interface editor (define/edit bundles)
[ ] Hierarchical block object (represents another page)
[ ] Auto-derive pins from sub-page ports
[ ] Descend/ascend navigation (Enter/Backspace)
[ ] Navigation breadcrumb trail
[ ] Pin override positioning
```

**Deliverable**: Can create schematic-style diagrams with buses/interfaces and hierarchical pages

### Phase 6: Serialization

**Goal**: Save/load/export

```
[ ] JSON save (download file)
[ ] JSON load (file picker)
[ ] LocalStorage auto-save
[ ] ASCII export
[ ] Copy to clipboard
[ ] SVG export (stretch)
```

**Deliverable**: Full persistence

### Phase 7: Polish & Advanced Views

**Goal**: Production-ready UX

```
[ ] Toolbar UI
[ ] Properties panel
[ ] Grid snapping
[ ] Alignment guides
[ ] Zoom/pan controls
[ ] Keyboard navigation
[ ] Grid view mode (see all pages)
[ ] Page arrangement in grid
[ ] Click-to-focus from grid view
[ ] Touch support (stretch)
```

---

## Part 8: Key Technical Details

### Font Loading & Measurement

```javascript
async function loadFont() {
  const font = new FontFace('BerkeleyMono', 'url(BerkeleyMono-Regular.woff2)');
  await font.load();
  document.fonts.add(font);

  // Measure character dimensions
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = '16px BerkeleyMono';

  const metrics = ctx.measureText('M');
  const charWidth = metrics.width;
  const charHeight = 20; // Approximate, may need adjustment

  return { charWidth, charHeight };
}
```

### Unicode Box Drawing Reference

```
Single line:
┌─────┐   ─ (U+2500)  │ (U+2502)
│     │   ┌ (U+250C)  ┐ (U+2510)
│     │   └ (U+2514)  ┘ (U+2518)
└─────┘   ├ (U+251C)  ┤ (U+2524)
          ┬ (U+252C)  ┴ (U+2534)
          ┼ (U+253C)

Double line:
╔═════╗   ═ (U+2550)  ║ (U+2551)
║     ║   ╔ (U+2554)  ╗ (U+2557)
║     ║   ╚ (U+255A)  ╝ (U+255D)
╚═════╝

Rounded:
╭─────╮   ╭ (U+256D)  ╮ (U+256E)
│     │   ╰ (U+2570)  ╯ (U+256F)
╰─────╯

Arrows:
← (U+2190)  → (U+2192)  ↑ (U+2191)  ↓ (U+2193)
◀ (U+25C0)  ▶ (U+25B6)  ▲ (U+25B2)  ▼ (U+25BC)

Shadow/Fill:
░ (U+2591) Light shade
▒ (U+2592) Medium shade
▓ (U+2593) Dark shade
```

### Hit Testing

```javascript
function hitTest(pixelX, pixelY, objects) {
  // Convert to character coordinates
  const col = Math.floor(pixelX / charWidth);
  const row = Math.floor(pixelY / charHeight);

  // Check objects in reverse order (top-most first)
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (obj.containsPoint(col, row)) {
      return { object: obj, handle: null };
    }
    // Check resize handles if selected
    const handle = obj.getHandleAt(col, row);
    if (handle) {
      return { object: obj, handle };
    }
  }
  return null;
}
```

---

## Part 9: Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Font rendering inconsistency | Test across browsers early; fallback font |
| Complex line routing | Start with simple orthogonal; defer smart routing |
| Performance with many objects | Profile early; consider dirty rectangles |
| Undo/redo edge cases | Test thoroughly; keep commands simple |
| Text editing in canvas | Use hidden textarea overlay technique |

---

## Part 10: Success Criteria for Prototype

**Minimum Viable Prototype (MVP):**
1. ✓ Canvas renders Berkeley Mono character grid
2. ✓ Can create boxes with text
3. ✓ Can create simple lines
4. ✓ Can select, move, resize objects
5. ✓ Undo/redo works
6. ✓ Can export to ASCII text
7. ✓ Can save/load JSON

**Stretch Goals:**
- Shadow effects
- Multiple box styles
- Pin/symbol objects
- SVG export

---

## References

- [KiCad Tool Framework](https://dev-docs.kicad.org/en/components/tool-framework/index.html)
- [Excalidraw State Management](https://dev.to/karataev/excalidraw-state-management-1842)
- [XState - State Machines](https://xstate.js.org/)
- [Command Pattern for Undo](https://www.esveo.com/en/blog/undo-redo-and-the-command-pattern/)
- [Canvas vs SVG Comparison](https://www.jointjs.com/blog/svg-versus-canvas)
- [Unicode Box Drawing](https://en.wikipedia.org/wiki/Box-drawing_characters)
- [Fabric.js](https://fabricjs.com/)
- [Konva.js Selection/Transform](https://konvajs.org/docs/select_and_transform/Basic_demo.html)
