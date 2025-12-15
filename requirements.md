# ASCII Diagram Editor - Requirements

## Overview

A hybrid tool combining block diagram functionality with lightweight schematic capture capabilities. Primary output is ASCII art using Berkeley Mono font styling, with clean UTF box-drawing characters.

**Inspiration:** `berkley_mono_reference.png` - clean boxes, arrows, shadow effects using extended ASCII/UTF characters.

## Deployment Goals

- Simple, portable deployment
- Ideal: Single standalone HTML/JS file that runs locally
- Alternative: Python script or similar
- No complex web infrastructure required

## Core Objects

### 1. Text Boxes
- Draw boxes with text inside
- Dynamic resizing via corner drag handles
- Text justification options (left, center, right)
- Font control (Berkeley Mono as default)
- Shadow/stipple effect (like reference image)
- Clean UTF box-drawing characters (─ │ ┌ ┐ └ ┘) instead of busy chars (*, #, +)

### 2. Free-Floating Text
- Standalone text objects placeable anywhere on canvas
- For labels, annotations, titles, notes
- Not bound to any box

### 3. Lines / Connectors
- Straight lines (horizontal, vertical)
- Angled/diagonal lines
- Arrow heads (◀ ▶ ▲ ▼ ← → ↑ ↓)
- Box-drawing line characters (─ │ ╱ ╲)

### 4. Sticky Connectors
- Lines/arrows can attach to boxes at connection points
- When box is moved, connected lines automatically reroute
- Smart connector behavior (similar to draw.io)

### 5. Pin/Node Boxes (Schematic Symbol Style)
- Extension of text box OR new object type
- Boxes with definable pins/nodes on edges
- Pin properties:
  - **Name**: Displayed inside the box
  - **Number**: Displayed outside (like IC package pins: 1, 2, 3, A4, B6)
- Optional **Designator** (U1, R1, IC3) - repositionable
- Optional **Value** field
- Quick ad-hoc entry - no library creation required

### 6. Wires
- Essentially lines with optional **net label**
- Labels like: VCC, GND, SDA, CLK, DATA_BUS
- Same underlying implementation as lines, with labeling capability

### 7. Ports
- Represents external/off-page connections
- Indicates connection to something outside the diagram
- Visual: arrow, flag, or connector symbol pointing off-canvas

### 8. Interfaces / Buses (Harnesses)
- Object type representing a bundle of related signals
- Examples: I2C (SDA, SCL), SPI (MOSI, MISO, SCK, CS), parallel data bus
- Interface definition: name + list of member signals
- Symbols can have interface pins (connects entire bundle)
- Bus wires: styled differently (thicker/double line) to show bundle
- Allows abstraction without implementation details
- Can reference predefined interfaces or define ad-hoc

### 9. Hierarchical Blocks (Sheet Symbols)
- A block/symbol that represents another page in the project
- Pins are auto-derived from the referenced page's ports
- Double-click to descend into the sub-page
- Enables hierarchical design (nested pages) vs flat (all pages at same level)
- Block shows: page name, designator, and port-derived pins
- Changes to sub-page ports automatically update the block's pins

### 10. Power Symbols
- Small symbols representing power rails/nodes
- Has a net name (VCC, GND, +5V, +3.3V, VBAT, etc.)
- Single connection point for wires
- Visual styles:
  - Arrow up (▲) for positive supplies
  - Ground symbol (⏊ or ┴) for ground
  - Circle/dot for generic node
  - Custom text label
- Implicit global connection (all VCC symbols are connected)

## Data Model

- All objects represented as classes with JSON serialization
- Full metadata stored: position, size, text, style, connections, pins, etc.
- **Project parameters**: Arbitrary key-value store for:
  - Title block fields (project name, author, date, revision, company)
  - Text substitution variables (use `${PARAM_NAME}` in text objects)
  - Custom metadata (part numbers, URLs, notes)
  - Page-level overrides (each page can override project params)
- **Object parameters**: Any object can have arbitrary key-value attributes:
  - Standard fields: value, manufacturer, part number, datasheet URL
  - Custom fields: any user-defined key-value pairs
  - Display control per field: visible on sheet (yes/no), position offset
  - Enables BOM generation, search, filtering
- **Multi-page support**:
  - Project contains multiple pages
  - Each page has its own objects
  - Pages can have different dimensions
  - Ports/nets link across pages (global net names)
  - **Grid view mode**: Pan/zoom to see multiple pages side-by-side
  - Click page to focus/edit, zoom out to see overview
- Enables:
  - **Save project**: Preserve full state for later editing
  - **Load project**: Reload and continue editing
  - **Multi-sheet schematics**: Navigate between connected pages

## Export Formats

1. **ASCII/UTF-8** (Primary)
   - Pure text output (no escape codes)
   - For embedding in: C code comments, READMEs, .md files, plain text
   - Styling limitations: no reverse/knockout (renderer-dependent)

2. **ANSI Terminal**
   - Includes VT100 escape codes
   - Supports: reverse/knockout text, colors
   - For terminal display, `cat` output

3. **HTML**
   - Full styling via CSS
   - Supports: reverse/knockout, colors, fonts
   - Can embed Berkeley Mono font

4. **SVG**
   - Vector graphics export
   - Full styling support
   - For documentation, high-fidelity output

5. **JSON** (Project file)
   - Full diagram state for save/load
   - Stores styling intent (e.g., `knockout: true` on designators)
   - Export renders appropriately per format

## Styling Notes

- **Knockout/reverse text** (e.g., IC designators): Stored as style flag in data model, rendered only in formats that support it (ANSI, HTML, SVG)
- **Pure ASCII exports**: Fall back to brackets or emphasis (e.g., `[U1]` instead of reverse video)

## Visual Style

- Berkeley Mono font (provided: .ttf and .woff2)
- Clean UTF-8 box-drawing characters:
  - Corners: ┌ ┐ └ ┘
  - Lines: ─ │
  - Connectors: ├ ┤ ┬ ┴ ┼
  - Double lines: ═ ║ ╔ ╗ ╚ ╝ (if needed)
- Shadow/stipple effect using characters like: ░ ▒ ▓ or dot patterns
- Avoid busy characters: *, #, +, |, -

## Dual-Purpose Usage

1. **Documentation Mode**
   - Generic text boxes, text objects, lines
   - No connectivity information
   - Pure visual diagrams for docs

2. **Schematic Mode**
   - Pin/node boxes with connectivity
   - Wires with net labels
   - Ports for external connections
   - Lightweight schematic capture

## Conceptual Model

- **Connectivity graph with ASCII rendering**
- JSON data model captures both structure (connections) and presentation (layout)
- ASCII is the primary visualization, but data model enables:
  - Netlist generation
  - BOM export
  - Power distribution tree views
  - Connectivity queries ("what's connected to X?")
  - Design rule checks (unconnected pins, etc.)
  - Future: export to EDA formats
- Lightweight schematic capture, not full EDA - but the data is there

## Selection Behavior

### Marquee Selection (Rubber Band)
- **Left-to-right drag**: Select objects fully enclosed in box
- **Right-to-left drag**: Select any objects intersecting the box
- Visual distinction: solid vs dashed selection rectangle

### Single vs Multi-Select
- **Single select**: Click on object
- **Multi-select**:
  - Ctrl+click to add/remove from selection
  - Ctrl+drag marquee to add to existing selection
- **Deselect**: Escape key or click empty space

### Operations by Selection Type
- **Single select**: Move, resize (handles), edit properties, delete
- **Multi-select**: Move (all together), delete, align, copy/paste
- Resize handles only shown for single selection

## Design Philosophy

- **Napkin to netlist**: Support the full spectrum
  - Quick sketch (boxes + arrows, no connectivity)
  - Add pins/connections later as design matures
  - Same tool, same file, progressive refinement
- **No library editor**: Build symbols inline
  - Add pins directly to any symbol on the canvas
  - No workflow interruption to "create library part first"
  - Pain point in Altium/KiCad - we eliminate it
- **Connectivity is optional**:
  - Pure documentation diagrams (just visuals)
  - Schematic-style diagrams (full connectivity)
  - Mix both in same project
