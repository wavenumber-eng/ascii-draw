# ADR 0013: Keyboard Input Routing

**Status:** Accepted

## Context

Keyboard input has multiple legitimate consumers and they kept fighting:

| Consumer | Wants |
|---|---|
| Properties panel form fields | Every printable key (typing) plus Tab / Enter / Arrows |
| On-canvas inline editor (text / labels / pin names) | Every printable key plus Escape (cancel) and Enter (commit) |
| Active tool while drawing | Tab (cycle style), digits (style/shape), **Space (toggle posture / cycle shape)**, Enter (finish), Escape (cancel) |
| Global hotkeys | V/B/L/W/T/S/I/G/3, Ctrl+Z/Y/S/E/C/V/X, Alt+1..5, F12, Escape |
| Editor reflex | Space-hold-for-pan, Delete/Backspace |

The original implementation used a single document-level `keydown` listener with a chain of inline guards in `Editor.handleKeyDown`:

```
1. Space pan hijack          ← unconditional, eats Space first
2. Inline-edit guards        ← redundant (inline editor stops propagation)
3. Form-element guard        ← was last; bypassed by Space
4. HotkeyManager (V, B, …)   ← always wins over the active tool
5. ToolManager.onKeyDown     ← gets only the leftovers
```

Three real bugs fell out of this:
1. Pressing space in any properties-panel text field **activated pan mode and swallowed the space character** — so users couldn't type spaces in names.
2. `LineTool.onKeyDown` and `WireTool.onKeyDown` claim Space to toggle H-V vs V-H posture (`OBJ-3A6`) — but Editor's pan hijack ran first, so this *never worked while drawing*. Dead code in the requirements.
3. `PinTool` claims Space to cycle shape — same as (2), dead.

Diagnosing each bug separately produced one-line patches but didn't address the underlying design. The hand-written precedence and ad-hoc mode checks scattered across one function are structurally bug-prone.

## Decision

Two structural rules:

### 1. Explicit input modes

The dispatcher consults a single function — `getMode()` — that returns one of:

| Mode | Meaning | Routing |
|---|---|---|
| `form` | Focus is in a properties-panel `<input>` / `<textarea>` / `<select>`, or any `contentEditable` element | Editor stays out entirely. Browser owns the keys. |
| `inline-edit` | An on-canvas inline editor is open (text on box, designator, parameter, or pin name) | Defensive — inline editors `stopPropagation` themselves so the document handler shouldn't even see the event. |
| `canvas` | Default. Active tool, no form focused, no inline edit open. | Run the canvas-mode precedence below. |

The mode check is the **first thing** the dispatcher does. Mode is *derived* from current state (focus + editor flags), never stored as a flag.

### 2. Canvas-mode precedence

```
1. Active tool          ← tool gets first refusal
2. Global hotkeys       ← only if tool didn't claim
3. Editor reflexes      ← only if nothing above claimed (Space-hold-for-pan)
```

Tools opt in to a key by **returning `true`** from `onKeyDown` / `onKeyUp`. Returning `false` (or `undefined`) means "didn't claim, fall through."

This lets `LineTool` / `WireTool` claim Space while drawing without breaking the global Space-pan reflex when no tool wants the key. It also lets a tool register temporary single-letter shortcuts in the future (e.g. a future `Letter` tool that needs `b` for "bold") without conflicting with global hotkeys — the tool only claims while it's the active tool.

### 3. Dispatcher lives in a dedicated `InputRouter`

A `js/input/InputRouter.js` class encapsulates:
- The `getMode()` function.
- The `keydown` / `keyup` dispatch with the precedence above.
- The `spaceHeld` debounce state (one-shot on initial press, reset on release).

`Editor` instantiates the router during `init()`, passes it the `toolManager`, `hotkeyManager`, and a small set of callbacks (start/end space hold, post-dispatch render hook). Editor reads `router.isSpaceHeld()` for the space-drag-pan decision in `handleMouseDown`.

The router does NOT own:
- The on-canvas inline editor's keydown handler — that listener stops its own propagation locally.
- Mouse routing — mouse events go directly to `Editor.handleMouseDown` / `MouseMove` / `MouseUp` and dispatch to the active tool. Mouse routing has fewer competing claimants and a much simpler shape; lifting it into the same router would add ceremony without paying for itself.

### 4. What the router intentionally does NOT do

- **No tool-context hotkey registration.** `HotkeyManager.pushContext` / `popContext` exist as dead infrastructure. The "tool claims first" precedence subsumes their purpose: a tool can simply return `true` for the keys it cares about while active, no registration needed. We delete the unused methods rather than build on them.
- **No combo recording / chord support.** Existing single-key + Ctrl/Shift/Alt combos are enough.
- **No event abstraction layer.** Tools still receive raw `KeyboardEvent`. Fine — the `event.key` / `event.code` / `event.ctrlKey` API is already well-known.

## Consequences

**Positive:**
- One place to read to understand keyboard routing. No more "did I forget to add a guard for this new key path?" mistakes.
- Dead tool features (`OBJ-3A6` Space-toggle-posture, PinTool Space-cycle-shape) start working again.
- `Editor.js` shrinks: ~50 lines of input-handling code leaves it for the router.
- Adding a new active-tool key shortcut is a one-line `return true;` in the tool — no config to update.
- Tests can hit the router directly with synthetic mode strings; no DOM needed for routing-logic coverage.

**Negative:**
- The `getMode()` check runs once per keydown/keyup. Negligible (microseconds), but it's a function call not a condition.
- The router needs to read `editingObjectId` / `editingLabelSymbolId` / `editingPinSymbolId` from the editor. Done via a small `getEditingState()` callback so the router doesn't import Editor — minor coupling, easy to test.
- When `Editor.js` is later split into UI modules ([B2 in the audit](../plans/00-status-audit.md)), the router's `getEditingState` callback will need to be updated to wherever those flags live. Acceptable migration cost.

**Neutral:**
- Tool authors must remember that returning `true` is how they claim a key. This is already the convention.
- "Reflex" is a deliberate term — keeping it distinct from "hotkey" so contributors don't confuse Space-hold-for-pan (a continuous physical interaction) with a one-shot hotkey.
