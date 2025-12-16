/**
 * Tool - Base class for all tools
 * Implements: TOOL-1 to TOOL-6
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

AsciiEditor.tools.Tool = class Tool {
  constructor(name) {
    this.name = name;
    this.cursor = 'default';
  }

  // TOOL-2: Lifecycle methods
  activate(context) {}
  deactivate() {}

  // TOOL-3: Event handlers
  onMouseDown(event, context) { return false; }
  onMouseMove(event, context) { return false; }
  onMouseUp(event, context) { return false; }
  onKeyDown(event, context) { return false; }
  onKeyUp(event, context) { return false; }
  onDoubleClick(event, context) { return false; }

  // TOOL-4: Visual feedback
  renderOverlay(ctx, context) {}
};
