/**
 * TextTool - Place text without borders
 * Implements: TOOL-22
 * Creates box objects with style: 'none' for borderless text
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

AsciiEditor.tools.TextTool = class TextTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('text');
    this.cursor = 'none'; // Hide browser cursor, we draw our own
    this.dragStart = null;
    this.dragCurrent = null;
    this.dragging = false;
    this.currentPos = null; // Track mouse position for crosshair
  }

  activate(context) {
    this.dragStart = null;
    this.dragCurrent = null;
    this.dragging = false;
    this.currentPos = null;
    context.setCursor(this.cursor);
  }

  deactivate() {
    this.dragStart = null;
    this.dragCurrent = null;
    this.dragging = false;
    this.currentPos = null;
  }

  onMouseDown(event, context) {
    if (event.button !== 0) return false;

    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;
    this.dragStart = { col, row };
    this.dragCurrent = { col, row };
    this.dragging = true;
    return true;
  }

  onMouseMove(event, context) {
    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;
    this.currentPos = { x: col, y: row };

    if (this.dragging) {
      this.dragCurrent = { col, row };
    }
    return true; // Always redraw for crosshair
  }

  onMouseUp(event, context) {
    if (!this.dragging) return false;

    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;
    this.dragCurrent = { col, row };

    // Calculate bounds
    const x = Math.min(this.dragStart.col, this.dragCurrent.col);
    const y = Math.min(this.dragStart.row, this.dragCurrent.row);
    let width = Math.abs(this.dragCurrent.col - this.dragStart.col) + 1;
    let height = Math.abs(this.dragCurrent.row - this.dragStart.row) + 1;

    // Minimum size - just need 1 character space
    // For click (no drag), use reasonable defaults
    if (width < 2) width = 10;
    if (height < 1) height = 1;

    const state = context.history.getState();

    // Create text object (box with no border)
    const newText = {
      id: AsciiEditor.core.generateId(),
      type: 'box',
      x: x,
      y: y,
      width: width,
      height: height,
      style: 'none',
      text: '',
      textJustify: 'top-left',
      fill: 'none',
      shadow: false
    };

    context.history.execute(
      new AsciiEditor.core.CreateObjectCommand(state.activePageId, newText)
    );

    // Select the new text object
    context.history.updateState(s => ({
      ...s,
      selection: { ids: [newText.id], handles: null }
    }));

    // Start inline editing immediately
    if (context.startInlineEdit) {
      // Need to get the created object from state
      const newState = context.history.getState();
      const page = newState.project.pages.find(p => p.id === newState.activePageId);
      if (page) {
        const obj = page.objects.find(o => o.id === newText.id);
        if (obj) {
          context.startInlineEdit(obj);
        }
      }
    }

    this.dragging = false;
    this.dragStart = null;
    this.dragCurrent = null;

    return true;
  }

  onKeyDown(event, context) {
    if (event.key === 'Escape') {
      this.dragging = false;
      this.dragStart = null;
      this.dragCurrent = null;
      return true;
    }
    return false;
  }

  renderOverlay(overlay, context) {
    if (!this.dragging && this.currentPos) {
      overlay.drawCrosshair(this.currentPos.x, this.currentPos.y);
    }

    if (this.dragging && this.dragStart && this.dragCurrent) {
      const x = Math.min(this.dragStart.col, this.dragCurrent.col);
      const y = Math.min(this.dragStart.row, this.dragCurrent.row);
      const w = Math.abs(this.dragCurrent.col - this.dragStart.col) + 1;
      const h = Math.abs(this.dragCurrent.row - this.dragStart.row) + 1;
      overlay.drawCellRect(x, y, w, h, {
        dash: [4, 4],
        sizeLabel: `${w}×${h}`
      });
    }
  }
};
