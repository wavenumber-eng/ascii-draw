/**
 * SymbolTool - Create schematic symbols with pins
 * Implements: TOOL-24, OBJ-50 to OBJ-5J
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

AsciiEditor.tools.SymbolTool = class SymbolTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('symbol');
    this.cursor = 'none'; // Hide browser cursor, we draw our own
    this.drawing = false;
    this.startPos = null;
    this.currentPos = null;
    this.defaultPrefix = 'U'; // Default designator prefix
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

  /**
   * Find the next available designator number for a given prefix
   * @param {string} prefix - Designator prefix (U, R, C, etc.)
   * @param {Array} objects - Objects on the current page
   * @returns {number} Next available number
   */
  getNextDesignatorNumber(prefix, objects) {
    const symbols = objects.filter(o => o.type === 'symbol' && o.designator);
    const usedNumbers = symbols
      .filter(s => s.designator.prefix === prefix)
      .map(s => s.designator.number);

    if (usedNumbers.length === 0) return 1;
    return Math.max(...usedNumbers) + 1;
  }

  onMouseDown(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);

    // TOOL-21A/B: Two-click interaction (same as BoxTool)
    if (!this.drawing) {
      // First click: set corner 1
      this.drawing = true;
      this.startPos = { col, row };
      this.currentPos = { col, row };
      return true;
    } else {
      // Second click: create the symbol
      this.currentPos = { col, row };

      // Calculate symbol bounds
      const x = Math.min(this.startPos.col, this.currentPos.col);
      const y = Math.min(this.startPos.row, this.currentPos.row);
      const width = Math.abs(this.currentPos.col - this.startPos.col) + 1;
      const height = Math.abs(this.currentPos.row - this.startPos.row) + 1;

      // Minimum size 3x3 (also handles degenerate case: same location)
      if (width >= 3 && height >= 3) {
        const state = context.history.getState();
        const page = state.project.pages.find(p => p.id === state.activePageId);
        const nextNumber = this.getNextDesignatorNumber(this.defaultPrefix, page ? page.objects : []);

        // TOOL-24: Create symbol object
        const newSymbol = {
          id: AsciiEditor.core.generateId(),
          type: 'symbol',
          x, y, width, height,
          // Box properties (inherited)
          text: '',
          style: 'single',
          shadow: false,
          fill: 'none',
          textJustify: 'center-center',
          // Symbol-specific properties
          designator: {
            prefix: this.defaultPrefix,
            number: nextNumber,
            offset: { x: 0, y: -1 }, // Default: 1 cell above, left-aligned
            visible: true
          },
          parameters: [
            { name: 'value', value: '', offset: { x: 0, y: height }, visible: true }
          ],
          pins: []
        };

        context.history.execute(new AsciiEditor.core.CreateObjectCommand(state.activePageId, newSymbol));

        // Select the new symbol
        context.history.updateState(s => ({
          ...s,
          selection: { ids: [newSymbol.id], handles: null }
        }));
      }

      this.drawing = false;
      this.startPos = null;
      this.currentPos = null;
      return true;
    }
  }

  onMouseMove(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    this.currentPos = { col, row };
    return true; // Always redraw for crosshair
  }

  onMouseUp(event, context) {
    // TOOL-21F: Mouse can move freely between clicks (no drag required)
    return false;
  }

  // Allow typing when a symbol is selected while in symbol tool mode
  onKeyDown(event, context) {
    // TOOL-21C: Escape before second click cancels creation
    if (event.key === 'Escape' && this.drawing) {
      this.drawing = false;
      this.startPos = null;
      this.currentPos = null;
      return true;
    }

    const state = context.history.getState();

    // If single symbol selected and printable key, start inline edit
    if (state.selection.ids.length === 1 && event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      const page = state.project.pages.find(p => p.id === state.activePageId);
      if (page) {
        const obj = page.objects.find(o => o.id === state.selection.ids[0]);
        if (obj && obj.type === 'symbol' && context.startInlineEdit) {
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

      // Size indicator with "S" prefix to distinguish from box
      ctx.fillStyle = accent;
      ctx.font = '11px sans-serif';
      ctx.fillText(`S ${width}x${height}`, pixelPos.x + 4, pixelPos.y - 4);
    }
  }
};
