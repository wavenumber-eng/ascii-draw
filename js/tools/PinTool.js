/**
 * PinTool - Add pins to symbol edges
 * Implements: TOOL-28, OBJ-5E to OBJ-5J
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

// Pin shapes (same vocabulary as line end caps)
AsciiEditor.tools.PinShapes = [
  { key: 'circle-outline', char: '○', name: 'Circle Outline' },
  { key: 'circle', char: '●', name: 'Circle' },
  { key: 'square-outline', char: '□', name: 'Square Outline' },
  { key: 'square', char: '■', name: 'Square' },
  { key: 'diamond-outline', char: '◇', name: 'Diamond Outline' },
  { key: 'diamond', char: '◆', name: 'Diamond' },
  { key: 'triangle-outline', char: '▷', name: 'Triangle Outline' },
  { key: 'triangle', char: '▶', name: 'Triangle' }
];

AsciiEditor.tools.PinTool = class PinTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('pin');
    this.cursor = 'none';
    this.currentPos = null;
    this.shapeIndex = 0; // Current pin shape
    this.hoveredEdge = null; // { symbol, edge, offset, position }
  }

  activate(context) {
    this.currentPos = null;
    this.hoveredEdge = null;
    context.canvas.style.cursor = this.cursor;
  }

  deactivate() {
    this.currentPos = null;
    this.hoveredEdge = null;
  }

  getCurrentShape() {
    return AsciiEditor.tools.PinShapes[this.shapeIndex];
  }

  onMouseMove(event, context) {
    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);
    this.currentPos = { col, row };

    // Check if hovering over a symbol edge
    this.hoveredEdge = this.findSymbolEdge(col, row, context);

    return true; // Always redraw
  }

  onMouseDown(event, context) {
    if (event.button !== 0) return false;

    const { col, row } = context.grid.pixelToChar(event.canvasX, event.canvasY);

    // Only create pin if on a symbol edge
    const edge = this.findSymbolEdge(col, row, context);
    if (!edge) return false;

    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return false;

    const symbol = page.objects.find(o => o.id === edge.symbolId);
    if (!symbol) return false;

    // Create new pin
    const newPin = {
      id: AsciiEditor.core.generateId(),
      name: '',
      edge: edge.edge,
      offset: edge.offset,
      shape: this.getCurrentShape().key,
      direction: 'bidirectional'
    };

    // Add pin to symbol's pins array
    const updatedPins = [...(symbol.pins || []), newPin];

    context.history.execute(new AsciiEditor.core.ModifyObjectCommand(
      state.activePageId,
      symbol.id,
      { pins: symbol.pins || [] },
      { pins: updatedPins }
    ));

    return true;
  }

  onKeyDown(event, context) {
    // Number keys 1-8 to cycle pin shapes
    const num = parseInt(event.key, 10);
    if (num >= 1 && num <= AsciiEditor.tools.PinShapes.length) {
      this.shapeIndex = num - 1;
      return true;
    }

    // Space to cycle through shapes
    if (event.key === ' ') {
      this.shapeIndex = (this.shapeIndex + 1) % AsciiEditor.tools.PinShapes.length;
      return true;
    }

    return false;
  }

  /**
   * Find if a point is on a symbol edge (ON the border)
   * OBJ-5J2: Pins CANNOT be placed on corner cells
   * Returns { symbolId, edge, offset, position } or null
   */
  findSymbolEdge(col, row, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return null;

    const symbols = page.objects.filter(o => o.type === 'symbol');

    for (const symbol of symbols) {
      const { x, y, width, height } = symbol;

      // Check left edge (excluding corners - row must be > y and < y + height - 1)
      if (col === x && row > y && row < y + height - 1) {
        const offset = height > 2 ? (row - y) / (height - 1) : 0.5;
        return { symbolId: symbol.id, edge: 'left', offset, position: { col, row } };
      }

      // Check right edge (excluding corners)
      if (col === x + width - 1 && row > y && row < y + height - 1) {
        const offset = height > 2 ? (row - y) / (height - 1) : 0.5;
        return { symbolId: symbol.id, edge: 'right', offset, position: { col, row } };
      }

      // Check top edge (excluding corners)
      if (row === y && col > x && col < x + width - 1) {
        const offset = width > 2 ? (col - x) / (width - 1) : 0.5;
        return { symbolId: symbol.id, edge: 'top', offset, position: { col, row } };
      }

      // Check bottom edge (excluding corners)
      if (row === y + height - 1 && col > x && col < x + width - 1) {
        const offset = width > 2 ? (col - x) / (width - 1) : 0.5;
        return { symbolId: symbol.id, edge: 'bottom', offset, position: { col, row } };
      }
    }

    return null;
  }

  renderOverlay(ctx, context) {
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim() || '#007acc';
    const grid = context.grid;

    if (!this.currentPos) return;

    const pixel = grid.charToPixel(this.currentPos.col, this.currentPos.row);
    const cx = pixel.x + grid.charWidth / 2;
    const cy = pixel.y + grid.charHeight / 2;

    // Draw current pin shape at cursor
    const shape = this.getCurrentShape();
    ctx.font = '16px BerkeleyMono, monospace';
    ctx.fillStyle = accent;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(shape.char, cx, cy);

    // If hovering over symbol edge, show "PIN" indicator
    if (this.hoveredEdge) {
      ctx.fillStyle = accent;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('PIN', pixel.x + grid.charWidth + 4, pixel.y - 2);

      // Highlight the edge position
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(pixel.x, pixel.y, grid.charWidth, grid.charHeight);
    } else {
      // Show crosshair when not on edge
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy - 4);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, cy + 4);
      ctx.lineTo(cx, cy + 10);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.lineTo(cx - 4, cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + 4, cy);
      ctx.lineTo(cx + 10, cy);
      ctx.stroke();
    }

    // Show current shape name in status area
    ctx.fillStyle = accent;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Shape: ${shape.name} (1-8 or Space to change)`, 10, 10);
  }
};
