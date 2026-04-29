# ADR 0007: Tool Base Class + ToolManager + Context

**Status:** Accepted

## Context

The editor has many tools (Select, Box, Line, Wire, Symbol, Text, Pin, future Delete/Port/Power). Each handles user input differently but they share a lifecycle: activation, mouse/keyboard handling, and overlay drawing for previews and feedback. We need a uniform interface and a way to swap the active tool.

## Decision

A `Tool` base class defines the lifecycle. `ToolManager` orchestrates which tool is active and dispatches events. Tools receive a **context** object that hides the rest of the editor from them.

### Tool interface

```javascript
class Tool {
  constructor(name) {
    this.name = name;
    this.cursor = 'default';   // CSS cursor while this tool is active
  }

  activate(context)   {}        // Called when the tool becomes active
  deactivate()        {}        // Called when switching away

  onMouseDown(event, context)   { return false; }   // Return true if event consumed
  onMouseMove(event, context)   { return false; }
  onMouseUp(event, context)     { return false; }
  onKeyDown(event, context)     { return false; }
  onDoubleClick(event, context) { return false; }

  renderOverlay(ctx, context)   {}                  // Draw tool-specific UI
}
```

### ToolManager

```javascript
class ToolManager {
  register(tool)
  setContext(ctx)
  activate(name)            // Switch active tool, calls deactivate/activate
  getActive()

  onMouseDown(event)        // Delegate to active tool
  onMouseMove(event)
  onMouseUp(event)
  onKeyDown(event)
  onDoubleClick(event)
  renderOverlay(ctx)
}
```

### Tool context

Tools never reach into `Editor` directly. They only see what `setContext()` provides:

```javascript
{
  viewport: IViewport,                             // screenToCell, cellToScreen, pan, zoom
  history: HistoryManager,                          // execute, undo, redo, getState, updateState
  startInlineEdit(obj, initialChar),                // For text editing on boxes/symbols
  startLabelEdit(symbol, type, paramIndex, char),   // For designator/parameter editing
  startPinEdit(symbol, pinIds, initialChar),        // For pin name editing
  setTool(name),                                    // Switch active tool

  // Legacy fields kept for backwards compat (slated for removal):
  canvas, grid
}
```

**The viewport is the only coordinate source.** Tools call `context.viewport.screenToCell(x, y)` to convert mouse events to cell positions. They never read `event.offsetX` or use `canvas.getBoundingClientRect()` directly.

### Tool rules

- **One tool active at a time.** ToolManager enforces this.
- **Each tool has a hotkey** registered in `Editor.setupHotkeys()`. The convention is the first letter of the tool name (V, B, L, W, S, T, I, P, O, X).
- **Escape returns to Select.** Wired in `Editor.setupHotkeys()` and triggered by `setTool('select')` after tool-specific cancellation logic runs.
- **`renderOverlay()` draws on the live canvas context.** The legacy pattern is for tools to draw directly to the 2D context (lines, marquees, ghosts). [ADR 0009](0009-content-vs-overlay-separation.md) describes the planned migration to `IOverlayRenderer`, but tools still draw directly today.

## Consequences

**Positive:**
- Adding a new tool is mechanical: subclass `Tool`, register, add a button + hotkey.
- Tools are independent — a bug in `WireTool` cannot affect `SelectTool`.
- The context boundary forces tools to stay decoupled from the rest of the editor; if a tool needs something, it has to be added explicitly.
- Switching tools is one method call (`toolManager.activate('wire')`).

**Negative:**
- `SelectTool` ends up doing a *lot*: marquee selection, multi-select, drag, resize, vertex/segment manipulation, label/pin selection, wire-pin binding feedback. It's currently 2676 lines and is the primary maintenance hot spot. Splitting the responsibilities (e.g., a separate `TransformController`) is on the table.
- The `context` object is loosely typed. Adding a new shared resource means editing `Editor.setupTools()` and threading it through to every tool that needs it.
- The legacy `canvas` and `grid` fields in the context exist only because some tools haven't been fully migrated to the viewport abstraction. They should be removed (see [the implementation plan audit](../plans/00-status-audit.md)).
- Tools drawing directly to the 2D context skips the overlay abstraction, blocking proper Three.js overlay support.
