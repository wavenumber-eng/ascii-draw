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

#### BoxTool (B)
- Click and drag to create boxes
- Minimum size 3x3
- Preview shows dimensions while drawing
- Box styles: single, double, rounded (stored, not yet UI-selectable)
- Shadow support (stored, not yet UI-selectable)
- Text alignment: left, center, right (stored, not yet UI-selectable)

### Rendering
- Canvas-based rendering with Berkeley Mono font
- UTF-8 box-drawing characters
- Grid overlay (toggle with G key)
- Shadow rendering with ░ character
- All colors via CSS variables for theming

### File Operations
- Save project as JSON (Ctrl+S)
- Load project from JSON
- Export current page as ASCII text (Ctrl+E)

### UI
- Dark theme with Berkeley Mono font throughout
- Sharp corners (border-radius: 0) everywhere
- Toolbar with tool buttons and keyboard hints
- Page tabs with add button
- Status bar showing: tool, position, selection count, history, page

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
- Text editing (double-click to edit box text)
- Property panel for object attributes
- Object parameters (key-value metadata)
- Project parameters and text substitution
- Interfaces/buses (signal bundles)
- Hierarchical blocks (sheet symbols)
- Grid view mode (see multiple pages)
- ANSI terminal export
- HTML export
- SVG export
- Copy/paste

### UI Improvements Needed
- Box style selector (single/double/rounded)
- Shadow toggle
- Text alignment controls
- Property panel sidebar
- Context menus

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
2. **Text editing**: Double-click boxes to edit text
3. **LineTool**: Horizontal/vertical lines with arrow heads
4. **Property panel**: Edit object properties (style, shadow, text align)
5. **Copy/paste**: Clipboard operations
6. **SymbolTool**: Pin boxes for schematic mode

## Repository

https://github.com/wavenumber-eng/ascii-draw.git
