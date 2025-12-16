/**
 * BoxTool - Create rectangular boxes
 * Implements: TOOL-21, OBJ-10 to OBJ-17
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

AsciiEditor.tools.BoxTool = class BoxTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('box');
    this.cursor = 'crosshair';
    this.drawing = false;
    this.startPos = null;
    this.currentPos = null;
  }

  activate(context) {
    this.drawing = false;
    context.canvas.style.cursor = this.cursor;
  }

  onMouseDown(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    this.drawing = true;
    this.startPos = { col, row };
    this.currentPos = { col, row };
    return true;
  }

  onMouseMove(event, context) {
    if (this.drawing) {
      const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
      this.currentPos = { col, row };
      return true; // Request redraw
    }
    return false;
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
        const newBox = {
          id: AsciiEditor.core.generateId(),
          type: 'box',
          x, y, width, height,
          text: '',
          style: 'single',  // OBJ-12: single, double, rounded
          shadow: false,    // OBJ-14: Optional drop shadow
          textJustify: 'center-center',  // OBJ-15: 9-position justification
          title: '',        // OBJ-16: Optional title
          titlePosition: 'top-left',
          titleMode: 'border'  // OBJ-17: border, inside, outside
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

  renderOverlay(ctx, context) {
    if (this.drawing && this.startPos && this.currentPos) {
      const x = Math.min(this.startPos.col, this.currentPos.col);
      const y = Math.min(this.startPos.row, this.currentPos.row);
      const width = Math.abs(this.currentPos.col - this.startPos.col) + 1;
      const height = Math.abs(this.currentPos.row - this.startPos.row) + 1;

      const pixelPos = context.grid.charToPixel(x, y);
      const pixelWidth = width * context.grid.charWidth;
      const pixelHeight = height * context.grid.charHeight;

      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue('--accent').trim() || '#007acc';

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
