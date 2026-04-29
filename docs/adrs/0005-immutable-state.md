# ADR 0005: Single Immutable State Tree + Subscribers

**Status:** Accepted

## Context

The editor has multiple consumers of application state: the renderer, the properties panel, the page tabs, the status bar, the auto-save logic, the debug panel. We need predictable change propagation and an undo/redo story (see [ADR 0004](0004-command-pattern-undo-redo.md)).

## Decision

A **single immutable state object** is the source of truth. State is updated by replacing the whole tree (via `deepClone` in commands), then notifying subscribers.

### State shape

```javascript
{
  project: {
    meta: { name, version, created, modified },
    settings: { charWidth, charHeight, defaultPageWidth, defaultPageHeight, font, fontSize },
    parameters: { PROJECT_NAME, AUTHOR, COMPANY, REVISION, DATE },
    pages: [
      {
        id: 'page-1',
        name: 'Main',
        width: 120, height: 60,
        parameters: {},
        objects: [...]            // boxes, symbols, lines, wires, text
      }
    ],
    interfaces: [],
    nets: []
  },
  activePageId: 'page-1',
  viewState: { 'page-1': { zoom, panX, panY } },
  selection: { ids: [], handles: null },
  activeTool: 'select',
  toolState: {},
  clipboard: { sourcePageId, objects },
  ui: { sidebarVisible, propertiesPanelVisible, gridVisible, viewMode },
  gridLayout: { columns, pageSpacing, zoom, panX, panY },
  navigationStack: []
}
```

### Update flow

```
User action
   ↓
Tool handler
   ↓
Command (execute returns new state)
   ↓
HistoryManager.execute / .undo / .redo / .updateState
   ↓
notifyListeners(newState)
   ↓
Editor.render() + updateUI() + updateDebugPanel() + scheduleAutoSave()
```

### What's undoable, what isn't

| Goes through Commands (undoable) | Goes through `updateState()` (not undoable) |
|---|---|
| Object creation/deletion/move/modify | Selection (`selection.ids`, `handles`) |
| Page add/remove | Active tool (`activeTool`) |
| Project property edits (when wired) | View state (zoom, pan) |
| | UI flags (`sidebarVisible`, `gridVisible`, etc.) |
| | Active page (`activePageId`) |

### Implementation rules

- **Mutation is forbidden in commands.** Use `AsciiEditor.core.deepClone(state)` first, mutate the clone, return it.
- **Subscribers receive the new state.** They never reach into the manager for older versions.
- **Object identity is preserved within a single state.** Two objects in the same state with the same `id` share the same reference; comparing by `id` is the canonical equality check.
- **State is JSON-serializable.** No functions, no class instances, no `Date` objects (use ISO strings). This allows save/load round-trips.

## Consequences

**Positive:**
- Undo is trivial: pop the last command, call `command.undo(state)`.
- Subscribers (UI panels, renderer) react via the same hook, so multiple views stay in sync without extra wiring.
- Save/load is JSON in/out — no migration logic for class identity.
- Time-travel debugging is feasible (snapshot-based history).

**Negative:**
- `deepClone` on every command is wasteful for large pages. At current sizes (<1000 objects per page) it's fine; structural sharing (Immer) would be the upgrade path if it becomes a problem.
- Subscribers run sequentially on every change. A slow subscriber (e.g., the debug panel rendering full JSON) can degrade typing latency. We mitigate by deferring some updates to `requestAnimationFrame`.
- "Selection is not undoable" is a design choice that occasionally surprises users.
- Auto-save on every state change can over-write localStorage; we debounce by 2 seconds.
