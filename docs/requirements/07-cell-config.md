# Cell Configuration Requirements (`CELL-*`)

Cell dimensions are configurable to support different fonts and rendering styles.

See [ADR 0001: Cell-based engine](../adrs/0001-cell-based-engine.md) and [ADR 0006: Coordinate system](../adrs/0006-coordinate-system.md).

## Cell dimensions

- [ ] **CELL-1**: Cell width and height configurable at runtime
- [ ] **CELL-2**: Default cell dimensions from font metrics (Berkeley Mono: 10x20)
- [ ] **CELL-3**: Square cell support (e.g., Press Start 2P: 8x8)
- [ ] **CELL-4**: Cell aspect ratio affects object proportions
- [ ] **CELL-5**: Grid adapts to cell dimensions

## Font support

- [x] **CELL-10**: Berkeley Mono as primary font (10x20 aspect)
- [ ] **CELL-11**: Press Start 2P as alternative (8x8 square)
- [ ] **CELL-12**: Custom font support with measured cell dimensions
- [ ] **CELL-13**: Font selection in project settings
