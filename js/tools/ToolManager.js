/**
 * ToolManager - Orchestrates tool switching and event delegation
 * Implements: TOOL-10 to TOOL-13
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

AsciiEditor.tools.ToolManager = class ToolManager {
  constructor() {
    this.tools = {};
    this.activeTool = null;
    this.context = null;
  }

  register(tool) {
    this.tools[tool.name] = tool;
  }

  setContext(context) {
    this.context = context;
  }

  // TOOL-10, TOOL-11: Tool switching
  activate(toolName) {
    if (this.activeTool) {
      this.activeTool.deactivate();
    }

    const tool = this.tools[toolName];
    if (tool) {
      this.activeTool = tool;
      tool.activate(this.context);
      return true;
    }
    return false;
  }

  getActiveTool() {
    return this.activeTool;
  }

  // Event delegation to active tool
  onMouseDown(event) {
    if (this.activeTool && this.context) {
      return this.activeTool.onMouseDown(event, this.context);
    }
    return false;
  }

  onMouseMove(event) {
    if (this.activeTool && this.context) {
      return this.activeTool.onMouseMove(event, this.context);
    }
    return false;
  }

  onMouseUp(event) {
    if (this.activeTool && this.context) {
      return this.activeTool.onMouseUp(event, this.context);
    }
    return false;
  }

  onKeyDown(event) {
    if (this.activeTool && this.context) {
      return this.activeTool.onKeyDown(event, this.context);
    }
    return false;
  }

  onKeyUp(event) {
    if (this.activeTool && this.context) {
      return this.activeTool.onKeyUp(event, this.context);
    }
    return false;
  }

  onDoubleClick(event) {
    if (this.activeTool && this.context) {
      return this.activeTool.onDoubleClick(event, this.context);
    }
    return false;
  }

  renderOverlay(ctx) {
    if (this.activeTool && this.context) {
      this.activeTool.renderOverlay(ctx, this.context);
    }
  }
};
