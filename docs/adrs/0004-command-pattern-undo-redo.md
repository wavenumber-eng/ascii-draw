# ADR 0004: Command Pattern for Undo/Redo

**Status:** Accepted

## Context

The editor needs undo/redo across all state-modifying operations: creating objects, deleting, moving, resizing, editing properties, batch updates from multi-select. Continuous interactions like dragging produce many intermediate states; we don't want each pixel of a drag to be its own undo step.

## Decision

Every state mutation goes through a Command object. Commands implement `execute(state)` and `undo(state)`, both returning new state (no in-place mutation — see [ADR 0005](0005-immutable-state.md)). `HistoryManager` maintains undo/redo stacks.

```javascript
class Command {
  execute(state) { return state; }   // Returns new state
  undo(state)    { return state; }   // Returns previous state
  canMerge(other) { return false; }  // Optional: merge with another command
  merge(other)    { return this; }   // Return merged command
}
```

### Concrete commands

| Command | Purpose | Mergeable |
|---|---|---|
| `CreateObjectCommand` | Add a new object to a page | No |
| `DeleteObjectCommand` | Remove an object from a page | No |
| `MoveObjectCommand` | Change `obj.x` / `obj.y` | **Yes** (continuous drag) |
| `ModifyObjectCommand` | Change arbitrary `{...props}` | No |

### History manager

```javascript
class HistoryManager {
  execute(command)    // Run command, push to undo stack (with merge attempt)
  undo()              // Pop undo, push to redo
  redo()              // Pop redo, push to undo
  updateState(fn)     // Non-undoable state change (selection, view, zoom)
  subscribe(listener) // Get notified after state changes
}
```

### Merging

Drag operations produce a stream of `MoveObjectCommand` instances. On `execute()`, the manager checks if the previous command's `canMerge(new)` returns true; if so, it replaces the previous command with `prev.merge(new)`. This keeps a 60Hz drag at one undo step.

`MoveObjectCommand.merge` keeps the original `fromPos` and the latest `toPos`, so undo restores to the position before the drag started.

### Non-undoable changes

Selection changes, view changes (zoom/pan), tool switches, and clipboard updates do **not** go through commands. They use `history.updateState(fn)` which mutates state and notifies listeners but does not push to the undo stack.

### History limit

Default: 100 entries. Configurable via `HistoryManager` constructor.

## Consequences

**Positive:**
- Clean separation between "what changed" and "how to apply/revert it."
- Drag UX feels responsive while staying snapshot-friendly for undo.
- Each command is self-contained — easy to serialize for replay or collaboration features.
- Multi-select edits create one command per object → granular undo (per requirement [MSE-31](../requirements/10-selection-editing.md)).
- Commands are easy to unit-test (`test/commands.test.js`).

**Negative:**
- `canMerge` heuristics are command-specific and easy to get wrong (e.g., merging across object IDs would be a bug).
- Memory: each undo step deep-clones the relevant page, not just the diff. Acceptable at current document sizes.
- Selection is non-undoable by design. Some users expect undo to restore selection state — we don't.
- Compound operations (e.g., "delete object + bound wires") need an explicit composite command, not implicit transaction grouping.
