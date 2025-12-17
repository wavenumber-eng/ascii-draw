# ASCII Diagram Editor - Requirements

This document describes the functional requirements (what the product does). For technical architecture (how the code is structured), see `ARCHITECTURE.md`.

**Legend:** `[x]` = Implemented, `[ ]` = Not implemented, `[~]` = Partial

---

## 1. Vision & Overview

A hybrid tool combining block diagram functionality with lightweight schematic capture capabilities. Primary output is ASCII art using Berkeley Mono font styling, with clean UTF box-drawing characters.

**Inspiration:** `berkley_mono_reference.png` - clean boxes, arrows, shadow effects using extended ASCII/UTF characters.

**Core Concept:** A connectivity graph with ASCII rendering. The JSON data model captures both structure (connections) and presentation (layout), enabling netlist generation, BOM export, and design rule checks while maintaining a lightweight, visual-first approach.

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

---

## 4. Tools

| Status | ID | Tool | Shortcut | Description |
|--------|-----|------|----------|-------------|
| [x] | **TOOL-20** | SelectTool | V | Select, move, resize objects |
| [x] | **TOOL-21** | TextBoxTool | B | Create text box with border (default: single) |
| [ ] | **TOOL-22** | TextBoxTool | T | Create text box without border (style: none) |
| [ ] | **TOOL-23** | LineTool | L | Create lines and connectors |
| [ ] | **TOOL-24** | SymbolTool | S | Create pin/node boxes (schematic symbols) |
| [ ] | **TOOL-25** | WireTool | W | Create wires with net labels |
| [ ] | **TOOL-26** | PortTool | P | Create off-page connection ports |
| [ ] | **TOOL-27** | PowerTool | O | Create power symbols (VCC, GND) |

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

- [ ] **OBJ-3B**: Each point becomes a draggable handle when selected
- [ ] **OBJ-3C**: Dragging a point moves that vertex, connected segments adjust
- [ ] **OBJ-3D**: Dragging a segment (not a point) moves both endpoints of that segment
- [ ] **OBJ-3E**: For horizontal segment drag: both points move same Y delta
- [ ] **OBJ-3F**: For vertical segment drag: both points move same X delta
- [ ] **OBJ-3G**: Adjacent segments stretch to maintain connections

### Connector/Sticky Endpoints (Future Extension)

Lines can optionally attach ("stick") to boxes, moving when the box moves.

- [ ] **OBJ-40**: Line endpoints can attach to box edges at connection points
- [ ] **OBJ-41**: When attached box moves, line endpoint follows
- [ ] **OBJ-42**: Connection snaps to nearest valid point on box edge
- [ ] **OBJ-43**: Visual indicator when hovering near attachable point
- [ ] **OBJ-44**: Detach by dragging endpoint away from box

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

- [ ] **OBJ-50**: Box with definable pins/nodes on edges
- [ ] **OBJ-51**: Pin properties: name (inside), number (outside)
- [ ] **OBJ-52**: Optional designator (U1, R1, IC3) - repositionable
- [ ] **OBJ-53**: Optional value field
- [ ] **OBJ-54**: Quick ad-hoc entry - no library required (PHIL-10)
- [ ] **OBJ-55**: Pins can be added/removed inline (PHIL-11)

### Wire Object

- [ ] **OBJ-60**: Line with optional net label
- [ ] **OBJ-61**: Net labels: VCC, GND, SDA, CLK, DATA_BUS, etc.
- [ ] **OBJ-62**: Same rendering as Line, with label capability
- [ ] **OBJ-63**: Wires with same net label are logically connected

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

### ASCII/UTF-8 Export (Primary)

- [x] **EXP-1**: Pure text output (no escape codes)
- [x] **EXP-2**: For embedding in: C comments, READMEs, .md files
- [ ] **EXP-3**: Knockout/reverse text falls back to brackets: `[U1]`

### ANSI Terminal Export

- [ ] **EXP-10**: VT100 escape codes included
- [ ] **EXP-11**: Supports: reverse/knockout, colors
- [ ] **EXP-12**: For terminal display, `cat` output

### HTML Export

- [ ] **EXP-20**: Full styling via CSS
- [ ] **EXP-21**: Supports: reverse/knockout, colors, fonts
- [ ] **EXP-22**: Can embed Berkeley Mono font

### SVG Export

- [ ] **EXP-30**: Vector graphics output
- [ ] **EXP-31**: Full styling support
- [ ] **EXP-32**: For documentation, high-fidelity output

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

---

## 11. Keyboard Shortcuts

| Shortcut | Action | Requirement | Status |
|----------|--------|-------------|--------|
| V | Select tool | TOOL-20 | [x] |
| B | Box tool | TOOL-21 | [x] |
| T | Text tool | TOOL-22 | [ ] |
| L | Line tool | TOOL-23 | [ ] |
| S | Symbol tool | TOOL-24 | [ ] |
| W | Wire tool | TOOL-25 | [ ] |
| P | Port tool | TOOL-26 | [ ] |
| O | Power tool | TOOL-27 | [ ] |
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
| Deployment (DEP) | 4 | 5 | 80% |
| Tools (TOOL) | 2 | 8 | 25% |
| Objects (OBJ) | 15 | 51 | 29% |
| Selection (SEL) | 27 | 27 | 100% |
| Multi-Select Edit (MSE) | 25 | 25 | 100% |
| User Interface (UI) | 18 | 18 | 100% |
| Data Model (DATA) | 10 | 15 | 67% |
| Export (EXP) | 2 | 12 | 17% |
| Visual (VIS) | 10 | 11 | 91% |

### Next Priority

1. TOOL-22 - Text box without border (T shortcut, style: none)
2. TOOL-23 (LineTool) - Lines with arrows
3. TOOL-24 (SymbolTool) - Pin/node boxes for schematic symbols

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
