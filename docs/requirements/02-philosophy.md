# Design Philosophy (`PHIL-*`)

## Napkin to netlist

- [x] **PHIL-1**: Support the full spectrum from quick sketch to full schematic
- [x] **PHIL-2**: Start with boxes and arrows (no connectivity required)
- [ ] **PHIL-3**: Add pins/connections later as design matures
- [x] **PHIL-4**: Same tool, same file, progressive refinement

## No library editor

- [ ] **PHIL-10**: Build symbols inline directly on the canvas
- [ ] **PHIL-11**: Add pins to any symbol without leaving the editor
- [ ] **PHIL-12**: No workflow interruption to "create library part first"
- [ ] **PHIL-13**: Eliminate the library creation pain point from Altium/KiCad

## Quick editing

- [x] **PHIL-20**: Snap-to-grid for fast, aligned placement
- [x] **PHIL-21**: Keyboard shortcuts for all common operations
- [x] **PHIL-22**: Type-to-edit: start typing with object selected to edit immediately
- [x] **PHIL-23**: Double-click to edit text content
- [x] **PHIL-24**: Minimize modal dialogs - prefer inline/panel editing

## Dual-purpose usage

- [x] **PHIL-30**: Support pure documentation mode (boxes, text, lines - no connectivity)
- [ ] **PHIL-31**: Support schematic mode (pins, wires, nets - full connectivity)
- [ ] **PHIL-32**: Allow mixing both modes in the same project
