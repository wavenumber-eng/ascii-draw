/**
 * Symbol Domain Module
 * Pure functions for symbol geometry, pin positioning, and edge detection.
 * No UI, no canvas, no events - just geometry logic.
 *
 * Consolidates utilities from: WireTool.js, SelectTool.js, PinTool.js, CanvasASCIIBackend.js
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.domain = AsciiEditor.domain || {};

AsciiEditor.domain.Symbol = {

  // ============================================================
  // Symbol Bounds
  // ============================================================

  /**
   * Get the bounding box of a symbol
   */
  getBounds(symbol) {
    return {
      x: symbol.x,
      y: symbol.y,
      width: symbol.width,
      height: symbol.height,
      right: symbol.x + symbol.width - 1,
      bottom: symbol.y + symbol.height - 1
    };
  },

  /**
   * Check if a point is inside a symbol (including edges)
   */
  containsPoint(symbol, col, row) {
    return col >= symbol.x &&
           col < symbol.x + symbol.width &&
           row >= symbol.y &&
           row < symbol.y + symbol.height;
  },

  /**
   * Check if a point is on the symbol border (edge)
   */
  isOnBorder(symbol, col, row) {
    const { x, y, width, height } = symbol;
    const isOnVerticalEdge = (col === x || col === x + width - 1) &&
                              row >= y && row < y + height;
    const isOnHorizontalEdge = (row === y || row === y + height - 1) &&
                                col >= x && col < x + width;
    return isOnVerticalEdge || isOnHorizontalEdge;
  },

  // ============================================================
  // Edge Detection
  // ============================================================

  /**
   * Find which edge of a symbol a point is on
   * @param {number} col - Column position
   * @param {number} row - Row position
   * @param {Object} symbol - Symbol object with x, y, width, height
   * @returns {'left'|'right'|'top'|'bottom'|null} Edge name or null
   */
  findEdge(col, row, symbol) {
    const { x, y, width, height } = symbol;

    // Check left edge (excluding corners)
    if (col === x && row > y && row < y + height - 1) {
      return 'left';
    }
    // Check right edge (excluding corners)
    if (col === x + width - 1 && row > y && row < y + height - 1) {
      return 'right';
    }
    // Check top edge (excluding corners)
    if (row === y && col > x && col < x + width - 1) {
      return 'top';
    }
    // Check bottom edge (excluding corners)
    if (row === y + height - 1 && col > x && col < x + width - 1) {
      return 'bottom';
    }

    return null;
  },

  /**
   * Find edge and calculate offset for a point on symbol boundary
   * @returns {Object|null} { edge, offset } or null
   */
  findEdgeWithOffset(col, row, symbol) {
    const edge = this.findEdge(col, row, symbol);
    if (!edge) return null;

    const offset = this.calculateEdgeOffset(col, row, symbol, edge);
    return { edge, offset };
  },

  /**
   * Calculate normalized offset (0-1) for a point along an edge
   */
  calculateEdgeOffset(col, row, symbol, edge) {
    const { x, y, width, height } = symbol;

    switch (edge) {
      case 'left':
      case 'right':
        // Vertical edge: offset based on row
        return (row - y - 1) / (height - 3); // Exclude corners
      case 'top':
      case 'bottom':
        // Horizontal edge: offset based on column
        return (col - x - 1) / (width - 3); // Exclude corners
      default:
        return 0.5;
    }
  },

  /**
   * Find the closest edge of a symbol to a given point
   * @returns {Object} { edge, offset, distance, position: {col, row} }
   */
  findClosestEdge(col, row, symbol) {
    const { x, y, width, height } = symbol;
    const edges = [];

    // Left edge
    if (height > 2) {
      const clampedRow = Math.max(y + 1, Math.min(y + height - 2, row));
      const dist = Math.abs(col - x) + Math.abs(row - clampedRow);
      edges.push({
        edge: 'left',
        position: { col: x, row: clampedRow },
        offset: (clampedRow - y - 1) / Math.max(1, height - 3),
        distance: dist
      });
    }

    // Right edge
    if (height > 2) {
      const clampedRow = Math.max(y + 1, Math.min(y + height - 2, row));
      const dist = Math.abs(col - (x + width - 1)) + Math.abs(row - clampedRow);
      edges.push({
        edge: 'right',
        position: { col: x + width - 1, row: clampedRow },
        offset: (clampedRow - y - 1) / Math.max(1, height - 3),
        distance: dist
      });
    }

    // Top edge
    if (width > 2) {
      const clampedCol = Math.max(x + 1, Math.min(x + width - 2, col));
      const dist = Math.abs(row - y) + Math.abs(col - clampedCol);
      edges.push({
        edge: 'top',
        position: { col: clampedCol, row: y },
        offset: (clampedCol - x - 1) / Math.max(1, width - 3),
        distance: dist
      });
    }

    // Bottom edge
    if (width > 2) {
      const clampedCol = Math.max(x + 1, Math.min(x + width - 2, col));
      const dist = Math.abs(row - (y + height - 1)) + Math.abs(col - clampedCol);
      edges.push({
        edge: 'bottom',
        position: { col: clampedCol, row: y + height - 1 },
        offset: (clampedCol - x - 1) / Math.max(1, width - 3),
        distance: dist
      });
    }

    // Return the closest edge
    edges.sort((a, b) => a.distance - b.distance);
    return edges[0] || null;
  },

  // ============================================================
  // Pin Position Calculation
  // ============================================================

  /**
   * Calculate world position of a pin on a symbol
   * SINGLE SOURCE OF TRUTH for pin positioning
   *
   * @param {Object} symbol - Symbol object with x, y, width, height
   * @param {Object} pin - Pin object with edge ('left'|'right'|'top'|'bottom') and offset (0-1)
   * @returns {Object} { col, row } world coordinates
   */
  getPinPosition(symbol, pin) {
    const { x, y, width, height } = symbol;
    const offset = pin.offset !== undefined ? pin.offset : 0.5;

    switch (pin.edge) {
      case 'left':
        return {
          col: x,
          row: Math.round(y + 1 + offset * (height - 3))
        };
      case 'right':
        return {
          col: x + width - 1,
          row: Math.round(y + 1 + offset * (height - 3))
        };
      case 'top':
        return {
          col: Math.round(x + 1 + offset * (width - 3)),
          row: y
        };
      case 'bottom':
        return {
          col: Math.round(x + 1 + offset * (width - 3)),
          row: y + height - 1
        };
      default:
        return { col: x, row: y };
    }
  },

  /**
   * Get world positions for all pins on a symbol
   * @returns {Array} Array of { pin, position: {col, row} }
   */
  getAllPinPositions(symbol) {
    if (!symbol.pins || symbol.pins.length === 0) return [];

    return symbol.pins.map(pin => ({
      pin,
      position: this.getPinPosition(symbol, pin)
    }));
  },

  /**
   * Find a pin at a specific world position
   * @param {number} col - Column to check
   * @param {number} row - Row to check
   * @param {Object} symbol - Symbol to search
   * @returns {Object|null} Pin object or null
   */
  findPinAtPosition(col, row, symbol) {
    if (!symbol.pins) return null;

    for (const pin of symbol.pins) {
      const pos = this.getPinPosition(symbol, pin);
      if (pos.col === col && pos.row === row) {
        return pin;
      }
    }
    return null;
  },

  /**
   * Find pin at edge with offset tolerance
   * @param {Object} symbol - Symbol object
   * @param {string} edge - Edge name
   * @param {number} offset - Normalized offset (0-1)
   * @param {number} tolerance - Offset tolerance (default 0.05)
   * @returns {Object|null} Pin object or null
   */
  findPinAtEdge(symbol, edge, offset, tolerance = 0.05) {
    if (!symbol.pins) return null;

    for (const pin of symbol.pins) {
      if (pin.edge === edge && Math.abs(pin.offset - offset) < tolerance) {
        return pin;
      }
    }
    return null;
  },

  // ============================================================
  // Pin Validation
  // ============================================================

  /**
   * Check if a pin position would collide with an existing pin
   * @param {Object} symbol - Symbol object
   * @param {string} edge - Edge name
   * @param {number} offset - Normalized offset (0-1)
   * @param {string} excludePinId - Pin ID to exclude from check (for moving pins)
   * @returns {boolean} True if collision
   */
  checkPinCollision(symbol, edge, offset, excludePinId = null) {
    if (!symbol.pins) return false;

    for (const pin of symbol.pins) {
      if (pin.id === excludePinId) continue;
      if (pin.edge === edge && Math.abs(pin.offset - offset) < 0.05) {
        return true;
      }
    }
    return false;
  },

  /**
   * Check if a pin is on a valid edge position (not on corner)
   */
  isPinOnValidEdge(symbol, pin) {
    const pos = this.getPinPosition(symbol, pin);
    return this.findEdge(pos.col, pos.row, symbol) !== null;
  },

  /**
   * Constrain a position to a symbol edge
   * @returns {Object} { edge, offset, position: {col, row} }
   */
  constrainToEdge(col, row, symbol) {
    return this.findClosestEdge(col, row, symbol);
  },

  // ============================================================
  // Designator Utilities
  // ============================================================

  /**
   * Get the next available designator number for a prefix
   * @param {string} prefix - Designator prefix (e.g., 'U', 'R', 'C')
   * @param {Array} objects - Array of all objects
   * @returns {number} Next available number
   */
  getNextDesignatorNumber(prefix, objects) {
    const symbols = objects.filter(o => o.type === 'symbol');
    const usedNumbers = symbols
      .filter(s => s.designator && s.designator.prefix === prefix)
      .map(s => s.designator.number || 0);

    if (usedNumbers.length === 0) return 1;
    return Math.max(...usedNumbers) + 1;
  },

  /**
   * Format a designator as a string
   */
  formatDesignator(designator) {
    if (!designator) return '';
    return `${designator.prefix || ''}${designator.number || ''}`;
  },

  // ============================================================
  // Symbol Search
  // ============================================================

  /**
   * Find all symbols in objects array
   */
  findAllSymbols(objects) {
    return objects.filter(o => o.type === 'symbol');
  },

  /**
   * Find a symbol at a given position
   * @returns {Object|null} Symbol object or null
   */
  findSymbolAtPosition(col, row, objects) {
    const symbols = this.findAllSymbols(objects);
    for (const symbol of symbols) {
      if (this.containsPoint(symbol, col, row)) {
        return symbol;
      }
    }
    return null;
  },

  /**
   * Find a symbol by ID
   */
  findSymbolById(symbolId, objects) {
    return objects.find(o => o.type === 'symbol' && o.id === symbolId) || null;
  },

  /**
   * Find symbol edge at a point (for pin placement)
   * @returns {Object|null} { symbol, edge, offset, position } or null
   */
  findSymbolEdgeAtPoint(col, row, objects) {
    const symbols = this.findAllSymbols(objects);

    for (const symbol of symbols) {
      const edge = this.findEdge(col, row, symbol);
      if (edge) {
        const offset = this.calculateEdgeOffset(col, row, symbol, edge);
        return {
          symbol,
          edge,
          offset,
          position: { col, row }
        };
      }
    }

    return null;
  },

  /**
   * Find pin at world position across all symbols
   * @returns {Object|null} { symbol, pin } or null
   */
  findPinAtPoint(col, row, objects) {
    const symbols = this.findAllSymbols(objects);

    for (const symbol of symbols) {
      const pin = this.findPinAtPosition(col, row, symbol);
      if (pin) {
        return { symbol, pin };
      }
    }

    return null;
  }

};
