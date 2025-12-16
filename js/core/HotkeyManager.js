/**
 * HotkeyManager - Keyboard shortcut management
 * Implements: PHIL-21 (keyboard shortcuts for all common operations)
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

AsciiEditor.core.HotkeyManager = class HotkeyManager {
  constructor() {
    this.bindings = new Map();
    this.contexts = [];
  }

  register(combo, action, context = 'global') {
    const key = `${context}:${combo.toLowerCase()}`;
    this.bindings.set(key, action);
  }

  handleKeyDown(event) {
    const combo = this.eventToCombo(event);

    // Check context-specific first, then global
    for (const ctx of [...this.contexts, 'global']) {
      const key = `${ctx}:${combo}`;
      if (this.bindings.has(key)) {
        event.preventDefault();
        this.bindings.get(key)();
        return true;
      }
    }
    return false;
  }

  eventToCombo(event) {
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');

    let key = event.key.toLowerCase();
    if (key === ' ') key = 'space';
    parts.push(key);

    return parts.join('+');
  }

  pushContext(context) {
    this.contexts.push(context);
  }

  popContext() {
    return this.contexts.pop();
  }
};
