/**
 * BoxTool - Create rectangular boxes
 * Implements: TOOL-21, OBJ-10 to OBJ-17
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

AsciiEditor.tools.BoxTool = class BoxTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('box');
    this.cursor = 'none'; // Hide browser cursor, we draw our own
    this.drawing = false;
    this.startPos = null;
    this.currentPos = null;
  }

  activate(context) {
    this.drawing = false;
    this.currentPos = null;
    context.canvas.style.cursor = this.cursor;
  }

  deactivate() {
    this.drawing = false;
    this.startPos = null;
    this.currentPos = null;
  }

  onMouseDown(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    this.drawing = true;
    this.startPos = { col, row };
    this.currentPos = { col, row };
    return true;
  }

  onMouseMove(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    this.currentPos = { col, row };
    return true; // Always redraw for crosshair
  }

  onMouseUp(event, context) {
    if (this.drawing) {
      const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
      this.currentPos = { col, row };

      // Calculate box bounds
      const x = Math.min(this.startPos.col, this.currentPos.col);
      const y = Math.min(this.startPos.row, this.currentPos.row);
      const width = Math.abs(this.currentPos.col - this.startPos.col) + 1;
      const height = Math.abs(this.currentPos.row - this.startPos.row) + 1;

      // OBJ-11: Minimum size 3x3
      if (width >= 3 && height >= 3) {
        const state = context.history.getState();
        // TOOL-21: Create text box object
        const newBox = {
          id: AsciiEditor.core.generateId(),
          type: 'box',
          x, y, width, height,
          text: '',
          style: 'single',  // OBJ-12: single, double, thick, none
          shadow: false,    // OBJ-14: Optional drop shadow
          fill: 'none',     // OBJ-16, OBJ-17: Interior fill character
          textJustify: 'center-center'  // OBJ-15: 9-position justification
        };

        context.history.execute(new AsciiEditor.core.CreateObjectCommand(state.activePageId, newBox));

        // Select the new box
        context.history.updateState(s => ({
          ...s,
          selection: { ids: [newBox.id], handles: null }
        }));
      }

      this.drawing = false;
      this.startPos = null;
      this.currentPos = null;
      return true;
    }
    return false;
  }

  // Allow typing when a box is selected while in box tool mode
  onKeyDown(event, context) {
    const state = context.history.getState();

    // If single box selected and printable key, start inline edit
    if (state.selection.ids.length === 1 && event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      const page = state.project.pages.find(p => p.id === state.activePageId);
      if (page) {
        const obj = page.objects.find(o => o.id === state.selection.ids[0]);
        if (obj && obj.type === 'box' && context.startInlineEdit) {
          context.startInlineEdit(obj, event.key);
          return true;
        }
      }
    }
    return false;
  }

  renderOverlay(ctx, context) {
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim() || '#007acc';
    const grid = context.grid;
    const offsetX = grid.charWidth / 2;
    const offsetY = grid.charHeight / 2;

    // Draw crosshair cursor when hovering (not drawing)
    if (!this.drawing && this.currentPos) {
      const pixel = grid.charToPixel(this.currentPos.col, this.currentPos.row);
      const cx = pixel.x + offsetX;
      const cy = pixel.y + offsetY;

      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.stroke();
    }

    // Draw drag rectangle when drawing
    if (this.drawing && this.startPos && this.currentPos) {
      const x = Math.min(this.startPos.col, this.currentPos.col);
      const y = Math.min(this.startPos.row, this.currentPos.row);
      const width = Math.abs(this.currentPos.col - this.startPos.col) + 1;
      const height = Math.abs(this.currentPos.row - this.startPos.row) + 1;

      const pixelPos = grid.charToPixel(x, y);
      const pixelWidth = width * grid.charWidth;
      const pixelHeight = height * grid.charHeight;

      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(pixelPos.x, pixelPos.y, pixelWidth, pixelHeight);
      ctx.setLineDash([]);

      // Size indicator
      ctx.fillStyle = accent;
      ctx.font = '11px sans-serif';
      ctx.fillText(`${width}x${height}`, pixelPos.x + 4, pixelPos.y - 4);
    }
  }
};
