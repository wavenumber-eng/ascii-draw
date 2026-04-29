# Input Router Extraction Plan

**Owns:** `js/input/InputRouter.js` (new) and the keyboard handling currently in `Editor.js`.
**ADR:** [0013 — Keyboard Input Routing](../adrs/0013-keyboard-input-routing.md).
**Audit reference:** [Status audit](00-status-audit.md), section B2 (Editor.js is doing too much).

## Goal

Lift keyboard routing out of `Editor.js` into a small dedicated class that:

1. Computes input mode (`form` / `inline-edit` / `canvas`).
2. Dispatches keydown/keyup with explicit precedence (tool → hotkey → editor reflex).
3. Owns the `spaceHeld` debounce and exposes it for `handleMouseDown`'s pan logic.

## Out of scope

- Mouse routing — stays on `Editor` for now (one consumer, no precedence problems).
- The on-canvas inline-editor textarea's own keydown handler — already encapsulated, calls `e.stopPropagation()`. Untouched.
- Splitting the rest of `Editor.js` (B2). Separate work.

## File changes

| File | Change |
|---|---|
| `js/input/InputRouter.js` | **NEW** — class definition with `getMode`, `attach`, `detach`, `dispatchKeyDown`, `dispatchKeyUp`, `isSpaceHeld`. |
| `index.html` | Add `<script src="js/input/InputRouter.js">` in dependency order (after `core/` interfaces, before `Editor.js`). |
| `test/setup.js` | Add `loadScript('../js/input/InputRouter.js')`. Initialize `global.AsciiEditor.input = {}`. |
| `test/InputRouter.test.js` | **NEW** — focused unit tests for mode detection, precedence, space-hold semantics. |
| `js/Editor.js` | Remove `handleKeyDown`, `handleKeyUp`, `_inputMode`, `spaceHeld` field. Instantiate `InputRouter` in `init`. Update `handleMouseDown`'s space-pan check to read `this.inputRouter.isSpaceHeld()`. Remove the `document.addEventListener('keydown'/'keyup')` wiring (router does it). |
| `js/core/HotkeyManager.js` | Remove unused `pushContext` / `popContext` / `contexts` field (per ADR 0013). |
| `docs/adrs/00-overview.md` | Already updated: ADR index + namespace map. |

## InputRouter API (final shape)

```javascript
AsciiEditor.input.InputRouter = class InputRouter {
  /**
   * @param {Object} deps
   * @param {ToolManager} deps.toolManager
   * @param {HotkeyManager} deps.hotkeyManager
   * @param {Function} deps.getEditingState
   *   Returns { editingObjectId, editingLabelSymbolId, editingPinSymbolId }.
   * @param {Function} [deps.onSpaceHoldStart]
   *   Called once when Space is first held. Editor sets cursor='grab'.
   * @param {Function} [deps.onSpaceHoldEnd]
   *   Called when Space is released. Editor restores cursor.
   * @param {Function} [deps.onAfterDispatch]
   *   Called after a key is consumed. Receives 'tool' | 'hotkey'.
   *   Editor uses this to call render() / updateUI().
   */
  constructor(deps);

  /** Attach document-level keydown/keyup listeners. */
  attach(target = document);
  detach();

  /** 'form' | 'inline-edit' | 'canvas'. */
  getMode();

  /** Whether Space is currently being held in canvas mode. */
  isSpaceHeld();

  /** Test seam — dispatch a synthetic event. */
  dispatchKeyDown(event);
  dispatchKeyUp(event);
};
```

The router does NOT take a reference to `Editor`. All editor-side state it needs comes through callbacks. This makes it testable without a full Editor.

## Implementation order

1. **Write the router class.** Keep it ~80 lines. No DOM other than `document.activeElement` lookup in `getMode()`.
2. **Add tests** before wiring into Editor. Verify:
   - `getMode()` returns `form` for `<input>`/`<textarea>`/`<select>`/`contentEditable`.
   - `getMode()` returns `inline-edit` when `editingObjectId` is set.
   - `getMode()` returns `canvas` otherwise.
   - In `canvas` mode, a tool that returns `true` short-circuits hotkeys and reflexes.
   - In `canvas` mode, hotkeys fire only if the tool returned `false`.
   - In `canvas` mode, Space-hold fires `onSpaceHoldStart` once on first press; `onSpaceHoldEnd` on release.
   - In `form` mode, neither tool nor hotkey nor reflex fires.
3. **Wire into Editor.** Remove old handlers and field. Update `handleMouseDown` to query the router for `isSpaceHeld`.
4. **Update `index.html`** script order.
5. **Update `test/setup.js`** to load the new file.
6. **Run all tests.** Existing 335 + new InputRouter tests should all pass.

## Risk & rollback

**Risk: integration breakage.** The router is new code receiving callbacks that touch Editor state. If a callback shape mismatch slips in, a key event silently does nothing.
**Mitigation:** unit tests cover the dispatch logic; manual smoke test in browser covers wiring. Symptoms would be obvious (keys do nothing) and `git revert` of one commit restores prior behavior.

**Risk: the on-canvas inline editor's `stopPropagation` call covers the document path. If we ever add another keydown listener on `window` or a parent, the router might stop seeing those events.**
**Mitigation:** the router attaches to `document` (not `window`), and the inline editor stops propagation at the textarea — events still bubble through the textarea's parents but the document listener is below those in the tree anyway. Document-level attachment is correct.

**Risk: `pushContext` / `popContext` removal in `HotkeyManager` breaks an unseen caller.**
**Mitigation:** searched the tree — zero callers. Safe to delete.

## Acceptance criteria

- [ ] All 335 existing tests still pass.
- [ ] At least 8 new tests covering mode detection + precedence + space-hold.
- [ ] `Editor.js` no longer contains `handleKeyDown`, `handleKeyUp`, `_inputMode`, or `this.spaceHeld =`.
- [ ] `HotkeyManager` has no unused context machinery.
- [ ] In the browser: typing in any properties-panel field works (letters, digits, **spaces**). Tab cycles fields. Enter creates newlines in textareas. Escape blurs.
- [ ] In the browser: with line tool **drawing**, Space toggles posture (H-V ↔ V-H) and does NOT activate pan mode.
- [ ] In the browser: with line tool **idle** (not drawing) and canvas focused, holding Space activates pan mode.
- [ ] In the browser: pin tool active, Space cycles pin shape.
- [ ] In the browser: clicking the canvas with no tool drawing, Ctrl+Z still undoes.
