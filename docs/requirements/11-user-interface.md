# User Interface (`UI-*`, `DBG-*`)

## Toolbar

- [x] **UI-1**: Tool buttons with icons and keyboard shortcut hints
- [x] **UI-2**: Active tool visually highlighted
- [x] **UI-3**: Undo/Redo buttons with disabled state
- [x] **UI-4**: Grid toggle button
- [x] **UI-5**: Export, Save, Load buttons

## Properties panel

- [x] **UI-10**: Sidebar panel showing selected object properties
- [x] **UI-11**: "No selection" state when nothing selected
- [x] **UI-12**: Single selection: full property editor for object type
- [x] **UI-13**: Multi-selection: common property editor (`MSE-*` requirements)
- [x] **UI-14**: Changes apply immediately (no Apply button)

## Page tabs

- [x] **UI-20**: Tab bar showing all pages in project
- [x] **UI-21**: Click tab to switch pages
- [x] **UI-22**: Add page button (`+`)
- [x] **UI-23**: Active page tab visually distinguished

## Status bar

- [x] **UI-30**: Current tool name
- [x] **UI-31**: Cursor position (Col, Row)
- [x] **UI-32**: Selection count
- [x] **UI-33**: Zoom level
- [x] **UI-34**: Current page / total pages
- [x] **UI-35**: History position (undo/redo depth)

## Visual theme

- [x] **UI-40**: Dark theme with Berkeley Mono font
- [x] **UI-41**: Sharp corners throughout (`border-radius: 0`)
- [x] **UI-42**: Accent color: `#007acc`
- [x] **UI-43**: All colors via CSS variables for theming

## Debug panel

A collapsible panel for development and debugging that shows JSON representations of the document and selection.

- [x] **UI-50**: Debug panel toggle (keyboard shortcut: F12)
- [x] **UI-51**: Show full document JSON (project structure)
- [x] **UI-52**: Show selected object(s) JSON
- [x] **UI-53**: Collapsible/expandable panel, hidden by default
- [x] **UI-54**: Copy to clipboard button for JSON output

## Debug logging system (`DBG-*`)

Centralized debug logging with UI integration, replacing scattered `console.log` calls.

- [x] **DBG-1**: `debug.js` module with centralized logging system
- [x] **DBG-2**: Log levels: info, warn, error, trace with color-coded display
- [x] **DBG-3**: Category support for filtering by module/component
- [x] **DBG-4**: Circular log buffer (500 entries max, oldest discarded)
- [x] **DBG-5**: Debug Log tab in F12 panel showing formatted log entries
- [x] **DBG-6**: Clear Log button to reset log buffer
- [x] **DBG-7**: Global debug mode toggle via checkbox in debug panel
- [x] **DBG-8**: Visual overlay indicator when debug mode is active (red "DEBUG MODE" banner)
- [x] **DBG-9**: Debug logs always accumulate; `console.log` output only when debug mode enabled
- [x] **DBG-10**: Auto-scroll debug log to show latest entries
