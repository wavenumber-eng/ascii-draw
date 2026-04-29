/**
 * InputRouter - Keyboard event dispatcher
 *
 * Implements: ADR 0013 (keyboard input routing)
 *
 * Computes the current input mode and dispatches keydown/keyup events with
 * explicit precedence:
 *
 *   mode == 'form'        → ignored (browser owns the keys)
 *   mode == 'inline-edit' → ignored (the on-canvas inline editor stops
 *                                    propagation itself; defensive bail)
 *   mode == 'canvas':
 *     1. ToolManager.onKeyDown / onKeyUp   (active tool first refusal)
 *     2. HotkeyManager.handleKeyDown        (global hotkeys)
 *     3. Editor reflex                      (Space-hold-for-pan)
 *
 * The router does not import Editor. State it needs comes through the
 * `getEditingState` callback. State it owns (Space hold debounce) is
 * exposed via `isSpaceHeld()`.
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.input = AsciiEditor.input || {};

AsciiEditor.input.InputRouter = class InputRouter {
  /**
   * @param {Object} deps
   * @param {Object} deps.toolManager
   *   Must expose onKeyDown(event) and onKeyUp(event) returning truthy when consumed.
   * @param {Object} deps.hotkeyManager
   *   Must expose handleKeyDown(event) returning truthy when consumed.
   * @param {Function} deps.getEditingState
   *   Returns { editingObjectId, editingLabelSymbolId, editingPinSymbolId }.
   * @param {Function} [deps.onSpaceHoldStart]  Called once when Space first held.
   * @param {Function} [deps.onSpaceHoldEnd]    Called when Space released.
   * @param {Function} [deps.onAfterDispatch]   Called after consume; receives 'tool' | 'hotkey'.
   */
  constructor(deps) {
    this.toolManager = deps.toolManager;
    this.hotkeyManager = deps.hotkeyManager;
    this.getEditingState = deps.getEditingState || (() => ({}));
    this.onSpaceHoldStart = deps.onSpaceHoldStart || (() => {});
    this.onSpaceHoldEnd = deps.onSpaceHoldEnd || (() => {});
    this.onAfterDispatch = deps.onAfterDispatch || (() => {});
    this._spaceHeld = false;
    this._target = null;
    this._boundKeyDown = (e) => this.dispatchKeyDown(e);
    this._boundKeyUp = (e) => this.dispatchKeyUp(e);
  }

  attach(target) {
    if (this._target) this.detach();
    this._target = target || document;
    this._target.addEventListener('keydown', this._boundKeyDown);
    this._target.addEventListener('keyup', this._boundKeyUp);
  }

  detach() {
    if (!this._target) return;
    this._target.removeEventListener('keydown', this._boundKeyDown);
    this._target.removeEventListener('keyup', this._boundKeyUp);
    this._target = null;
  }

  /**
   * 'form' | 'inline-edit' | 'canvas'
   * Derived from current focus + editing flags. Never stored.
   */
  getMode() {
    const ed = this.getEditingState();
    if (ed && (ed.editingObjectId || ed.editingLabelSymbolId || ed.editingPinSymbolId)) {
      return 'inline-edit';
    }
    const el = (typeof document !== 'undefined') ? document.activeElement : null;
    if (el && el !== document.body) {
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
        return 'form';
      }
    }
    return 'canvas';
  }

  isSpaceHeld() {
    return this._spaceHeld;
  }

  dispatchKeyDown(event) {
    if (this.getMode() !== 'canvas') return;

    if (this.toolManager.onKeyDown(event)) {
      this.onAfterDispatch('tool');
      return;
    }
    if (this.hotkeyManager.handleKeyDown(event)) {
      this.onAfterDispatch('hotkey');
      return;
    }
    if (event.code === 'Space' && !this._spaceHeld) {
      this._spaceHeld = true;
      this.onSpaceHoldStart();
      if (typeof event.preventDefault === 'function') event.preventDefault();
    }
  }

  dispatchKeyUp(event) {
    if (this.getMode() !== 'canvas') return;

    if (this.toolManager.onKeyUp && this.toolManager.onKeyUp(event)) {
      this.onAfterDispatch('tool');
      return;
    }
    if (event.code === 'Space' && this._spaceHeld) {
      this._spaceHeld = false;
      this.onSpaceHoldEnd();
    }
  }
};
