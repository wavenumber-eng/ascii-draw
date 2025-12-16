# ASCII Diagram Editor - Project Status

## Current State: Foundation Complete

The core architecture and basic tools are implemented. The application runs as a single HTML file with external CSS.

## Completed Features

### Architecture
- **Command Pattern**: Full undo/redo support via HistoryManager
- **Tool Framework**: Extensible tool system with activation/deactivation lifecycle
- **Hotkey Manager**: Keyboard shortcuts with context support
- **CharacterGrid**: Pixel-to-character coordinate transforms
- **State Management**: Immutable state updates with subscriber notifications
- **Multi-page Support**: Create/switch pages, tab bar UI

### Tools Implemented

#### SelectTool (V)
- Click to select objects
- Click empty space to deselect
- Ctrl+click to toggle selection (add/remove)
- Marquee selection:
  - Left-to-right drag: Select fully enclosed objects (solid blue)
  - Right-to-left drag: Select intersecting objects (dashed green)
  - Ctrl+drag to add to existing selection
- Move selected objects (single or multi-select)
- Resize via corner handles (single selection only)
- Delete key removes selected objects
- Double-click to edit box text inline
- Type-to-edit: typing with single selection starts inline editing

#### BoxTool (B)
- Click and drag to create boxes
- Minimum size 3x3
- Preview shows dimensions while drawing
- Box styles: single, double, rounded (selectable via Properties Panel)
- Shadow support (toggle via Properties Panel)
- 9-position text justification (selectable via Properties Panel)
- Title support with position (top/bottom, left/center/right) and mode (border/inside/outside)

### Rendering
- Canvas-based rendering with Berkeley Mono font
- UTF-8 box-drawing characters
- Grid overlay (toggle with G key)
- Shadow rendering with ░ character
- All colors via CSS variables for theming
- Inline text editing with blinking cursor rendered on canvas

### File Operations
- Save project as JSON (Ctrl+S)
- Load project from JSON
- Export current page as ASCII text (Ctrl+E)

### UI
- Dark theme with Berkeley Mono font throughout
- Sharp corners (border-radius: 0) everywhere
- Toolbar with tool buttons and keyboard hints
- Page tabs with add button
- Status bar showing: tool, position, selection count, zoom, history, page

### Properties Panel
- Single selection: Full property editing for selected object
- Multi-selection: Common property editing with mixed value indicators
  - Shows "..." placeholder when values differ across selection
  - Visual styling (border color, italic) for mixed state
  - Checkbox indeterminate state for boolean properties
- Editable properties: position, size, style, shadow, title, title position, title mode, text justify, text
- Per-object undo support for batch operations

## Not Yet Implemented

### Tools (buttons exist, not functional)
- **TextTool (T)**: Free-floating text objects
- **LineTool (L)**: Lines and connectors with arrows
- **SymbolTool (S)**: Pin/node boxes for schematic symbols
- **WireTool (W)**: Lines with net labels
- **PortTool (P)**: External/off-page connections
- **PowerTool (O)**: Power symbols (VCC, GND, etc.)

### Features from Requirements
- Sticky connectors (auto-reroute when boxes move)
- Object parameters (arbitrary key-value metadata)
- Project parameters and text substitution (${PARAM_NAME})
- Interfaces/buses (signal bundles)
- Hierarchical blocks (sheet symbols)
- Grid view mode (see multiple pages side-by-side)
- ANSI terminal export
- HTML export
- SVG export
- Copy/paste

### UI Improvements Needed
- Context menus (right-click)
- Alignment tools for multi-selection

## File Structure

```
ascii_draw/
├── ascii_editor.html    # Main application (HTML + JavaScript)
├── style.css            # External stylesheet with CSS variables
├── BerkeleyMono-Regular.ttf
├── BerkeleyMono-Regular.woff2
├── berkley_mono_reference.png  # Visual reference
├── requirements.md      # Full requirements document
├── PROTOTYPE_PLAN.md    # Architecture and implementation plan
├── claude.md            # Development guidelines
├── .gitignore
└── STATUS.md            # This file
```

## CSS Variables Reference

```css
/* Backgrounds */
--bg-primary: #1e1e1e
--bg-secondary: #252526
--bg-tertiary: #2d2d30
--bg-canvas: #1a1a1a
--bg-grid: #2a2a2a

/* Text */
--text-primary: #cccccc
--text-secondary: #858585
--text-canvas: #cccccc
--text-shadow: #555555

/* Accents */
--accent: #007acc
--accent-secondary: #00cc7a

/* Selection */
--selection-stroke: #007acc
--marquee-enclosed-stroke: #007acc
--marquee-enclosed-fill: rgba(0, 122, 204, 0.1)
--marquee-intersect-stroke: #00cc7a
--marquee-intersect-fill: rgba(0, 204, 122, 0.1)
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select tool |
| B | Box tool |
| T | Text tool |
| L | Line tool |
| S | Symbol tool |
| W | Wire tool |
| P | Port tool |
| O | Power tool |
| G | Toggle grid |
| Delete/Backspace | Delete selected |
| Escape | Deselect / Select tool |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+S | Save project |
| Ctrl+E | Export ASCII |

## Next Steps (Suggested Priority)

1. **TextTool**: Add free-floating text objects
2. **LineTool**: Horizontal/vertical lines with arrow heads
3. **Copy/paste**: Clipboard operations
4. **SymbolTool**: Pin boxes for schematic mode
5. **WireTool**: Lines with net labels
6. **Context menus**: Right-click operations

## Repository

https://github.com/wavenumber-eng/ascii-draw.git
