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
    context.setCursor(this.cursor);
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

  renderOverlay(overlay, context) {
    if (!this.currentPos) return;
    const { col, row } = this.currentPos;
    const shape = this.getCurrentShape();

    overlay.drawCellGlyph(col, row, shape.char);

    if (this.hoveredEdge) {
      overlay.drawCellHighlight(col, row, { label: 'PIN', padding: 0 });
    } else {
      overlay.drawCrosshair(col, row);
    }

    overlay.drawStatusLabel(0, 0, `Shape: ${shape.name} (1-8 or Space to change)`,
      { dx: 10, dy: 14 });
  }
};
