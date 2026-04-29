/**
 * HotkeyManager - Keyboard shortcut management
 * Implements: PHIL-21 (keyboard shortcuts for all common operations)
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

AsciiEditor.core.HotkeyManager = class HotkeyManager {
  constructor() {
    this.bindings = new Map();
  }

  register(combo, action) {
    this.bindings.set(combo.toLowerCase(), action);
  }

  handleKeyDown(event) {
    const combo = this.eventToCombo(event);
    if (this.bindings.has(combo)) {
      event.preventDefault();
      this.bindings.get(combo)();
      return true;
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
};
