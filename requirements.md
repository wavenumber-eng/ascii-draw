# Cell-Based Diagram Editor - Requirements

This document describes the functional requirements (what the product does). For technical architecture (how the code is structured), see `ARCHITECTURE.md`.

**Legend:** `[x]` = Implemented, `[ ]` = Not implemented, `[~]` = Partial

---

## 1. Vision & Overview

### Core Concept: Cell-Based Diagram Engine

This is fundamentally a **cell-based (grid-based) diagram editor** — conceptually similar to tile-based engines from 8-bit and 16-bit games. Each cell in the grid contains a single graphical element.

The **current primary output** is ASCII art using Berkeley Mono font styling with UTF box-drawing characters. However, the architecture supports **multiple rendering backends** (ASCII, SVG, 3D) and **multiple viewports** (2D canvas, Three.js 3D).

### Key Principles

- **Cell coordinates are universal**: All objects are positioned in cell coordinates (col, row)
- **Rendering is pluggable**: ASCII characters, SVG elements, or 3D meshes can fill cells
- **Viewport is abstract**: 2D canvas or 3D workspace with the same tools
- **Cell dimensions are configurable**: Different fonts have different aspect ratios

### Use Cases

1. **ASCII Diagrams**: Block diagrams, flowcharts, architecture docs for README/comments
2. **Schematic Capture**: Lightweight EDA with symbols, pins, wires, netlists
3. **3D Visualization**: Isometric/tilted view for presentations (future)

**Inspiration:** `berkley_mono_reference.png` - clean boxes, arrows, shadow effects using extended ASCII/UTF characters.

**Data Model:** A connectivity graph with cell-based rendering. The JSON data model captures both structure (connections) and presentation (layout), enabling netlist generation, BOM export, and design rule checks while maintaining a lightweight, visual-first approach.

---

## 2. Design Philosophy

### Napkin to Netlist

- [x] **PHIL-1**: Support the full spectrum from quick sketch to full schematic
- [x] **PHIL-2**: Start with boxes and arrows (no connectivity required)
- [ ] **PHIL-3**: Add pins/connections later as design matures
- [x] **PHIL-4**: Same tool, same file, progressive refinement

### No Library Editor

- [ ] **PHIL-10**: Build symbols inline directly on the canvas
- [ ] **PHIL-11**: Add pins to any symbol without leaving the editor
- [ ] **PHIL-12**: No workflow interruption to "create library part first"
- [ ] **PHIL-13**: Eliminate the library creation pain point from Altium/KiCad

### Quick Editing

- [x] **PHIL-20**: Snap-to-grid for fast, aligned placement
- [x] **PHIL-21**: Keyboard shortcuts for all common operations
- [x] **PHIL-22**: Type-to-edit: start typing with object selected to edit immediately
- [x] **PHIL-23**: Double-click to edit text content
- [x] **PHIL-24**: Minimize modal dialogs - prefer inline/panel editing

### Dual-Purpose Usage

- [x] **PHIL-30**: Support pure documentation mode (boxes, text, lines - no connectivity)
- [ ] **PHIL-31**: Support schematic mode (pins, wires, nets - full connectivity)
- [ ] **PHIL-32**: Allow mixing both modes in the same project

---

## 3. Deployment Requirements

- [x] **DEP-1**: Single standalone HTML file that runs locally (primary goal)
- [x] **DEP-2**: No server required - works with `file://` protocol
- [~] **DEP-3**: No external dependencies at runtime (fonts embedded or bundled)
- [x] **DEP-4**: Development may use build tools, but output is single portable file
- [ ] **DEP-5**: Alternative deployment as Python script acceptable
- [ ] **DEP-6**: Three.js viewport optional (loaded only when enabled)

---

## 3.5 Viewport Requirements

The viewport is the workspace where users interact with the diagram. Multiple viewport implementations are supported.

### Viewport Abstraction

- [ ] **VIEW-1**: IViewport interface abstracts viewport implementation
- [ ] **VIEW-2**: Tools receive viewport via context, never access canvas directly
- [ ] **VIEW-3**: All coordinate transforms via viewport.screenToCell()
- [ ] **VIEW-4**: Viewport provides event target for mouse/keyboard events

### Canvas2D Viewport (Current)

- [~] **VIEW-10**: 2D canvas rendering (current implementation)
- [~] **VIEW-11**: Pan via mouse drag or keyboard
- [~] **VIEW-12**: Zoom via scroll wheel or +/- keys
- [x] **VIEW-13**: Grid overlay (toggleable)

### Three.js Viewport (Experimental)

- [ ] **VIEW-20**: Three.js 3D workspace as alternative viewport
- [ ] **VIEW-21**: OrthographicCamera for consistent cell sizing
- [ ] **VIEW-22**: Camera starts at 90° (top-down) matching 2D experience
- [ ] **VIEW-23**: Pan/zoom via MapControls
- [ ] **VIEW-24**: Tilt support for drafting-table angle
- [ ] **VIEW-25**: Isometric view preset (45° rotation)
- [ ] **VIEW-26**: Hotkey to toggle between top-down and isometric
- [ ] **VIEW-27**: Raycasting for screenToCell() coordinate transform
- [ ] **VIEW-28**: Same tools work in 3D as in 2D (via cell coordinates)

### Viewport Switching

- [ ] **VIEW-30**: UI control to switch between Canvas2D and Three.js viewports
- [ ] **VIEW-31**: Viewport preference saved in project settings
- [ ] **VIEW-32**: Fallback to Canvas2D if Three.js unavailable

---

## 3.6 Render Backend Requirements

The render backend determines what visual elements fill each cell.

### Backend Abstraction

- [ ] **BACK-1**: IRenderBackend interface abstracts rendering implementation
- [ ] **BACK-2**: Backends render cells, not pixels
- [ ] **BACK-3**: Backends support object-level drawing (box, line, symbol)
- [ ] **BACK-4**: Backends support overlay drawing (selection, handles, marquee)

### ASCII Backend (Current)

- [x] **BACK-10**: UTF-8 box-drawing characters for borders
- [x] **BACK-11**: Monospace character rendering
- [x] **BACK-12**: Shadow effects using ░▒▓ characters
- [x] **BACK-13**: Fill patterns (none, light, medium, dark, solid, dots)

### SVG Backend (Future)

- [ ] **BACK-20**: SVG elements for cell content
- [ ] **BACK-21**: Lines rendered as SVG `<line>` or `<path>`
- [ ] **BACK-22**: Boxes rendered as SVG `<rect>`
- [ ] **BACK-23**: Text rendered as SVG `<text>`
- [ ] **BACK-24**: Scalable vector output

### 3D Extruded Backend (Future)

- [ ] **BACK-30**: Z-height extrusion for boxes/symbols when tilted
- [ ] **BACK-31**: Depth effect visible only at non-90° camera angles
- [ ] **BACK-32**: Optional per-object Z-index for extrusion height

---

## 3.65 Overlay Renderer Requirements

Overlay rendering handles transient UI elements that are NOT part of the document.

### Overlay Abstraction

- [ ] **OVER-1**: IOverlayRenderer interface separate from IRenderBackend
- [ ] **OVER-2**: Overlays are NEVER exported
- [ ] **OVER-3**: Overlays may be screen-aligned (don't rotate with 3D camera)
- [ ] **OVER-4**: Viewport owns both render backend and overlay renderer

### Selection Overlays

- [x] **OVER-10**: Selection highlight around selected objects
- [x] **OVER-11**: Multi-selection bounding box
- [x] **OVER-12**: Resize handles on single selection
- [x] **OVER-13**: Vertex handles on lines/wires
- [x] **OVER-14**: Segment handles on lines/wires

### Marquee Selection Overlay

- [x] **OVER-20**: Enclosed mode marquee (solid border)
- [x] **OVER-21**: Intersect mode marquee (dashed border)
- [x] **OVER-22**: Different fill colors for each mode

### Tool Hints and Previews

- [x] **OVER-30**: Box/symbol preview while creating
- [x] **OVER-31**: Line/wire preview while drawing
- [~] **OVER-32**: Snap indicator at grid positions
- [~] **OVER-33**: Connection hints ("PIN", "CONNECT")
- [~] **OVER-34**: Hover highlight on objects

### Drag Feedback

- [x] **OVER-40**: Drag ghost showing objects being moved
- [x] **OVER-41**: Rubber-band line while drawing wires

### Inline Editing Overlays

- [x] **OVER-50**: Blinking text cursor
- [ ] **OVER-51**: Text selection highlight

### Three.js Overlay Strategy

- [ ] **OVER-60**: 2D canvas overlay option (screen-aligned, on top of WebGL)
- [ ] **OVER-61**: 3D billboard option (rotate with scene, face camera)
- [ ] **OVER-62**: Hybrid option (hints 2D, handles 3D)
- [ ] **OVER-63**: Configurable per-element screen-alignment

---

## 3.7 Cell Configuration Requirements

Cell dimensions are configurable to support different fonts and rendering styles.

### Cell Dimensions

- [ ] **CELL-1**: Cell width and height configurable at runtime
- [ ] **CELL-2**: Default cell dimensions from font metrics (Berkeley Mono: 10x20)
- [ ] **CELL-3**: Square cell support (e.g., Press Start 2P: 8x8)
- [ ] **CELL-4**: Cell aspect ratio affects object proportions
- [ ] **CELL-5**: Grid adapts to cell dimensions

### Font Support

- [x] **CELL-10**: Berkeley Mono as primary font (10x20 aspect)
- [ ] **CELL-11**: Press Start 2P as alternative (8x8 square)
- [ ] **CELL-12**: Custom font support with measured cell dimensions
- [ ] **CELL-13**: Font selection in project settings

---

## 4. Tools

| Status | ID | Tool | Shortcut | Description |
|--------|-----|------|----------|-------------|
| [x] | **TOOL-20** | SelectTool | V | Select, move, resize objects |
| [x] | **TOOL-21** | TextBoxTool | B | Create text box with border (default: single) |
| [x] | **TOOL-22** | TextTool | T | Create text box without border (style: none) |
| [x] | **TOOL-23** | LineTool | L | Create lines and connectors |
| [~] | **TOOL-24** | SymbolTool | S | Create pin/node boxes (schematic symbols) |
| [ ] | **TOOL-25** | WireTool | W | Create wires with net labels |
| [ ] | **TOOL-26** | PortTool | P | Create off-page connection ports |
| [ ] | **TOOL-27** | PowerTool | O | Create power symbols (VCC, GND) |
| [~] | **TOOL-28** | PinTool | I | Add pins to symbols |
| [ ] | **TOOL-29** | DeleteTool | X | Delete objects and segments |

### Box/Symbol Tool Interaction (TOOL-21, TOOL-24)

Two-click creation workflow for rectangular objects (boxes and symbols):

- [x] **TOOL-21A**: First click sets corner 1, tool remains active with preview
- [x] **TOOL-21B**: Second click sets corner 2 and creates the object
- [x] **TOOL-21C**: Escape before second click cancels creation (clears corner 1)
- [x] **TOOL-21D**: Same location for both clicks does not create object (degenerate case)
- [x] **TOOL-21E**: Preview rectangle shown between first click and cursor position
- [x] **TOOL-21F**: Mouse can move freely between clicks (no drag required)

### Pin Tool (TOOL-28)

- [~] **TOOL-28A**: Shows pin shape preview at cursor (●, ○, ■, □, etc.)
- [~] **TOOL-28B**: Cycle shape with number keys (like line styles)
- [~] **TOOL-28C**: Hover over symbol edge → shows "PIN" hint indicator
- [~] **TOOL-28D**: Click on symbol edge → creates pin at that position
- [~] **TOOL-28E**: Click elsewhere → no action (pin only valid on symbol edge)
- [ ] **TOOL-28F**: Pins auto-created when wire starts/ends on symbol edge (via WireTool)

### Delete Tool (TOOL-29)

Provides granular deletion including line/wire segment deletion that select+Delete cannot do.

- [ ] **TOOL-29A**: Click on box → delete box
- [ ] **TOOL-29B**: Click on symbol → delete symbol (and all its pins)
- [ ] **TOOL-29C**: Click on line/wire segment → delete just that segment
- [ ] **TOOL-29D**: Click on pin → delete pin from parent symbol
- [ ] **TOOL-29E**: Segment deletion splits line into two separate lines
- [ ] **TOOL-29F**: Deleting end segment shortens the line
- [ ] **TOOL-29G**: Deleting only segment (2-point line) deletes entire line

---

## 5. Object Model

### Object Base Properties

- [x] **OBJ-1**: All objects have unique ID (generated)
- [x] **OBJ-2**: All objects have type identifier string
- [x] **OBJ-3**: All objects have position (x, y in character coordinates)
- [x] **OBJ-4**: All objects serialize to/from JSON
- [x] **OBJ-5**: All objects implement hit testing for selection
- [x] **OBJ-6**: All objects implement rendering to canvas
- [ ] **OBJ-7**: Objects may have arbitrary key-value parameters (metadata)
- [x] **OBJ-8**: Objects may have `derived: true` flag indicating computed/derived state
- [x] **OBJ-9**: Objects may have `selectable: false` flag to exclude from selection

### Text Box Object

- [x] **OBJ-10**: Rectangular box with border and optional text content
- [x] **OBJ-11**: Properties: x, y, width, height (minimum 3x3)
- [x] **OBJ-12**: Border styles: single, double, thick, none
- [x] **OBJ-13**: UTF-8 box-drawing characters: ─ │ ┌ ┐ └ ┘ (single), ═ ║ ╔ ╗ ╚ ╝ (double), █ (thick/solid block)
- [x] **OBJ-14**: Optional drop shadow using ░ character
- [x] **OBJ-15**: Text content with 9-position justification (top/center/bottom + left/center/right)
- [x] **OBJ-16**: Optional fill property for interior whitespace
- [x] **OBJ-17**: Fill characters: none (default), ░ (light), ▒ (medium), ▓ (dark), █ (solid), · (dots)

### Line/Polyline Object

A polyline is an ordered sequence of points connected by orthogonal (horizontal/vertical) segments.

- [ ] **OBJ-30**: Polyline with multiple segments (array of points)
- [ ] **OBJ-31**: Properties: points[], style, startCap, endCap
- [ ] **OBJ-32**: Orthogonal only: horizontal and vertical segments, 90-degree turns
- [ ] **OBJ-33**: Line styles: single (─│), double (═║), thick (█)
- [ ] **OBJ-34**: Corner characters auto-selected based on turn direction (┌┐└┘ etc.)

#### Endpoint Caps (Dropdown Selection)

- [ ] **OBJ-35**: Endpoint styles selectable via dropdown for start and end
- [ ] **OBJ-36**: Cap options: none, arrow (<>^v), triangle (◄►▲▼), diamond (◆), circle (●), square (■), bar (perpendicular line)
- [ ] **OBJ-37**: Cap direction auto-determined from segment direction

#### Line Drawing Interaction

- [ ] **OBJ-38**: Click to add points, right-click or Enter to finish
- [ ] **OBJ-39**: Escape cancels current line, Backspace removes last point
- [ ] **OBJ-3A**: Preview line shown from last point to cursor while drawing

#### Orthogonal Routing with Posture

When drawing lines, the path from the current anchor point to the cursor is always orthogonal. The routing behavior depends on whether the cursor is axis-aligned or diagonal from the anchor.

- [ ] **OBJ-3A1**: **Axis-aligned case**: If cursor is on same X or Y as anchor, show straight line
- [ ] **OBJ-3A2**: **Diagonal case**: If both X and Y differ, insert TWO points to create orthogonal path
- [ ] **OBJ-3A3**: **Posture** determines routing: horizontal-first (H-V) or vertical-first (V-H)
- [ ] **OBJ-3A4**: Example: Anchor (0,0) to cursor (10,10) with H-first → (0,0)→(10,0)→(10,10)
- [ ] **OBJ-3A5**: Example: Anchor (0,0) to cursor (10,10) with V-first → (0,0)→(0,10)→(10,10)
- [ ] **OBJ-3A6**: **Space key** toggles posture while drawing, causing preview to update
- [ ] **OBJ-3A7**: Preview updates in real-time as mouse moves
- [ ] **OBJ-3A8**: On click, add the intermediate point(s); last point becomes new anchor

### Line Selection & Manipulation

Two types of handles appear when a line is selected:

#### Vertex Handles (at each point)
- [ ] **OBJ-3B**: Each vertex shows a draggable handle (accent color)
- [ ] **OBJ-3C**: Dragging an **endpoint** (first or last) moves freely, maintains orthogonality via posture
- [ ] **OBJ-3C2**: Dragging an **intermediate vertex** inserts new points to create L-shapes on both sides, maintaining orthogonal connections

#### Segment Handles (midpoints between vertices)
- [ ] **OBJ-3D**: Each segment shows a draggable handle at its midpoint (different color)
- [ ] **OBJ-3E**: Horizontal segment handle: constrained to vertical movement (up/down only)
- [ ] **OBJ-3F**: Vertical segment handle: constrained to horizontal movement (left/right only)
- [ ] **OBJ-3G**: Dragging segment handle moves both endpoints of that segment by the same delta

### Connector/Sticky Endpoints (Future Extension)

Lines can optionally attach ("stick") to boxes, moving when the box moves.

- [ ] **OBJ-40**: Line endpoints can attach to box edges at connection points
- [ ] **OBJ-41**: When attached box moves, line endpoint follows
- [ ] **OBJ-42**: Connection snaps to nearest valid point on box edge
- [ ] **OBJ-43**: Visual indicator when hovering near attachable point
- [ ] **OBJ-44**: Detach by dragging endpoint away from box

### Junction Object

Junctions mark connection points where two or more lines meet. They are computed automatically from line geometry and serve as the foundation for wire connectivity and netlist generation.

- [x] **OBJ-45**: Junction object with x, y position and connectedLines array
- [x] **OBJ-46**: Auto-create junction when line endpoint clicks on existing line
- [x] **OBJ-47**: Junction style derived from connected line types (● single, ■ double, █ thick)
- [x] **OBJ-48**: Junctions recomputed automatically after any line operation
- [x] **OBJ-49**: Junction stored in file but treated as derived state (recomputable)

### Line Merging

When drawing a new line and clicking on an existing line's start or end vertex, the lines merge into one. This allows extending existing lines after creation.

- [x] **OBJ-4A**: Click on existing line's END vertex → append new points in reverse order
- [x] **OBJ-4B**: Click on existing line's START vertex → prepend new points to existing line
- [x] **OBJ-4C**: Merged line inherits style, startCap, endCap from the existing line
- [x] **OBJ-4D**: Click on mid-segment or intermediate vertex → junction behavior (no merge)

### Line/Wire Code Sharing Note

Lines and Wires (OBJ-60) share core rendering and manipulation code. The key differences:
- **Line**: Pure visual element, no connectivity semantics
- **Wire**: Has net label property, participates in connectivity graph

Implementation should use shared base class or utility functions for:
- Point array management
- Segment rendering (characters, corners)
- Hit testing
- Handle manipulation

### Symbol Object (Pin/Node Box)

Symbols are schematic components with pins for connectivity. They support inline creation without a library editor.

#### Symbol Base Properties

- [~] **OBJ-50**: Box-like container with width, height, position
- [~] **OBJ-51**: Pins array embedded within symbol (move with symbol)
- [~] **OBJ-52**: Quick ad-hoc entry - no library required (PHIL-10)
- [~] **OBJ-53**: Pins can be added/removed inline (PHIL-11)

#### Symbol Box Properties (inherited from TextBox)

- [~] **OBJ-50A**: Border styles: single, double, thick, none (same as box)
- [~] **OBJ-50B**: Optional drop shadow using ░ character
- [~] **OBJ-50C**: Text content with 9-position justification
- [~] **OBJ-50D**: Optional fill property (none, light, medium, dark, solid, dots)

#### Designator (Reference)

- [~] **OBJ-54**: Designator with prefix + number (U1, R1, IC3)
- [~] **OBJ-55**: Auto-increment number per prefix on creation
- [~] **OBJ-56**: Designator offset: relative position to symbol (default: 1 cell above, left-aligned)
- [ ] **OBJ-57**: Designator repositionable - can be moved anywhere relative to symbol
- [~] **OBJ-58**: Designator visible flag (can be hidden)
- [ ] **OBJ-59**: Copy symbol → auto-assigns next available number for prefix
- [ ] **OBJ-5A0**: Designator rendered as ASCII text on canvas (not just in properties panel)

#### Designator/Value Selection & Movement

Designators and parameter values (e.g., "value") are selectable sub-elements of a symbol. When selected, they can be dragged to reposition relative to the parent symbol.

- [ ] **OBJ-5A1**: Designator is click-selectable as a sub-element of symbol
- [ ] **OBJ-5A2**: Value parameter is click-selectable as a sub-element of symbol
- [ ] **OBJ-5A3**: Selected designator/value shows selection highlight
- [ ] **OBJ-5A4**: Dragging designator/value updates its offset (relative to symbol origin)
- [ ] **OBJ-5A5**: Offset stored as { x, y } relative to symbol position
- [ ] **OBJ-5A6**: When designator/value selected, show dashed leader line from symbol to label
- [ ] **OBJ-5A7**: Leader line helps identify parent when label is positioned far from symbol
- [ ] **OBJ-5A8**: Properties panel shows designator/value properties when sub-element selected

#### Parameters (Value, etc.)

- [~] **OBJ-5A**: Parameters array: name, value, offset, visible
- [~] **OBJ-5B**: Common parameters: value (10k, LM358), footprint (SOIC-8)
- [ ] **OBJ-5C**: Parameters repositionable like designator
- [~] **OBJ-5D**: Parameters visible flag (can be hidden)

#### Symbol Data Structure

```javascript
{
  type: 'symbol',
  id: 'sym-abc123',
  x: 10, y: 5,
  width: 8, height: 4,
  designator: {
    prefix: 'U',
    number: 1,
    offset: { x: 0, y: -1 },
    visible: true
  },
  parameters: [
    { name: 'value', value: 'LM358', offset: { x: 0, y: 5 }, visible: true },
    { name: 'footprint', value: 'SOIC-8', offset: { x: 0, y: 6 }, visible: false }
  ],
  pins: [
    { id: 'p1', name: 'IN+', edge: 'left', offset: 0.33, shape: 'circle-outline' },
    { id: 'p2', name: 'OUT', edge: 'right', offset: 0.5, shape: 'circle' }
  ]
}
```

#### Symbol Internal Render Order

Within a single symbol, elements are drawn in a specific order to ensure proper layering. Later elements overwrite earlier ones at the same cell position.

| Order | ID | Element | Description |
|-------|-----|---------|-------------|
| 1 | **SYM-R1** | Border | Box-drawing characters for symbol outline |
| 2 | **SYM-R2** | Fill | Interior fill characters (if any) |
| 3 | **SYM-R3** | Pins | Pin characters on border (overwrite border chars) |
| 4 | **SYM-R4** | Pin Names | Pin name text inside symbol |
| 5 | **SYM-R5** | Internal Text | Symbol text content (center text) |
| 6 | **SYM-R6** | Designator | Reference designator (U1, R1) - can be inside or outside |
| 7 | **SYM-R7** | Parameters | Value and other parameters - can be inside or outside |

- [ ] **SYM-R10**: Designator/value rendered on top of fill when positioned inside symbol
- [ ] **SYM-R11**: Designator/value can be positioned outside symbol bounds
- [ ] **SYM-R12**: Pin names rendered after fill so they're visible on filled symbols

### Pin Object (Child of Symbol)

Pins are single-character markers on symbol edges for wire connectivity. They reuse the same visual vocabulary as line end caps.

- [~] **OBJ-5E**: Pin is child of symbol, stored in symbol's pins array
- [~] **OBJ-5F**: Pin position: edge (left/right/top/bottom) + offset (0-1 along edge)
- [~] **OBJ-5G**: Pin shape: same as line caps (circle, circle-outline, square, square-outline, diamond, diamond-outline, triangle variants)
- [~] **OBJ-5H**: Pin properties: id, name, direction (input/output/bidirectional)
- [~] **OBJ-5I**: Pin world position computed from symbol position + edge + offset
- [~] **OBJ-5J**: Pins snap to character grid positions along edge
- [ ] **OBJ-5J2**: Pins CANNOT be placed on corner cells (corners reserved for box-drawing characters)
- [~] **OBJ-5K**: Pin character drawn ON the symbol border (replaces border char at that position)
- [~] **OBJ-5L**: Pins are selectable and can be repositioned along symbol edges
- [~] **OBJ-5M**: Dragging a pin constrains movement to symbol edges only
- [~] **OBJ-5N**: Pin properties panel with name field when pin is selected
- [~] **OBJ-5O**: Pin name renders toward interior of symbol box
- [~] **OBJ-5P**: Left edge pins: name right-aligned inside, starting after pin
- [~] **OBJ-5Q**: Right edge pins: name left-aligned inside, ending before pin cell
- [~] **OBJ-5R**: Top/bottom edge pins: name centered inside, vertically below/above pin
- [~] **OBJ-5S**: Symbol resize maintains pin positions on edges (pins move with edge)

#### Pin Data Structure

```javascript
{
  id: 'p1',
  name: 'IN+',
  edge: 'left',           // left, right, top, bottom
  offset: 0.33,           // 0-1 along edge length
  shape: 'circle-outline', // same vocabulary as line caps
  direction: 'input'      // input, output, bidirectional
}
```

### Wire Object

Wires are lines with electrical connectivity semantics. They share rendering code with lines but participate in netlist generation.

- [ ] **OBJ-60**: Wire extends line behavior with net metadata
- [ ] **OBJ-61**: Net property: net name (VCC, GND, SDA, CLK, DATA_BUS)
- [ ] **OBJ-62**: Same rendering as Line (shared code)
- [ ] **OBJ-63**: Wires with same net name are logically connected
- [ ] **OBJ-64**: Bus width property for multi-signal buses (default: 1)

#### Wire-to-Pin Binding

Wire endpoints can bind to symbol pins. When a symbol moves, bound wire endpoints move with it.

- [ ] **OBJ-65**: Wire startBinding/endBinding: { symbolId, pinId } or null
- [ ] **OBJ-66**: Binding created when wire endpoint placed on pin (snap/auto-create)
- [ ] **OBJ-67**: Move symbol → bound wire endpoints follow (rubberbanding)
- [ ] **OBJ-68**: Modifier key (Alt) breaks binding during move
- [ ] **OBJ-69**: Drag wire endpoint away from pin → breaks binding

#### Floating Wire Ends (No-Connect / ERC)

Unbound wire endpoints are "floating" and indicate potential ERC errors. Users can extend or join wires at floating ends.

- [ ] **OBJ-6F**: Floating wire end renders as "X" to indicate no-connect/ERC error
- [ ] **OBJ-6G**: Hover over floating end with WireTool → shows "connect" overlay
- [ ] **OBJ-6H**: Start wire FROM floating end → extends existing wire, inherits style/netname
- [ ] **OBJ-6I**: End wire ON floating end → joins wires into one, new wire's style/netname wins
- [ ] **OBJ-6J**: When wires joined, old endpoint optimized out if collinear
- [ ] **OBJ-6K**: Joining wires does NOT create junction (direct merge)

#### Wire Data Structure

```javascript
{
  type: 'wire',
  id: 'wire-abc123',
  points: [{ x: 5, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 15 }],
  style: 'single',
  net: 'SDA',
  busWidth: 1,
  startBinding: { symbolId: 'sym1', pinId: 'p1' },
  endBinding: null
}
```

### Wire Junction Object

Wire junctions are electrical connection points where wires meet. They are derived from geometry like line junctions but carry electrical semantics for netlist generation.

- [ ] **OBJ-6A**: Wire junction: electrical node where wires connect
- [ ] **OBJ-6B**: Auto-created when wire endpoint lands on another wire
- [ ] **OBJ-6C**: Derived state (computed from wire geometry)
- [ ] **OBJ-6D**: Stores connected wire IDs and computed net name
- [ ] **OBJ-6E**: Separate from line junctions (electrical vs visual)

#### Wire Junction Data Structure

```javascript
{
  type: 'wire-junction',
  id: 'wj-abc123',
  x: 10, y: 15,
  connectedWires: ['wire1', 'wire2'],
  net: 'SDA',
  derived: true,
  selectable: false
}
```

### Port Object

- [ ] **OBJ-70**: Represents external/off-page connection
- [ ] **OBJ-71**: Visual: arrow, flag, or connector symbol
- [ ] **OBJ-72**: Has net name for cross-page connectivity
- [ ] **OBJ-73**: Direction: input, output, bidirectional

### Power Symbol Object

- [ ] **OBJ-80**: Small symbol representing power rail/node
- [ ] **OBJ-81**: Has net name (VCC, GND, +5V, +3.3V, VBAT)
- [ ] **OBJ-82**: Single connection point for wires
- [ ] **OBJ-83**: Visual styles: arrow up (▲), ground (┴ or ⏊), circle, custom
- [ ] **OBJ-84**: Implicit global connection (all VCC symbols connected)

### Interface/Bus Object

- [ ] **OBJ-90**: Bundle of related signals (I2C, SPI, parallel bus)
- [ ] **OBJ-91**: Interface definition: name + member signal list
- [ ] **OBJ-92**: Symbols can have interface pins (connects entire bundle)
- [ ] **OBJ-93**: Bus wires styled differently (thicker/double line)
- [ ] **OBJ-94**: Can reference predefined or define ad-hoc interfaces

### Hierarchical Block Object

- [ ] **OBJ-100**: Block representing another page in project
- [ ] **OBJ-101**: Pins auto-derived from referenced page's ports
- [ ] **OBJ-102**: Double-click to descend into sub-page
- [ ] **OBJ-103**: Shows: page name, designator, port-derived pins
- [ ] **OBJ-104**: Sub-page port changes auto-update block pins

---

## 6. Selection & Editing

### Marquee Selection

- [x] **SEL-1**: Left-to-right drag selects objects **fully enclosed**
- [x] **SEL-2**: Right-to-left drag selects objects **intersecting** marquee
- [x] **SEL-3**: Visual distinction: solid rectangle (enclosed), dashed rectangle (intersecting)
- [x] **SEL-4**: Ctrl+drag marquee adds to existing selection

### Single vs Multi-Select

- [x] **SEL-10**: Click object to select (deselects others)
- [x] **SEL-11**: Ctrl+click to add/remove from selection
- [x] **SEL-12**: Click empty space to deselect all
- [x] **SEL-13**: Escape key deselects all and returns to Select tool

### Selection Operations

- [x] **SEL-20**: Single select: move, resize (handles), edit properties, delete
- [x] **SEL-21**: Multi-select: move together, delete, edit common properties
- [x] **SEL-22**: Resize handles shown only for single selection
- [x] **SEL-23**: Delete/Backspace removes selected objects

### Clipboard Operations

- [x] **SEL-40**: Ctrl+C copies selected objects to internal clipboard
- [x] **SEL-41**: Ctrl+V pastes objects from clipboard at offset position
- [x] **SEL-42**: Ctrl+X cuts selected objects (copy + delete)
- [x] **SEL-43**: Paste creates new objects with new IDs
- [x] **SEL-44**: Paste offset: +2 chars right and down from original position
- [x] **SEL-45**: Pasted objects become the new selection
- [x] **SEL-46**: Clipboard persists across page switches within project

### Inline Text Editing

- [x] **SEL-30**: Double-click box opens inline editor for text content
- [x] **SEL-31**: Type-to-edit: with single box selected, typing starts editing with that character
- [x] **SEL-32**: Text rendered on canvas during editing (hidden textarea captures input)
- [x] **SEL-33**: Blinking cursor shown at insertion point
- [x] **SEL-34**: Escape cancels editing, discards changes
- [x] **SEL-35**: Click elsewhere or Tab commits changes
- [x] **SEL-36**: Text changes are undoable

### Multi-Select Property Editing

The Properties Panel supports editing common properties across multiple selected objects. When values differ, visual indicators show the mixed state and provide initialization from the first selected object.

#### Property Value States

- [x] **MSE-1**: Same value across selection: display normally (no indicator)
- [x] **MSE-2**: Different values (mixed): display mixed indicator by type
- [x] **MSE-3**: Mixed fields have `.mixed` CSS class for visual distinction (colored border, italic text)

#### Mixed State Indicators by Type

| Status | ID | Type | Display Format | Example |
|--------|-----|------|----------------|---------|
| [x] | **MSE-10** | Number | Range: `min...max` | `10...25` |
| [x] | **MSE-11** | Text | Placeholder: `...` | `...` |
| [x] | **MSE-12** | Boolean | Indeterminate checkbox | `[■]` |
| [x] | **MSE-13** | Enum (select) | First value + asterisk | `single*` |
| [x] | **MSE-14** | Enum (buttons) | Dashed border on first value's button | — |

#### Initialize from First Object on Focus

When user focuses a mixed field, auto-populate to enable quick editing:

- [x] **MSE-20**: Focus mixed **number** input → populate with **min value**, select all text
- [x] **MSE-21**: Focus mixed **text** input → populate with **first object's value**, select all text
- [x] **MSE-22**: Click mixed **checkbox** → apply clicked state to all objects
- [x] **MSE-23**: Select from mixed **dropdown** → apply selected value to all objects
- [x] **MSE-24**: Click mixed **button grid** → apply clicked value to all objects

#### Data Attributes for Mixed Fields

- [x] **MSE-25**: Number inputs store `data-min-value` and `data-first-value` attributes
- [x] **MSE-26**: Text inputs store `data-first-value` attribute
- [x] **MSE-27**: These attributes enable focus handlers to populate fields

#### Batch Updates

- [x] **MSE-30**: Property change applies to **all selected objects**
- [x] **MSE-31**: Each object creates **separate undo command** (granular undo)
- [x] **MSE-32**: Panel refreshes after batch update to reflect new state

#### Selection Order & Value Computation

- [x] **MSE-40**: First selected = first in selection ID array (order preserved)
- [x] **MSE-41**: `getCommonPropertyValue()` returns `firstValue` from first object
- [x] **MSE-42**: `getCommonPropertyValue()` computes `minValue`/`maxValue` for numbers

#### CSS Classes

- [x] **MSE-45**: `.mixed` class on inputs: colored border, italic placeholder
- [x] **MSE-46**: `.mixed-first` class on justify buttons: dashed border, accent color

#### Supported Properties

- [x] **MSE-50**: Multi-select editable properties:
  - Position: X, Y (numbers) — range indicator, min-value focus
  - Size: Width, Height (numbers) — range indicator, min-value focus
  - Style: Border style (enum/select), Shadow (boolean/checkbox)
  - Content: Justify (enum/buttons), Text (textarea)

#### Architectural Requirements

- [x] **MSE-60**: All object types MUST use `getCommonPropertyValue()` for property detection
- [x] **MSE-61**: All property panels MUST support multi-select editing (arrays of objects)
- [x] **MSE-62**: All property panels MUST use standard helper functions: `inputValue()`, `inputPlaceholder()`, `selectValue()`, `enumPlaceholder()`
- [x] **MSE-63**: All property panels MUST apply `.mixed` CSS class for visual distinction
- [x] **MSE-64**: Object-specific panels (pins, labels, etc.) MUST follow same patterns as core multi-select

---

## 7. User Interface

### Toolbar

- [x] **UI-1**: Tool buttons with icons and keyboard shortcut hints
- [x] **UI-2**: Active tool visually highlighted
- [x] **UI-3**: Undo/Redo buttons with disabled state
- [x] **UI-4**: Grid toggle button
- [x] **UI-5**: Export, Save, Load buttons

### Properties Panel

- [x] **UI-10**: Sidebar panel showing selected object properties
- [x] **UI-11**: "No selection" state when nothing selected
- [x] **UI-12**: Single selection: full property editor for object type
- [x] **UI-13**: Multi-selection: common property editor (MSE-* requirements)
- [x] **UI-14**: Changes apply immediately (no Apply button)

### Page Tabs

- [x] **UI-20**: Tab bar showing all pages in project
- [x] **UI-21**: Click tab to switch pages
- [x] **UI-22**: Add page button (+)
- [x] **UI-23**: Active page tab visually distinguished

### Status Bar

- [x] **UI-30**: Current tool name
- [x] **UI-31**: Cursor position (Col, Row)
- [x] **UI-32**: Selection count
- [x] **UI-33**: Zoom level
- [x] **UI-34**: Current page / total pages
- [x] **UI-35**: History position (undo/redo depth)

### Visual Theme

- [x] **UI-40**: Dark theme with Berkeley Mono font
- [x] **UI-41**: Sharp corners throughout (border-radius: 0)
- [x] **UI-42**: Accent color: #007acc
- [x] **UI-43**: All colors via CSS variables for theming

### Debug Panel

A collapsible panel for development and debugging that shows JSON representations of the document and selection.

- [x] **UI-50**: Debug panel toggle (keyboard shortcut: F12)
- [x] **UI-51**: Show full document JSON (project structure)
- [x] **UI-52**: Show selected object(s) JSON
- [x] **UI-53**: Collapsible/expandable panel, hidden by default
- [x] **UI-54**: Copy to clipboard button for JSON output

### Debug Logging System

Centralized debug logging with UI integration, replacing scattered console.log calls.

- [x] **DBG-1**: debug.js module with centralized logging system
- [x] **DBG-2**: Log levels: info, warn, error, trace with color-coded display
- [x] **DBG-3**: Category support for filtering by module/component
- [x] **DBG-4**: Circular log buffer (500 entries max, oldest discarded)
- [x] **DBG-5**: Debug Log tab in F12 panel showing formatted log entries
- [x] **DBG-6**: Clear Log button to reset log buffer
- [x] **DBG-7**: Global debug mode toggle via checkbox in debug panel
- [x] **DBG-8**: Visual overlay indicator when debug mode is active (red "DEBUG MODE" banner)
- [x] **DBG-9**: Debug logs always accumulate; console.log output only when debug mode enabled
- [x] **DBG-10**: Auto-scroll debug log to show latest entries

---

## 8. Data Model

### Project Structure

- [x] **DATA-1**: Project contains multiple pages
- [x] **DATA-2**: Each page has: id, name, dimensions, objects array
- [~] **DATA-3**: Project has global parameters (key-value)
- [ ] **DATA-4**: Pages can override project parameters

### Object Serialization

- [x] **DATA-10**: All objects serialize to plain JSON
- [x] **DATA-11**: Full metadata: position, size, text, style, connections, pins
- [ ] **DATA-12**: Object parameters (arbitrary key-value) stored with object

### Project Parameters

- [ ] **DATA-20**: Title block fields: name, author, date, revision, company
- [ ] **DATA-21**: Text substitution: `${PARAM_NAME}` in text objects
- [ ] **DATA-22**: Custom metadata: part numbers, URLs, notes

### Multi-Page Support

- [x] **DATA-30**: Navigate between pages via tabs
- [ ] **DATA-31**: Ports/nets link across pages (global net names)
- [ ] **DATA-32**: Grid view mode: see multiple pages side-by-side (future)

### File Operations

- [x] **DATA-40**: Save project as JSON file (Ctrl+S)
- [x] **DATA-41**: Load project from JSON file
- [x] **DATA-42**: Project file stores complete state for editing

### Auto-Save (Recovery)

- [x] **DATA-50**: Auto-save to localStorage on edits (debounced, 2 second delay)
- [x] **DATA-51**: Restore from localStorage on startup if data exists
- [x] **DATA-52**: Clear localStorage after successful manual save

---

## 9. Export

Export is **separate from on-screen rendering**. While on-screen rendering is interactive and real-time, export produces static file output. Both share the same object model but have different requirements.

### Exporter Abstraction

- [ ] **EXP-0A**: IExporter interface for all export formats
- [ ] **EXP-0B**: Exporters are separate from render backends
- [ ] **EXP-0C**: Common export options: page selection, grid, shadows
- [ ] **EXP-0D**: Export via Ctrl+E opens format selection dialog

### ASCII/UTF-8 Export (Primary)

- [x] **EXP-1**: Pure text output (no escape codes)
- [x] **EXP-2**: For embedding in: C comments, READMEs, .md files
- [ ] **EXP-3**: Knockout/reverse text falls back to brackets: `[U1]`
- [ ] **EXP-4**: ASCIIExporter implements IExporter interface

### ANSI Terminal Export

- [ ] **EXP-10**: VT100 escape codes included
- [ ] **EXP-11**: Supports: reverse/knockout, colors
- [ ] **EXP-12**: For terminal display, `cat` output
- [ ] **EXP-13**: ANSIExporter implements IExporter interface

### HTML Export

- [ ] **EXP-20**: Full styling via CSS
- [ ] **EXP-21**: Supports: reverse/knockout, colors, fonts
- [ ] **EXP-22**: Can embed Berkeley Mono font
- [ ] **EXP-23**: HTMLExporter implements IExporter interface

### SVG Export

- [ ] **EXP-30**: Vector graphics output
- [ ] **EXP-31**: Full styling support
- [ ] **EXP-32**: For documentation, high-fidelity output
- [ ] **EXP-33**: SVGExporter implements IExporter interface
- [ ] **EXP-34**: Cell-to-SVG mapping (lines→path, boxes→rect, etc.)

### Netlist Export (Future)

Generate connectivity data from schematic elements (symbols with pins, wires, junctions).

- [ ] **EXP-40**: Export netlist from wires, junctions, and symbol pins
- [ ] **EXP-41**: Support common netlist formats (SPICE, KiCad, custom)
- [ ] **EXP-42**: BOM (Bill of Materials) generation from symbols
- [ ] **EXP-43**: Design rule check: detect unconnected pins, floating nets

---

## 10. Visual Style

### Typography

- [x] **VIS-1**: Berkeley Mono font (embedded .woff2)
- [x] **VIS-2**: Monospace grid for character alignment

### Box Drawing Characters

- [x] **VIS-10**: Single line: ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼
- [x] **VIS-11**: Double line: ═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬
- [x] **VIS-12**: Rounded: ╭ ╮ ╰ ╯
- [x] **VIS-13**: Avoid busy characters: *, #, +, |, -

### Effects

- [x] **VIS-20**: Shadow/stipple: ░ ▒ ▓ characters
- [ ] **VIS-21**: Arrow heads: ◀ ▶ ▲ ▼ ← → ↑ ↓

### Canvas

- [x] **VIS-30**: Dark background (#1a1a1a)
- [x] **VIS-31**: Grid overlay (toggleable)
- [x] **VIS-32**: Selection highlight with accent color

### Render Layers & Precedence

Defines the order in which elements are drawn. Higher layers overwrite lower layers at the same cell position. This ensures predictable visual results when elements overlap.

**Key principle**: Lines/wires are drawn UNDER boxes/symbols. This allows lines to visually connect to symbols without obscuring symbol content.

| Status | ID | Layer | Priority | Elements | Description |
|--------|-----|-------|----------|----------|-------------|
| [x] | **VIS-40** | Grid | 0 | Grid lines | Background grid overlay |
| [ ] | **VIS-41** | Line | 10 | Line segments | Horizontal/vertical line characters |
| [ ] | **VIS-42** | LineCorner | 15 | Line corners | Corner characters at line bends |
| [ ] | **VIS-43** | LineCap | 18 | Line end caps | Arrow/shape at line endpoints |
| [ ] | **VIS-44** | LineJunction | 20 | Line junctions | Visual connection markers on lines |
| [ ] | **VIS-45** | BoxFill | 30 | Box fill | Box interior fill characters |
| [ ] | **VIS-46** | BoxBorder | 35 | Box border | Box edge characters (─│┌┐└┘) |
| [ ] | **VIS-47** | SymbolFill | 40 | Symbol fill | Symbol interior fill characters |
| [ ] | **VIS-48** | SymbolBorder | 45 | Symbol border | Symbol edge characters |
| [ ] | **VIS-49** | Pin | 50 | Symbol pins | Pin characters (overwrite symbol border) |
| [ ] | **VIS-4B** | PinName | 55 | Pin names | Pin name text inside symbol |
| [ ] | **VIS-4C** | Text | 60 | Box text, symbol text | Text content inside objects |
| [ ] | **VIS-4D** | Label | 70 | Designators, parameters, net labels | Annotation text (can be inside or outside) |
| [ ] | **VIS-4E** | WireJunction | 75 | Wire junctions | Electrical connection markers |
| [x] | **VIS-4A** | Overlay | 100 | Tool previews, selection | Interactive overlays |

#### Render Precedence Rules

- [ ] **VIS-50**: Multi-pass rendering: each layer rendered in separate pass
- [ ] **VIS-51**: Higher priority elements clear cell before drawing (overwrite lower)
- [ ] **VIS-52**: Elements at same priority: later in object array wins
- [ ] **VIS-53**: Tool overlays always on top (non-destructive canvas overlay)
- [ ] **VIS-54**: Lines render BEFORE (under) boxes and symbols
- [ ] **VIS-55**: Symbols render on top of lines, allowing clean visual connections

#### Implementation Approach

- [ ] **VIS-60**: `RenderLayer` enum defines layer priorities
- [ ] **VIS-61**: `Renderer.render()` iterates layers in priority order
- [ ] **VIS-62**: Each object type maps to one or more layers
- [ ] **VIS-63**: Cell clearing handled automatically by layer system

---

## 11. Keyboard Shortcuts

| Shortcut | Action | Requirement | Status |
|----------|--------|-------------|--------|
| V | Select tool | TOOL-20 | [x] |
| B | Box tool | TOOL-21 | [x] |
| T | Text tool | TOOL-22 | [x] |
| L | Line tool | TOOL-23 | [x] |
| S | Symbol tool | TOOL-24 | [ ] |
| W | Wire tool | TOOL-25 | [ ] |
| P | Port tool | TOOL-26 | [ ] |
| O | Power tool | TOOL-27 | [ ] |
| I | Pin tool | TOOL-28 | [ ] |
| X | Delete tool | TOOL-29 | [ ] |
| G | Toggle grid | UI-4 | [x] |
| Delete/Backspace | Delete selected | SEL-23 | [x] |
| Escape | Deselect / Select tool | SEL-13 | [x] |
| Ctrl+Z | Undo | ARCH-12 | [x] |
| Ctrl+Y / Ctrl+Shift+Z | Redo | ARCH-12 | [x] |
| Ctrl+S | Save project | DATA-40 | [x] |
| Ctrl+E | Export ASCII | EXP-1 | [x] |
| Ctrl+C | Copy | SEL-40 | [x] |
| Ctrl+V | Paste | SEL-41 | [x] |
| Ctrl+X | Cut | SEL-42 | [x] |

---

## 12. Implementation Progress

### Summary

| Category | Implemented | Total | Progress |
|----------|-------------|-------|----------|
| Philosophy (PHIL) | 8 | 13 | 62% |
| Deployment (DEP) | 4 | 6 | 67% |
| Viewport (VIEW) | 1 | 16 | 6% |
| Render Backend (BACK) | 4 | 12 | 33% |
| Overlay Renderer (OVER) | 12 | 18 | 67% |
| Cell Config (CELL) | 1 | 8 | 13% |
| Tools (TOOL) | 4 | 10 | 40% |
| Objects (OBJ) | 24 | 75 | 32% |
| Selection (SEL) | 27 | 27 | 100% |
| Multi-Select Edit (MSE) | 25 | 25 | 100% |
| User Interface (UI) | 23 | 23 | 100% |
| Data Model (DATA) | 10 | 15 | 67% |
| Export (EXP) | 2 | 20 | 10% |
| Visual (VIS) | 10 | 11 | 91% |
| **Domain Logic (DOM)** | **17** | **17** | **100%** ✅ |

### Priority Track A: Domain Logic Extraction ✅ COMPLETE

Domain modules extracted with 107 unit tests passing.

1. ✅ **DOM-10 to DOM-15** - Wire.js domain module
2. ✅ **DOM-20 to DOM-24** - Symbol.js domain module
3. ✅ **DOM-30 to DOM-33** - Line.js domain module
4. ✅ **Refactor SelectTool.js** - Uses domain modules
5. ✅ **Refactor WireTool.js** - Uses domain modules
6. ✅ **Unit tests** - 107 tests in test/domain/
7. ✅ **Bundled:** Removed all legacy `grid.pixelToChar()` fallbacks

### Priority Track B: Pluggable Architecture (Mostly Complete)

1. ✅ **VIEW-1 to VIEW-4** - IViewport interface and abstraction
2. ✅ **BACK-1 to BACK-4** - IRenderBackend interface (content only)
3. ✅ **OVER-1 to OVER-4** - IOverlayRenderer interface (UI only)
4. 🔄 **Refactor tools** - Remove legacy fallbacks (bundled with Track A)
5. ⏸️ **Migrate overlays** - Move tool `renderOverlay()` to Canvas2DOverlay (deferred - works as-is)
6. **CELL-1 to CELL-5** - Configurable cell dimensions (partial)

### Priority Track C: Three.js Experiment (Partial)

1. ✅ **VIEW-20 to VIEW-28** - ThreeJSViewport implementation
2. ✅ **MapControls integration** - Pan, zoom, shift+right-click rotate
3. ✅ **Camera presets** - Alt+1-5 for top, angle, iso, front, side
4. ❌ **ThreeJSASCIIBackend** - Using texture approach instead

### Priority Track D: Feature Completion

1. **TOOL-24 (SymbolTool)** - Create symbols like boxes with designator/parameters
2. **OBJ-50 to OBJ-5D** - Symbol object model (box properties + designator + parameters)
3. **OBJ-5E to OBJ-5J** - Pin object model (embedded in symbols)
4. **TOOL-28 (PinTool)** - Add pins to symbols
5. **Renderer updates** - Render symbols with pins, designators, parameters

---

## 13. Testing Requirements

### Unit Testing Framework

- [x] **TEST-1**: Jest with jsdom for unit testing
- [x] **TEST-2**: Tests located in `test/` directory with `.test.js` suffix
- [x] **TEST-3**: Run tests with `npm test`

### Test Coverage Requirements

- [x] **TEST-10**: All utility functions must have unit tests
- [x] **TEST-11**: All Command classes must have execute/undo tests
- [x] **TEST-12**: Export rendering functions must have output verification tests
- [ ] **TEST-13**: New logic functions require corresponding unit tests before merge

### Test Categories

| Status | ID | Category | Description |
|--------|-----|----------|-------------|
| [x] | **TEST-20** | utils.test.js | Core utilities: generateId, clamp, deepClone |
| [x] | **TEST-21** | commands.test.js | Command pattern: Create, Delete, Move, Modify |
| [x] | **TEST-22** | export.test.js | ASCII export: box rendering, borders, text, fill |
| [ ] | **TEST-23** | state.test.js | State management and history |
| [ ] | **TEST-24** | tools.test.js | Tool behavior (may need mocking) |

### Test Commands

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode (re-run on changes)
npm test -- --coverage # Generate coverage report
npm test -- export    # Run only export tests
```

### Browser-Based Testing

- [x] **TEST-30**: `test/test-export.html` for interactive browser testing
- [x] **TEST-31**: Visual diff comparison for export output
- [x] **TEST-32**: Character-by-character analysis for debugging

---

## 14. Architecture

### Domain Logic Modules

Domain modules contain business logic that is independent of UI/tool interaction. This enables unit testing and code reuse across tools.

#### Wire Domain Module

| Status | ID | Requirement | Description |
|--------|-----|-------------|-------------|
| [x] | **DOM-10** | `Wire.isFloatingEndpoint()` | Detect if wire endpoint is unbound |
| [x] | **DOM-11** | `Wire.findPinAtPoint()` | Find symbol pin at cell position |
| [x] | **DOM-12** | `Wire.canBindToPin()` | Validate wire-to-pin binding |
| [x] | **DOM-13** | `Wire.getConnectedWires()` | Find wires connected via junctions |
| [x] | **DOM-14** | `Wire.moveEndpointWithSymbol()` | Calculate endpoint position after symbol move |
| [x] | **DOM-15** | `Wire.findFloatingEnds()` | Find all unbound endpoints in document |

#### Symbol Domain Module

| Status | ID | Requirement | Description |
|--------|-----|-------------|-------------|
| [x] | **DOM-20** | `Symbol.getPinWorldPosition()` | Calculate pin position from symbol + edge + offset |
| [x] | **DOM-21** | `Symbol.findSymbolEdge()` | Determine which edge a point is on |
| [x] | **DOM-22** | `Symbol.getNextDesignatorNumber()` | Get next available number for prefix |
| [x] | **DOM-23** | `Symbol.isPinOnEdge()` | Validate pin placement on symbol edge |
| [x] | **DOM-24** | `Symbol.getAllPinPositions()` | Get world positions for all pins on symbol |

#### Line Domain Module

| Status | ID | Requirement | Description |
|--------|-----|-------------|-------------|
| [x] | **DOM-30** | `Line.getSegments()` | Extract segments from polyline |
| [x] | **DOM-31** | `Line.pointOnSegment()` | Test if point lies on segment |
| [x] | **DOM-32** | `Line.findIntersections()` | Find all line crossing points |
| [x] | **DOM-33** | `Line.mergeLines()` | Combine two lines at common endpoint |

#### Domain Architecture Requirements

| Status | ID | Requirement | Description |
|--------|-----|-------------|-------------|
| [x] | **DOM-1** | Domain modules are pure functions | No UI, no canvas, no events |
| [x] | **DOM-2** | Domain modules are unit testable | Full test coverage for logic |
| [x] | **DOM-3** | Tools delegate to domain modules | No duplicate business logic |
| [x] | **DOM-4** | Domain modules in `js/domain/` directory | Clean separation |

### Clean Separation: Tools → State → Derive → Render

The architecture cleanly separates tool interactions from rendering by introducing a derived object computation layer. After any state change, derived objects (junctions, no-connects, etc.) are computed and combined with primary objects to form a render state.

```
┌─────────────────────────────────────────────────────────────────┐
│                         TOOL LAYER                              │
│  SelectTool, WireTool, SymbolTool, etc.                        │
│  - Handle user input (mouse, keyboard)                          │
│  - Modify primary objects via commands                          │
│  - NO rendering logic, NO derived object knowledge              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ executes commands
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PRIMARY STATE                              │
│  page.objects[] - User-authored objects only                    │
│  - box, symbol, line, wire, text                                │
│  - Persisted to file                                            │
│  - Managed by undo/redo                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ triggers (after every state change)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DERIVE PASS                                 │
│  DerivedStateComputer.compute(page.objects) → derivedObjects[]  │
│  Computes:                                                      │
│  - Line junctions (where lines cross/meet)                      │
│  - Wire junctions (electrical connection points)                │
│  - Wire no-connects (floating endpoints)                        │
│  - Future: net labels, bus taps, etc.                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ produces
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RENDER STATE                                │
│  {                                                              │
│    primaryObjects: [...],   // reference to page.objects        │
│    derivedObjects: [...],   // computed junctions, no-connects  │
│    renderList: [...]        // sorted, ready for rendering      │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ fed to
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RENDER LAYER                                │
│  Renderer.render(renderState)                                   │
│  - Iterates renderList in order                                 │
│  - Calls drawObject() for each - NO special cases               │
│  - Backend-agnostic (ASCII, SVG, Canvas)                        │
└─────────────────────────────────────────────────────────────────┘
```

#### Architecture Requirements

- [ ] **ARCH-20**: Tool layer handles user input only, no rendering logic
- [ ] **ARCH-21**: Tools modify primary objects via commands (undo/redo compatible)
- [ ] **ARCH-22**: Primary state contains only user-authored objects
- [ ] **ARCH-23**: Derive pass triggered after every state change
- [ ] **ARCH-24**: Derived objects computed fresh each time (not persisted in memory)
- [ ] **ARCH-25**: Render layer iterates render list without special-case logic
- [ ] **ARCH-26**: All object types (primary and derived) rendered through single code path

### Derived Objects Storage (Hybrid Approach)

- [ ] **ARCH-30**: Runtime: derived objects are ephemeral, computed fresh after every state change
- [ ] **ARCH-31**: Save: include derived objects in file (marked `derived: true`) for debugging/inspection
- [ ] **ARCH-32**: Load: ignore saved derived objects, recompute from primary objects
- [ ] **ARCH-33**: This provides debugging benefits with no runtime impact

### Derived Object Types

| Type | Source | Visual | Description |
|------|--------|--------|-------------|
| `junction` | Lines meeting/crossing | ●, ■, █ | Visual line intersection marker |
| `wire-junction` | Wire endpoint on wire segment | ● (accent) | Electrical connection point |
| `wire-noconnect` | Unbound wire endpoint | X (black) | Floating endpoint / ERC indicator |

#### Floating Wire Ends (No-Connect / ERC)

- [ ] **OBJ-6F**: Floating wire end renders as "X" to indicate no-connect/ERC error
- [ ] **OBJ-6G**: Hover over floating end with WireTool → shows "connect" overlay
- [ ] **OBJ-6H**: Start wire FROM floating end → extends existing wire, inherits style/netname
- [ ] **OBJ-6I**: End wire ON floating end → joins wires into one, new wire's style/netname wins
- [ ] **OBJ-6J**: When wires joined, old endpoint optimized out if collinear
- [ ] **OBJ-6K**: Joining wires does NOT create junction (direct merge)

### Render Order (Z-Index)

Objects rendered in this order (lowest to highest):

| Order | Type | Description |
|-------|------|-------------|
| 10 | Grid | Background grid |
| 20 | line | Visual lines |
| 25 | junction | Line junction markers |
| 30 | wire | Electrical wires |
| 35 | wire-junction | Wire connection points |
| 36 | wire-noconnect | Floating endpoint markers |
| 40 | box | Text boxes |
| 50 | symbol | Schematic symbols (includes pins) |
| 60 | text | Standalone text |
| 70 | labels | Designators, parameters, net labels |
| 100 | overlay | Tool previews, selection |

### DerivedStateComputer

- [ ] **ARCH-40**: `DerivedStateComputer` class in `js/core/DerivedStateComputer.js`
- [ ] **ARCH-41**: Method: `compute(objects)` returns `{ derivedObjects, renderList }`
- [ ] **ARCH-42**: Method: `computeLineJunctions(lines)` → junction objects
- [ ] **ARCH-43**: Method: `computeWireJunctions(wires)` → wire-junction objects
- [ ] **ARCH-44**: Method: `computeWireNoConnects(wires)` → wire-noconnect objects
- [ ] **ARCH-45**: Method: `buildRenderList(primary, derived)` → sorted by render order
- [ ] **ARCH-46**: Integration: derive pass triggered after `execute()`, `undo()`, `redo()`
