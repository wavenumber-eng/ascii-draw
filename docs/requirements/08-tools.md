# Tool Requirements (`TOOL-*`)

See [ADR 0007: Tool framework](../adrs/0007-tool-framework.md). For the master keyboard-shortcut table see [15-keyboard-shortcuts.md](15-keyboard-shortcuts.md).

## Tool catalog

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

## Box/Symbol tool interaction (TOOL-21, TOOL-24)

Two-click creation workflow for rectangular objects (boxes and symbols):

- [x] **TOOL-21A**: First click sets corner 1, tool remains active with preview
- [x] **TOOL-21B**: Second click sets corner 2 and creates the object
- [x] **TOOL-21C**: Escape before second click cancels creation (clears corner 1)
- [x] **TOOL-21D**: Same location for both clicks does not create object (degenerate case)
- [x] **TOOL-21E**: Preview rectangle shown between first click and cursor position
- [x] **TOOL-21F**: Mouse can move freely between clicks (no drag required)

## Pin tool (TOOL-28)

- [~] **TOOL-28A**: Shows pin shape preview at cursor (`●`, `○`, `■`, `□`, etc.)
- [~] **TOOL-28B**: Cycle shape with number keys (like line styles)
- [~] **TOOL-28C**: Hover over symbol edge → shows "PIN" hint indicator
- [~] **TOOL-28D**: Click on symbol edge → creates pin at that position
- [~] **TOOL-28E**: Click elsewhere → no action (pin only valid on symbol edge)
- [ ] **TOOL-28F**: Pins auto-created when wire starts/ends on symbol edge (via WireTool)

## Delete tool (TOOL-29)

Provides granular deletion including line/wire segment deletion that select+Delete cannot do.

- [ ] **TOOL-29A**: Click on box → delete box
- [ ] **TOOL-29B**: Click on symbol → delete symbol (and all its pins)
- [ ] **TOOL-29C**: Click on line/wire segment → delete just that segment
- [ ] **TOOL-29D**: Click on pin → delete pin from parent symbol
- [ ] **TOOL-29E**: Segment deletion splits line into two separate lines
- [ ] **TOOL-29F**: Deleting end segment shortens the line
- [ ] **TOOL-29G**: Deleting only segment (2-point line) deletes entire line
