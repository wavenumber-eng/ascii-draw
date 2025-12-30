/**
 * PinTool - Add pins to symbol edges
 * Implements: TOOL-28, OBJ-5E to OBJ-5J
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.tools = AsciiEditor.tools || {};

// Pin shapes (same vocabulary as line end caps)
AsciiEditor.tools.PinShapes = [
  { key: 'square-outline', char: '□', name: 'Square Outline' },
  { key: 'square', char: '■', name: 'Square' },
  { key: 'circle-outline', char: '○', name: 'Circle Outline' },
  { key: 'circle', char: '●', name: 'Circle' },
  { key: 'triangle-outline', char: '▷', name: 'Triangle Outline' },
  { key: 'triangle', char: '▶', name: 'Triangle' },
  { key: 'diamond-outline', char: '◇', name: 'Diamond Outline' },
  { key: 'diamond', char: '◆', name: 'Diamond' },

];

AsciiEditor.tools.PinTool = class PinTool extends AsciiEditor.tools.Tool {
  constructor() {
    super('pin');
    this.cursor = 'none';
    this.currentPos = null;
    this.shapeIndex = 0; // Current pin shape
    this.hoveredEdge = null; // { symbolId, edge, offset, position }

    // Domain modules for clean separation
    this.SymbolDomain = AsciiEditor.domain.Symbol;
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
    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;
    this.currentPos = { col, row };

    // Check if hovering over a symbol edge
    this.hoveredEdge = this.findSymbolEdge(col, row, context);

    return true; // Always redraw
  }

  onMouseDown(event, context) {
    if (event.button !== 0) return false;

    // Use col/row from event (viewport handles coordinate conversion)
    const col = event.col;
    const row = event.row;

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
   * Delegates to domain.Symbol.findSymbolEdgeAtPoint
   * @returns { symbolId, edge, offset, position } or null
   */
  findSymbolEdge(col, row, context) {
    const state = context.history.getState();
    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return null;

    const result = this.SymbolDomain.findSymbolEdgeAtPoint(col, row, page.objects);
    if (!result) return null;

    // Convert { symbol, edge, offset, position } to { symbolId, edge, offset, position }
    return {
      symbolId: result.symbol.id,
      edge: result.edge,
      offset: result.offset,
      position: result.position
    };
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
