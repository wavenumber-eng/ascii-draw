# Visual Style (`VIS-*`)

For the canonical CSS variable list, see [the architecture overview](../adrs/00-overview.md#css-variables-theme).

## Typography

- [x] **VIS-1**: Berkeley Mono font (embedded `.woff2`)
- [x] **VIS-2**: Monospace grid for character alignment

## Box drawing characters

- [x] **VIS-10**: Single line: `─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`
- [x] **VIS-11**: Double line: `═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬`
- [x] **VIS-12**: Rounded: `╭ ╮ ╰ ╯`
- [x] **VIS-13**: Avoid busy characters: `*`, `#`, `+`, `|`, `-`

## Effects

- [x] **VIS-20**: Shadow/stipple: `░ ▒ ▓` characters
- [ ] **VIS-21**: Arrow heads: `◀ ▶ ▲ ▼ ← → ↑ ↓`

## Canvas

- [x] **VIS-30**: Dark background (`#1a1a1a`)
- [x] **VIS-31**: Grid overlay (toggleable)
- [x] **VIS-32**: Selection highlight with accent color

## Render layers & precedence

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
| [ ] | **VIS-46** | BoxBorder | 35 | Box border | Box edge characters (`─│┌┐└┘`) |
| [ ] | **VIS-47** | SymbolFill | 40 | Symbol fill | Symbol interior fill characters |
| [ ] | **VIS-48** | SymbolBorder | 45 | Symbol border | Symbol edge characters |
| [ ] | **VIS-49** | Pin | 50 | Symbol pins | Pin characters (overwrite symbol border) |
| [ ] | **VIS-4B** | PinName | 55 | Pin names | Pin name text inside symbol |
| [ ] | **VIS-4C** | Text | 60 | Box text, symbol text | Text content inside objects |
| [ ] | **VIS-4D** | Label | 70 | Designators, parameters, net labels | Annotation text (can be inside or outside) |
| [ ] | **VIS-4E** | WireJunction | 75 | Wire junctions | Electrical connection markers |
| [x] | **VIS-4A** | Overlay | 100 | Tool previews, selection | Interactive overlays |

### Render precedence rules

- [ ] **VIS-50**: Multi-pass rendering: each layer rendered in separate pass
- [ ] **VIS-51**: Higher priority elements clear cell before drawing (overwrite lower)
- [ ] **VIS-52**: Elements at same priority: later in object array wins
- [ ] **VIS-53**: Tool overlays always on top (non-destructive canvas overlay)
- [ ] **VIS-54**: Lines render BEFORE (under) boxes and symbols
- [ ] **VIS-55**: Symbols render on top of lines, allowing clean visual connections

### Implementation approach

- [ ] **VIS-60**: `RenderLayer` enum defines layer priorities
- [ ] **VIS-61**: `Renderer.render()` iterates layers in priority order
- [ ] **VIS-62**: Each object type maps to one or more layers
- [ ] **VIS-63**: Cell clearing handled automatically by layer system
