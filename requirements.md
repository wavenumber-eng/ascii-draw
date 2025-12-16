# ASCII Diagram Editor - Requirements

This document describes the functional requirements (what the product does). For technical architecture (how the code is structured), see `ARCHITECTURE.md`.

---

## 1. Vision & Overview

A hybrid tool combining block diagram functionality with lightweight schematic capture capabilities. Primary output is ASCII art using Berkeley Mono font styling, with clean UTF box-drawing characters.

**Inspiration:** `berkley_mono_reference.png` - clean boxes, arrows, shadow effects using extended ASCII/UTF characters.

**Core Concept:** A connectivity graph with ASCII rendering. The JSON data model captures both structure (connections) and presentation (layout), enabling netlist generation, BOM export, and design rule checks while maintaining a lightweight, visual-first approach.

---

## 2. Design Philosophy

### Napkin to Netlist

- **PHIL-1**: Support the full spectrum from quick sketch to full schematic
- **PHIL-2**: Start with boxes and arrows (no connectivity required)
- **PHIL-3**: Add pins/connections later as design matures
- **PHIL-4**: Same tool, same file, progressive refinement

### No Library Editor

- **PHIL-10**: Build symbols inline directly on the canvas
- **PHIL-11**: Add pins to any symbol without leaving the editor
- **PHIL-12**: No workflow interruption to "create library part first"
- **PHIL-13**: Eliminate the library creation pain point from Altium/KiCad

### Quick Editing

- **PHIL-20**: Snap-to-grid for fast, aligned placement
- **PHIL-21**: Keyboard shortcuts for all common operations
- **PHIL-22**: Type-to-edit: start typing with object selected to edit immediately
- **PHIL-23**: Double-click to edit text content
- **PHIL-24**: Minimize modal dialogs - prefer inline/panel editing

### Dual-Purpose Usage

- **PHIL-30**: Support pure documentation mode (boxes, text, lines - no connectivity)
- **PHIL-31**: Support schematic mode (pins, wires, nets - full connectivity)
- **PHIL-32**: Allow mixing both modes in the same project

---

## 3. Deployment Requirements

- **DEP-1**: Single standalone HTML file that runs locally (primary goal)
- **DEP-2**: No server required - works with `file://` protocol
- **DEP-3**: No external dependencies at runtime (fonts embedded or bundled)
- **DEP-4**: Development may use build tools, but output is single portable file
- **DEP-5**: Alternative deployment as Python script acceptable

---

## 4. Tools

| ID | Tool | Shortcut | Description |
|----|------|----------|-------------|
| **TOOL-20** | SelectTool | V | Select, move, resize objects |
| **TOOL-21** | BoxTool | B | Create text boxes |
| **TOOL-22** | TextTool | T | Create free-floating text |
| **TOOL-23** | LineTool | L | Create lines and connectors |
| **TOOL-24** | SymbolTool | S | Create pin/node boxes (schematic symbols) |
| **TOOL-25** | WireTool | W | Create wires with net labels |
| **TOOL-26** | PortTool | P | Create off-page connection ports |
| **TOOL-27** | PowerTool | O | Create power symbols (VCC, GND) |

---

## 5. Object Model

### Object Base Properties

- **OBJ-1**: All objects have unique ID (generated)
- **OBJ-2**: All objects have type identifier string
- **OBJ-3**: All objects have position (x, y in character coordinates)
- **OBJ-4**: All objects serialize to/from JSON
- **OBJ-5**: All objects implement hit testing for selection
- **OBJ-6**: All objects implement rendering to canvas
- **OBJ-7**: Objects may have arbitrary key-value parameters (metadata)

### Box Object

- **OBJ-10**: Rectangular box with border and optional text content
- **OBJ-11**: Properties: x, y, width, height (minimum 3x3)
- **OBJ-12**: Border styles: single, double, rounded
- **OBJ-13**: UTF-8 box-drawing characters: ─ │ ┌ ┐ └ ┘ (single), ═ ║ ╔ ╗ ╚ ╝ (double), ╭ ╮ ╰ ╯ (rounded)
- **OBJ-14**: Optional drop shadow using ░ character
- **OBJ-15**: Text content with 9-position justification (top/center/bottom + left/center/right)
- **OBJ-16**: Optional title on border (position: top/bottom + left/center/right)
- **OBJ-17**: Title modes: on border, inside, outside

### Text Object

- **OBJ-20**: Free-floating text placeable anywhere
- **OBJ-21**: Properties: x, y, text content
- **OBJ-22**: For labels, annotations, titles, notes
- **OBJ-23**: Not bound to any box

### Line Object

- **OBJ-30**: Straight lines (horizontal, vertical, diagonal)
- **OBJ-31**: Properties: start point, end point
- **OBJ-32**: Line characters: ─ │ ╱ ╲
- **OBJ-33**: Optional arrow heads: ◀ ▶ ▲ ▼ ← → ↑ ↓
- **OBJ-34**: Arrow position: none, start, end, both

### Connector Object (Sticky Lines)

- **OBJ-40**: Lines that attach to boxes at connection points
- **OBJ-41**: Auto-reroute when connected box is moved
- **OBJ-42**: Smart routing behavior (similar to draw.io)
- **OBJ-43**: Connection points on box edges

### Symbol Object (Pin/Node Box)

- **OBJ-50**: Box with definable pins/nodes on edges
- **OBJ-51**: Pin properties: name (inside), number (outside)
- **OBJ-52**: Optional designator (U1, R1, IC3) - repositionable
- **OBJ-53**: Optional value field
- **OBJ-54**: Quick ad-hoc entry - no library required (PHIL-10)
- **OBJ-55**: Pins can be added/removed inline (PHIL-11)

### Wire Object

- **OBJ-60**: Line with optional net label
- **OBJ-61**: Net labels: VCC, GND, SDA, CLK, DATA_BUS, etc.
- **OBJ-62**: Same rendering as Line, with label capability
- **OBJ-63**: Wires with same net label are logically connected

### Port Object

- **OBJ-70**: Represents external/off-page connection
- **OBJ-71**: Visual: arrow, flag, or connector symbol
- **OBJ-72**: Has net name for cross-page connectivity
- **OBJ-73**: Direction: input, output, bidirectional

### Power Symbol Object

- **OBJ-80**: Small symbol representing power rail/node
- **OBJ-81**: Has net name (VCC, GND, +5V, +3.3V, VBAT)
- **OBJ-82**: Single connection point for wires
- **OBJ-83**: Visual styles: arrow up (▲), ground (┴ or ⏊), circle, custom
- **OBJ-84**: Implicit global connection (all VCC symbols connected)

### Interface/Bus Object

- **OBJ-90**: Bundle of related signals (I2C, SPI, parallel bus)
- **OBJ-91**: Interface definition: name + member signal list
- **OBJ-92**: Symbols can have interface pins (connects entire bundle)
- **OBJ-93**: Bus wires styled differently (thicker/double line)
- **OBJ-94**: Can reference predefined or define ad-hoc interfaces

### Hierarchical Block Object

- **OBJ-100**: Block representing another page in project
- **OBJ-101**: Pins auto-derived from referenced page's ports
- **OBJ-102**: Double-click to descend into sub-page
- **OBJ-103**: Shows: page name, designator, port-derived pins
- **OBJ-104**: Sub-page port changes auto-update block pins

---

## 6. Selection & Editing

### Marquee Selection

- **SEL-1**: Left-to-right drag selects objects **fully enclosed**
- **SEL-2**: Right-to-left drag selects objects **intersecting** marquee
- **SEL-3**: Visual distinction: solid rectangle (enclosed), dashed rectangle (intersecting)
- **SEL-4**: Ctrl+drag marquee adds to existing selection

### Single vs Multi-Select

- **SEL-10**: Click object to select (deselects others)
- **SEL-11**: Ctrl+click to add/remove from selection
- **SEL-12**: Click empty space to deselect all
- **SEL-13**: Escape key deselects all and returns to Select tool

### Selection Operations

- **SEL-20**: Single select: move, resize (handles), edit properties, delete
- **SEL-21**: Multi-select: move together, delete, align, copy/paste
- **SEL-22**: Resize handles shown only for single selection
- **SEL-23**: Delete/Backspace removes selected objects

### Inline Text Editing

- **SEL-30**: Double-click box opens inline editor for text content
- **SEL-31**: Type-to-edit: with single box selected, typing starts editing with that character
- **SEL-32**: Text rendered on canvas during editing (hidden textarea captures input)
- **SEL-33**: Blinking cursor shown at insertion point
- **SEL-34**: Escape cancels editing, discards changes
- **SEL-35**: Click elsewhere or Tab commits changes
- **SEL-36**: Text changes are undoable

### Multi-Select Property Editing

The Properties Panel supports editing common properties across multiple selected objects.

#### Property Value States

- **MSE-1**: Same value across selection: display normally (no indicator)
- **MSE-2**: Different values (mixed): display mixed indicator by type
- **MSE-3**: Mixed fields have `.mixed` CSS class for visual distinction

#### Mixed State Indicators by Type

- **MSE-10**: **Numbers** (X, Y, Width, Height): Range format `min...max`
- **MSE-11**: **Text** (Title, Content): Placeholder `...`
- **MSE-12**: **Boolean** (Shadow): Indeterminate checkbox `[■]`
- **MSE-13**: **Enum/Select** (Style, Position, Mode): First value + asterisk `single*`
- **MSE-14**: **Enum/Buttons** (Justify): First value with dashed border style

#### Initialize from First Object

- **MSE-20**: Focus mixed number input: populate with min value, select all
- **MSE-21**: Focus mixed text input: populate with first value, select all
- **MSE-22**: Click mixed checkbox: apply clicked state to all
- **MSE-23**: Select from mixed dropdown: apply to all
- **MSE-24**: Click mixed button grid: apply to all

#### Batch Updates

- **MSE-30**: Property change applies to **all selected objects**
- **MSE-31**: Each object creates **separate undo command** (granular undo)
- **MSE-32**: Panel refreshes after batch update

#### Selection Order

- **MSE-40**: First selected = first in selection ID array
- **MSE-41**: Enum mixed state shows first object's value
- **MSE-42**: Number range computed across all selected

#### Supported Properties

- **MSE-50**: Multi-select editable properties:
  - Position: X, Y (numbers)
  - Size: Width, Height (numbers)
  - Style: Border style (enum), Shadow (boolean)
  - Title: Text (text), Position (enum), Mode (enum)
  - Content: Justify (enum/buttons), Text (text)

---

## 7. User Interface

### Toolbar

- **UI-1**: Tool buttons with icons and keyboard shortcut hints
- **UI-2**: Active tool visually highlighted
- **UI-3**: Undo/Redo buttons with disabled state
- **UI-4**: Grid toggle button
- **UI-5**: Export, Save, Load buttons

### Properties Panel

- **UI-10**: Sidebar panel showing selected object properties
- **UI-11**: "No selection" state when nothing selected
- **UI-12**: Single selection: full property editor for object type
- **UI-13**: Multi-selection: common property editor (MSE-* requirements)
- **UI-14**: Changes apply immediately (no Apply button)

### Page Tabs

- **UI-20**: Tab bar showing all pages in project
- **UI-21**: Click tab to switch pages
- **UI-22**: Add page button (+)
- **UI-23**: Active page tab visually distinguished

### Status Bar

- **UI-30**: Current tool name
- **UI-31**: Cursor position (Col, Row)
- **UI-32**: Selection count
- **UI-33**: Zoom level
- **UI-34**: Current page / total pages
- **UI-35**: History position (undo/redo depth)

### Visual Theme

- **UI-40**: Dark theme with Berkeley Mono font
- **UI-41**: Sharp corners throughout (border-radius: 0)
- **UI-42**: Accent color: #007acc
- **UI-43**: All colors via CSS variables for theming

---

## 8. Data Model

### Project Structure

- **DATA-1**: Project contains multiple pages
- **DATA-2**: Each page has: id, name, dimensions, objects array
- **DATA-3**: Project has global parameters (key-value)
- **DATA-4**: Pages can override project parameters

### Object Serialization

- **DATA-10**: All objects serialize to plain JSON
- **DATA-11**: Full metadata: position, size, text, style, connections, pins
- **DATA-12**: Object parameters (arbitrary key-value) stored with object

### Project Parameters

- **DATA-20**: Title block fields: name, author, date, revision, company
- **DATA-21**: Text substitution: `${PARAM_NAME}` in text objects
- **DATA-22**: Custom metadata: part numbers, URLs, notes

### Multi-Page Support

- **DATA-30**: Navigate between pages via tabs
- **DATA-31**: Ports/nets link across pages (global net names)
- **DATA-32**: Grid view mode: see multiple pages side-by-side (future)

### File Operations

- **DATA-40**: Save project as JSON file (Ctrl+S)
- **DATA-41**: Load project from JSON file
- **DATA-42**: Project file stores complete state for editing

---

## 9. Export

### ASCII/UTF-8 Export (Primary)

- **EXP-1**: Pure text output (no escape codes)
- **EXP-2**: For embedding in: C comments, READMEs, .md files
- **EXP-3**: Knockout/reverse text falls back to brackets: `[U1]`

### ANSI Terminal Export

- **EXP-10**: VT100 escape codes included
- **EXP-11**: Supports: reverse/knockout, colors
- **EXP-12**: For terminal display, `cat` output

### HTML Export

- **EXP-20**: Full styling via CSS
- **EXP-21**: Supports: reverse/knockout, colors, fonts
- **EXP-22**: Can embed Berkeley Mono font

### SVG Export

- **EXP-30**: Vector graphics output
- **EXP-31**: Full styling support
- **EXP-32**: For documentation, high-fidelity output

---

## 10. Visual Style

### Typography

- **VIS-1**: Berkeley Mono font (embedded .woff2)
- **VIS-2**: Monospace grid for character alignment

### Box Drawing Characters

- **VIS-10**: Single line: ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼
- **VIS-11**: Double line: ═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬
- **VIS-12**: Rounded: ╭ ╮ ╰ ╯
- **VIS-13**: Avoid busy characters: *, #, +, |, -

### Effects

- **VIS-20**: Shadow/stipple: ░ ▒ ▓ characters
- **VIS-21**: Arrow heads: ◀ ▶ ▲ ▼ ← → ↑ ↓

### Canvas

- **VIS-30**: Dark background (#1a1a1a)
- **VIS-31**: Grid overlay (toggleable)
- **VIS-32**: Selection highlight with accent color

---

## 11. Keyboard Shortcuts

| Shortcut | Action | Requirement |
|----------|--------|-------------|
| V | Select tool | TOOL-20 |
| B | Box tool | TOOL-21 |
| T | Text tool | TOOL-22 |
| L | Line tool | TOOL-23 |
| S | Symbol tool | TOOL-24 |
| W | Wire tool | TOOL-25 |
| P | Port tool | TOOL-26 |
| O | Power tool | TOOL-27 |
| G | Toggle grid | UI-4 |
| Delete/Backspace | Delete selected | SEL-23 |
| Escape | Deselect / Select tool | SEL-13 |
| Ctrl+Z | Undo | ARCH-12 |
| Ctrl+Y / Ctrl+Shift+Z | Redo | ARCH-12 |
| Ctrl+S | Save project | DATA-40 |
| Ctrl+E | Export ASCII | EXP-1 |
