# Object Model (`OBJ-*`, `SYM-*`)

## Object base properties

- [x] **OBJ-1**: All objects have unique ID (generated)
- [x] **OBJ-2**: All objects have type identifier string
- [x] **OBJ-3**: All objects have position (x, y in character coordinates)
- [x] **OBJ-4**: All objects serialize to/from JSON
- [x] **OBJ-5**: All objects implement hit testing for selection
- [x] **OBJ-6**: All objects implement rendering to canvas
- [ ] **OBJ-7**: Objects may have arbitrary key-value parameters (metadata)
- [x] **OBJ-8**: Objects may have `derived: true` flag indicating computed/derived state
- [x] **OBJ-9**: Objects may have `selectable: false` flag to exclude from selection

## Text box object

- [x] **OBJ-10**: Rectangular box with border and optional text content
- [x] **OBJ-11**: Properties: x, y, width, height (minimum 3x3)
- [x] **OBJ-12**: Border styles: single, double, thick, none
- [x] **OBJ-13**: UTF-8 box-drawing characters: `─ │ ┌ ┐ └ ┘` (single), `═ ║ ╔ ╗ ╚ ╝` (double), `█` (thick/solid block)
- [x] **OBJ-14**: Optional drop shadow using `░` character
- [x] **OBJ-15**: Text content with 9-position justification (top/center/bottom + left/center/right)
- [x] **OBJ-16**: Optional fill property for interior whitespace
- [x] **OBJ-17**: Fill characters: none (default), `░` (light), `▒` (medium), `▓` (dark), `█` (solid), `·` (dots)

## Line / polyline object

A polyline is an ordered sequence of points connected by orthogonal (horizontal/vertical) segments.

- [ ] **OBJ-30**: Polyline with multiple segments (array of points)
- [ ] **OBJ-31**: Properties: points[], style, startCap, endCap
- [ ] **OBJ-32**: Orthogonal only: horizontal and vertical segments, 90-degree turns
- [ ] **OBJ-33**: Line styles: single (`─│`), double (`═║`), thick (`█`)
- [ ] **OBJ-34**: Corner characters auto-selected based on turn direction (`┌┐└┘` etc.)

### Endpoint caps (dropdown selection)

- [ ] **OBJ-35**: Endpoint styles selectable via dropdown for start and end
- [ ] **OBJ-36**: Cap options: none, arrow (`<>^v`), triangle (`◄►▲▼`), diamond (`◆`), circle (`●`), square (`■`), bar (perpendicular line)
- [ ] **OBJ-37**: Cap direction auto-determined from segment direction

### Line drawing interaction

- [ ] **OBJ-38**: Click to add points, right-click or Enter to finish
- [ ] **OBJ-39**: Escape cancels current line, Backspace removes last point
- [ ] **OBJ-3A**: Preview line shown from last point to cursor while drawing

### Orthogonal routing with posture

When drawing lines, the path from the current anchor point to the cursor is always orthogonal. The routing behavior depends on whether the cursor is axis-aligned or diagonal from the anchor.

- [ ] **OBJ-3A1**: **Axis-aligned case**: If cursor is on same X or Y as anchor, show straight line
- [ ] **OBJ-3A2**: **Diagonal case**: If both X and Y differ, insert TWO points to create orthogonal path
- [ ] **OBJ-3A3**: **Posture** determines routing: horizontal-first (H-V) or vertical-first (V-H)
- [ ] **OBJ-3A4**: Example: Anchor (0,0) to cursor (10,10) with H-first → (0,0)→(10,0)→(10,10)
- [ ] **OBJ-3A5**: Example: Anchor (0,0) to cursor (10,10) with V-first → (0,0)→(0,10)→(10,10)
- [ ] **OBJ-3A6**: **Space key** toggles posture while drawing, causing preview to update
- [ ] **OBJ-3A7**: Preview updates in real-time as mouse moves
- [ ] **OBJ-3A8**: On click, add the intermediate point(s); last point becomes new anchor

## Line selection & manipulation

Two types of handles appear when a line is selected:

### Vertex handles (at each point)

- [ ] **OBJ-3B**: Each vertex shows a draggable handle (accent color)
- [ ] **OBJ-3C**: Dragging an **endpoint** (first or last) moves freely, maintains orthogonality via posture
- [ ] **OBJ-3C2**: Dragging an **intermediate vertex** inserts new points to create L-shapes on both sides, maintaining orthogonal connections

### Segment handles (midpoints between vertices)

- [ ] **OBJ-3D**: Each segment shows a draggable handle at its midpoint (different color)
- [ ] **OBJ-3E**: Horizontal segment handle: constrained to vertical movement (up/down only)
- [ ] **OBJ-3F**: Vertical segment handle: constrained to horizontal movement (left/right only)
- [ ] **OBJ-3G**: Dragging segment handle moves both endpoints of that segment by the same delta

## Connector / sticky endpoints (future extension)

Lines can optionally attach ("stick") to boxes, moving when the box moves.

- [ ] **OBJ-40**: Line endpoints can attach to box edges at connection points
- [ ] **OBJ-41**: When attached box moves, line endpoint follows
- [ ] **OBJ-42**: Connection snaps to nearest valid point on box edge
- [ ] **OBJ-43**: Visual indicator when hovering near attachable point
- [ ] **OBJ-44**: Detach by dragging endpoint away from box

## Junction object

Junctions mark connection points where two or more lines meet. They are computed automatically from line geometry and serve as the foundation for wire connectivity and netlist generation.

See [ADR 0010: Derived state](../adrs/0010-derived-state.md).

- [x] **OBJ-45**: Junction object with x, y position and connectedLines array
- [x] **OBJ-46**: Auto-create junction when line endpoint clicks on existing line
- [x] **OBJ-47**: Junction style derived from connected line types (`●` single, `■` double, `█` thick)
- [x] **OBJ-48**: Junctions recomputed automatically after any line operation
- [x] **OBJ-49**: Junction stored in file but treated as derived state (recomputable)

## Line merging

When drawing a new line and clicking on an existing line's start or end vertex, the lines merge into one. This allows extending existing lines after creation.

- [x] **OBJ-4A**: Click on existing line's END vertex → append new points in reverse order
- [x] **OBJ-4B**: Click on existing line's START vertex → prepend new points to existing line
- [x] **OBJ-4C**: Merged line inherits style, startCap, endCap from the existing line
- [x] **OBJ-4D**: Click on mid-segment or intermediate vertex → junction behavior (no merge)

## Line / wire code sharing

Lines and Wires (OBJ-60) share core rendering and manipulation code. The key differences:

- **Line**: Pure visual element, no connectivity semantics
- **Wire**: Has net label property, participates in connectivity graph

Implementation should use shared base class or utility functions for:
- Point array management
- Segment rendering (characters, corners)
- Hit testing
- Handle manipulation

## Symbol object (pin/node box)

Symbols are schematic components with pins for connectivity. They support inline creation without a library editor.

### Symbol base properties

- [~] **OBJ-50**: Box-like container with width, height, position
- [~] **OBJ-51**: Pins array embedded within symbol (move with symbol)
- [~] **OBJ-52**: Quick ad-hoc entry - no library required (`PHIL-10`)
- [~] **OBJ-53**: Pins can be added/removed inline (`PHIL-11`)

### Symbol box properties (inherited from TextBox)

- [~] **OBJ-50A**: Border styles: single, double, thick, none (same as box)
- [~] **OBJ-50B**: Optional drop shadow using `░` character
- [~] **OBJ-50C**: Text content with 9-position justification
- [~] **OBJ-50D**: Optional fill property (none, light, medium, dark, solid, dots)

### Designator (reference)

- [~] **OBJ-54**: Designator with prefix + number (U1, R1, IC3)
- [~] **OBJ-55**: Auto-increment number per prefix on creation
- [~] **OBJ-56**: Designator offset: relative position to symbol (default: 1 cell above, left-aligned)
- [ ] **OBJ-57**: Designator repositionable - can be moved anywhere relative to symbol
- [~] **OBJ-58**: Designator visible flag (can be hidden)
- [ ] **OBJ-59**: Copy symbol → auto-assigns next available number for prefix
- [ ] **OBJ-5A0**: Designator rendered as ASCII text on canvas (not just in properties panel)

### Designator / value selection & movement

Designators and parameter values (e.g., "value") are selectable sub-elements of a symbol. When selected, they can be dragged to reposition relative to the parent symbol.

- [ ] **OBJ-5A1**: Designator is click-selectable as a sub-element of symbol
- [ ] **OBJ-5A2**: Value parameter is click-selectable as a sub-element of symbol
- [ ] **OBJ-5A3**: Selected designator/value shows selection highlight
- [ ] **OBJ-5A4**: Dragging designator/value updates its offset (relative to symbol origin)
- [ ] **OBJ-5A5**: Offset stored as `{ x, y }` relative to symbol position
- [ ] **OBJ-5A6**: When designator/value selected, show dashed leader line from symbol to label
- [ ] **OBJ-5A7**: Leader line helps identify parent when label is positioned far from symbol
- [ ] **OBJ-5A8**: Properties panel shows designator/value properties when sub-element selected

### Parameters (value, etc.)

- [~] **OBJ-5A**: Parameters array: name, value, offset, visible
- [~] **OBJ-5B**: Common parameters: value (10k, LM358), footprint (SOIC-8)
- [ ] **OBJ-5C**: Parameters repositionable like designator
- [~] **OBJ-5D**: Parameters visible flag (can be hidden)

### Symbol data structure

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

### Symbol internal render order (`SYM-R*`)

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

## Pin object (child of symbol)

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

### Pin data structure

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

## Wire object

Wires are lines with electrical connectivity semantics. They share rendering code with lines but participate in netlist generation.

- [ ] **OBJ-60**: Wire extends line behavior with net metadata
- [ ] **OBJ-61**: Net property: net name (VCC, GND, SDA, CLK, DATA_BUS)
- [ ] **OBJ-62**: Same rendering as Line (shared code)
- [ ] **OBJ-63**: Wires with same net name are logically connected
- [ ] **OBJ-64**: Bus width property for multi-signal buses (default: 1)

### Wire-to-pin binding

Wire endpoints can bind to symbol pins. When a symbol moves, bound wire endpoints move with it.

- [ ] **OBJ-65**: Wire `startBinding`/`endBinding`: `{ symbolId, pinId }` or null
- [ ] **OBJ-66**: Binding created when wire endpoint placed on pin (snap/auto-create)
- [ ] **OBJ-67**: Move symbol → bound wire endpoints follow (rubberbanding)
- [ ] **OBJ-68**: Modifier key (Alt) breaks binding during move
- [ ] **OBJ-69**: Drag wire endpoint away from pin → breaks binding

### Floating wire ends (no-connect / ERC)

Unbound wire endpoints are "floating" and indicate potential ERC errors. Users can extend or join wires at floating ends.

- [ ] **OBJ-6F**: Floating wire end renders as "X" to indicate no-connect/ERC error
- [ ] **OBJ-6G**: Hover over floating end with WireTool → shows "connect" overlay
- [ ] **OBJ-6H**: Start wire FROM floating end → extends existing wire, inherits style/netname
- [ ] **OBJ-6I**: End wire ON floating end → joins wires into one, new wire's style/netname wins
- [ ] **OBJ-6J**: When wires joined, old endpoint optimized out if collinear
- [ ] **OBJ-6K**: Joining wires does NOT create junction (direct merge)

### Wire data structure

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

## Wire junction object

Wire junctions are electrical connection points where wires meet. They are derived from geometry like line junctions but carry electrical semantics for netlist generation.

- [ ] **OBJ-6A**: Wire junction: electrical node where wires connect
- [ ] **OBJ-6B**: Auto-created when wire endpoint lands on another wire
- [ ] **OBJ-6C**: Derived state (computed from wire geometry)
- [ ] **OBJ-6D**: Stores connected wire IDs and computed net name
- [ ] **OBJ-6E**: Separate from line junctions (electrical vs visual)

### Wire junction data structure

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

## Port object

- [ ] **OBJ-70**: Represents external/off-page connection
- [ ] **OBJ-71**: Visual: arrow, flag, or connector symbol
- [ ] **OBJ-72**: Has net name for cross-page connectivity
- [ ] **OBJ-73**: Direction: input, output, bidirectional

## Power symbol object

- [ ] **OBJ-80**: Small symbol representing power rail/node
- [ ] **OBJ-81**: Has net name (VCC, GND, +5V, +3.3V, VBAT)
- [ ] **OBJ-82**: Single connection point for wires
- [ ] **OBJ-83**: Visual styles: arrow up (`▲`), ground (`┴` or `⏊`), circle, custom
- [ ] **OBJ-84**: Implicit global connection (all VCC symbols connected)

## Interface / bus object

- [ ] **OBJ-90**: Bundle of related signals (I2C, SPI, parallel bus)
- [ ] **OBJ-91**: Interface definition: name + member signal list
- [ ] **OBJ-92**: Symbols can have interface pins (connects entire bundle)
- [ ] **OBJ-93**: Bus wires styled differently (thicker/double line)
- [ ] **OBJ-94**: Can reference predefined or define ad-hoc interfaces

## Hierarchical block object

- [ ] **OBJ-100**: Block representing another page in project
- [ ] **OBJ-101**: Pins auto-derived from referenced page's ports
- [ ] **OBJ-102**: Double-click to descend into sub-page
- [ ] **OBJ-103**: Shows: page name, designator, port-derived pins
- [ ] **OBJ-104**: Sub-page port changes auto-update block pins
