# Export (`EXP-*`)

Export is **separate from on-screen rendering**. While on-screen rendering is interactive and real-time, export produces static file output. Both share the same object model but have different requirements.

See [ADR 0008: Pluggable rendering](../adrs/0008-pluggable-rendering.md).

## Exporter abstraction

- [ ] **EXP-0A**: IExporter interface for all export formats
- [ ] **EXP-0B**: Exporters are separate from render backends
- [ ] **EXP-0C**: Common export options: page selection, grid, shadows
- [ ] **EXP-0D**: Export via Ctrl+E opens format selection dialog

## ASCII / UTF-8 export (primary)

- [x] **EXP-1**: Pure text output (no escape codes)
- [x] **EXP-2**: For embedding in: C comments, READMEs, `.md` files
- [ ] **EXP-3**: Knockout/reverse text falls back to brackets: `[U1]`
- [ ] **EXP-4**: ASCIIExporter implements IExporter interface

## ANSI terminal export

- [ ] **EXP-10**: VT100 escape codes included
- [ ] **EXP-11**: Supports: reverse/knockout, colors
- [ ] **EXP-12**: For terminal display, `cat` output
- [ ] **EXP-13**: ANSIExporter implements IExporter interface

## HTML export

- [ ] **EXP-20**: Full styling via CSS
- [ ] **EXP-21**: Supports: reverse/knockout, colors, fonts
- [ ] **EXP-22**: Can embed Berkeley Mono font
- [ ] **EXP-23**: HTMLExporter implements IExporter interface

## SVG export

- [ ] **EXP-30**: Vector graphics output
- [ ] **EXP-31**: Full styling support
- [ ] **EXP-32**: For documentation, high-fidelity output
- [ ] **EXP-33**: SVGExporter implements IExporter interface
- [ ] **EXP-34**: Cell-to-SVG mapping (lines→path, boxes→rect, etc.)

## Netlist export (future)

Generate connectivity data from schematic elements (symbols with pins, wires, junctions).

- [ ] **EXP-40**: Export netlist from wires, junctions, and symbol pins
- [ ] **EXP-41**: Support common netlist formats (SPICE, KiCad, custom)
- [ ] **EXP-42**: BOM (Bill of Materials) generation from symbols
- [ ] **EXP-43**: Design rule check: detect unconnected pins, floating nets
