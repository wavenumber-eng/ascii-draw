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
| [x] | **TOOL-21** | BoxTool | B | Create text boxes |
| [ ] | **TOOL-22** | TextTool | T | Create free-floating text |
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

### Box Object

- [x] **OBJ-10**: Rectangular box with border and optional text content
- [x] **OBJ-11**: Properties: x, y, width, height (minimum 3x3)
- [x] **OBJ-12**: Border styles: single, double, rounded
- [x] **OBJ-13**: UTF-8 box-drawing characters: ─ │ ┌ ┐ └ ┘ (single), ═ ║ ╔ ╗ ╚ ╝ (double), ╭ ╮ ╰ ╯ (rounded)
- [x] **OBJ-14**: Optional drop shadow using ░ character
- [x] **OBJ-15**: Text content with 9-position justification (top/center/bottom + left/center/right)
- [x] **OBJ-16**: Optional title on border (position: top/bottom + left/center/right)
- [x] **OBJ-17**: Title modes: on border, inside, outside

### Text Object

- [ ] **OBJ-20**: Free-floating text placeable anywhere
- [ ] **OBJ-21**: Properties: x, y, text content
- [ ] **OBJ-22**: For labels, annotations, titles, notes
- [ ] **OBJ-23**: Not bound to any box

### Line Object

- [ ] **OBJ-30**: Straight lines (horizontal, vertical, diagonal)
- [ ] **OBJ-31**: Properties: start point, end point
- [ ] **OBJ-32**: Line characters: ─ │ ╱ ╲
- [ ] **OBJ-33**: Optional arrow heads: ◀ ▶ ▲ ▼ ← → ↑ ↓
- [ ] **OBJ-34**: Arrow position: none, start, end, both

### Connector Object (Sticky Lines)

- [ ] **OBJ-40**: Lines that attach to boxes at connection points
- [ ] **OBJ-41**: Auto-reroute when connected box is moved
- [ ] **OBJ-42**: Smart routing behavior (similar to draw.io)
- [ ] **OBJ-43**: Connection points on box edges

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

### Inline Text Editing

- [x] **SEL-30**: Double-click box opens inline editor for text content
- [x] **SEL-31**: Type-to-edit: with single box selected, typing starts editing with that character
- [x] **SEL-32**: Text rendered on canvas during editing (hidden textarea captures input)
- [x] **SEL-33**: Blinking cursor shown at insertion point
- [x] **SEL-34**: Escape cancels editing, discards changes
- [x] **SEL-35**: Click elsewhere or Tab commits changes
- [x] **SEL-36**: Text changes are undoable

### Multi-Select Property Editing

The Properties Panel supports editing common properties across multiple selected objects.

#### Property Value States

- [x] **MSE-1**: Same value across selection: display normally (no indicator)
- [x] **MSE-2**: Different values (mixed): display mixed indicator by type
- [x] **MSE-3**: Mixed fields have `.mixed` CSS class for visual distinction

#### Mixed State Indicators by Type

- [ ] **MSE-10**: **Numbers** (X, Y, Width, Height): Range format `min...max`
- [x] **MSE-11**: **Text** (Title, Content): Placeholder `...`
- [x] **MSE-12**: **Boolean** (Shadow): Indeterminate checkbox `[■]`
- [ ] **MSE-13**: **Enum/Select** (Style, Position, Mode): First value + asterisk `single*`
- [ ] **MSE-14**: **Enum/Buttons** (Justify): First value with dashed border style

#### Initialize from First Object

- [ ] **MSE-20**: Focus mixed number input: populate with min value, select all
- [ ] **MSE-21**: Focus mixed text input: populate with first value, select all
- [x] **MSE-22**: Click mixed checkbox: apply clicked state to all
- [x] **MSE-23**: Select from mixed dropdown: apply to all
- [x] **MSE-24**: Click mixed button grid: apply to all

#### Batch Updates

- [x] **MSE-30**: Property change applies to **all selected objects**
- [x] **MSE-31**: Each object creates **separate undo command** (granular undo)
- [x] **MSE-32**: Panel refreshes after batch update

#### Selection Order

- [x] **MSE-40**: First selected = first in selection ID array
- [ ] **MSE-41**: Enum mixed state shows first object's value
- [ ] **MSE-42**: Number range computed across all selected

#### Supported Properties

- [x] **MSE-50**: Multi-select editable properties:
  - Position: X, Y (numbers)
  - Size: Width, Height (numbers)
  - Style: Border style (enum), Shadow (boolean)
  - Title: Text (text), Position (enum), Mode (enum)
  - Content: Justify (enum/buttons), Text (text)

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

---

## 12. Implementation Progress

### Summary

| Category | Implemented | Total | Progress |
|----------|-------------|-------|----------|
| Philosophy (PHIL) | 8 | 13 | 62% |
| Deployment (DEP) | 4 | 5 | 80% |
| Tools (TOOL) | 2 | 8 | 25% |
| Objects (OBJ) | 15 | 55 | 27% |
| Selection (SEL) | 20 | 20 | 100% |
| Multi-Select Edit (MSE) | 12 | 18 | 67% |
| User Interface (UI) | 18 | 18 | 100% |
| Data Model (DATA) | 7 | 12 | 58% |
| Export (EXP) | 2 | 12 | 17% |
| Visual (VIS) | 10 | 11 | 91% |

### Next Priority

1. MSE-10, MSE-13, MSE-14, MSE-20, MSE-21 - Enhanced mixed state indicators
2. TOOL-22 (TextTool) - Free-floating text objects
3. TOOL-23 (LineTool) - Lines with arrows
4. Copy/paste support
