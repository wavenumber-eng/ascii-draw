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
    this.cursor = 'text';
    this.dragStart = null;
    this.dragCurrent = null;
    this.dragging = false;
  }

  activate(context) {
    this.dragStart = null;
    this.dragCurrent = null;
    this.dragging = false;
    context.canvas.style.cursor = this.cursor;
  }

  deactivate() {
    this.dragStart = null;
    this.dragCurrent = null;
    this.dragging = false;
  }

  onMouseDown(event, context) {
    if (event.button !== 0) return false;

    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    this.dragStart = { col, row };
    this.dragCurrent = { col, row };
    this.dragging = true;
    return true;
  }

  onMouseMove(event, context) {
    if (!this.dragging) return false;

    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    this.dragCurrent = { col, row };
    return true;
  }

  onMouseUp(event, context) {
    if (!this.dragging) return false;

    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
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

  renderOverlay(ctx, context) {
    if (!this.dragging || !this.dragStart || !this.dragCurrent) return;

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim() || '#007acc';

    const x1 = Math.min(this.dragStart.col, this.dragCurrent.col);
    const y1 = Math.min(this.dragStart.row, this.dragCurrent.row);
    const x2 = Math.max(this.dragStart.col, this.dragCurrent.col);
    const y2 = Math.max(this.dragStart.row, this.dragCurrent.row);

    const pixel1 = context.grid.charToPixel(x1, y1);
    const pixel2 = context.grid.charToPixel(x2 + 1, y2 + 1);

    const width = pixel2.x - pixel1.x;
    const height = pixel2.y - pixel1.y;

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(pixel1.x, pixel1.y, width, height);
    ctx.setLineDash([]);

    // Size indicator
    const textWidth = x2 - x1 + 1;
    const textHeight = y2 - y1 + 1;
    ctx.fillStyle = accent;
    ctx.font = '11px sans-serif';
    ctx.fillText(`${textWidth}×${textHeight}`, pixel1.x + 4, pixel1.y - 4);
  }
};
