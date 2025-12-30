/**
 * Unit tests for domain/Symbol.js
 * Tests pure geometric functions for symbol bounds, edge detection, and pin positioning.
 */

describe('domain.Symbol', () => {
  let Symbol;

  beforeAll(() => {
    Symbol = AsciiEditor.domain.Symbol;
  });

  // Sample symbol for testing
  const createSymbol = (overrides = {}) => ({
    id: 'sym1',
    type: 'symbol',
    x: 10,
    y: 5,
    width: 8,
    height: 6,
    pins: [],
    ...overrides
  });

  describe('getBounds', () => {
    test('calculates correct bounds', () => {
      const symbol = createSymbol();
      const bounds = Symbol.getBounds(symbol);
      expect(bounds.x).toBe(10);
      expect(bounds.y).toBe(5);
      expect(bounds.width).toBe(8);
      expect(bounds.height).toBe(6);
      expect(bounds.right).toBe(17);
      expect(bounds.bottom).toBe(10);
    });
  });

  describe('containsPoint', () => {
    const symbol = createSymbol();

    test('returns true for point inside symbol', () => {
      expect(Symbol.containsPoint(symbol, 12, 7)).toBe(true);
    });

    test('returns true for point on edge', () => {
      expect(Symbol.containsPoint(symbol, 10, 5)).toBe(true);
      expect(Symbol.containsPoint(symbol, 17, 10)).toBe(true);
    });

    test('returns false for point outside symbol', () => {
      expect(Symbol.containsPoint(symbol, 9, 7)).toBe(false);
      expect(Symbol.containsPoint(symbol, 18, 7)).toBe(false);
    });
  });

  describe('isOnBorder', () => {
    const symbol = createSymbol();

    test('returns true for point on left edge', () => {
      expect(Symbol.isOnBorder(symbol, 10, 6)).toBe(true);
    });

    test('returns true for point on right edge', () => {
      expect(Symbol.isOnBorder(symbol, 17, 6)).toBe(true);
    });

    test('returns true for point on top edge', () => {
      expect(Symbol.isOnBorder(symbol, 12, 5)).toBe(true);
    });

    test('returns true for point on bottom edge', () => {
      expect(Symbol.isOnBorder(symbol, 12, 10)).toBe(true);
    });

    test('returns false for point inside symbol', () => {
      expect(Symbol.isOnBorder(symbol, 12, 7)).toBe(false);
    });
  });

  describe('findEdge', () => {
    const symbol = createSymbol();

    test('returns "left" for point on left edge (excluding corners)', () => {
      expect(Symbol.findEdge(10, 7, symbol)).toBe('left');
    });

    test('returns "right" for point on right edge (excluding corners)', () => {
      expect(Symbol.findEdge(17, 7, symbol)).toBe('right');
    });

    test('returns "top" for point on top edge (excluding corners)', () => {
      expect(Symbol.findEdge(12, 5, symbol)).toBe('top');
    });

    test('returns "bottom" for point on bottom edge (excluding corners)', () => {
      expect(Symbol.findEdge(12, 10, symbol)).toBe('bottom');
    });

    test('returns null for corner', () => {
      expect(Symbol.findEdge(10, 5, symbol)).toBeNull();
      expect(Symbol.findEdge(17, 5, symbol)).toBeNull();
      expect(Symbol.findEdge(10, 10, symbol)).toBeNull();
      expect(Symbol.findEdge(17, 10, symbol)).toBeNull();
    });

    test('returns null for point inside or outside', () => {
      expect(Symbol.findEdge(12, 7, symbol)).toBeNull();
      expect(Symbol.findEdge(5, 5, symbol)).toBeNull();
    });
  });

  describe('getPinPosition', () => {
    const symbol = createSymbol();

    test('calculates left edge pin position', () => {
      const pin = { edge: 'left', offset: 0.5 };
      const pos = Symbol.getPinPosition(symbol, pin);
      expect(pos.col).toBe(10);
      expect(pos.row).toBeGreaterThanOrEqual(5);
      expect(pos.row).toBeLessThanOrEqual(10);
    });

    test('calculates right edge pin position', () => {
      const pin = { edge: 'right', offset: 0.5 };
      const pos = Symbol.getPinPosition(symbol, pin);
      expect(pos.col).toBe(17);
    });

    test('calculates top edge pin position', () => {
      const pin = { edge: 'top', offset: 0.5 };
      const pos = Symbol.getPinPosition(symbol, pin);
      expect(pos.row).toBe(5);
    });

    test('calculates bottom edge pin position', () => {
      const pin = { edge: 'bottom', offset: 0.5 };
      const pos = Symbol.getPinPosition(symbol, pin);
      expect(pos.row).toBe(10);
    });

    test('offset 0 places pin at start of edge', () => {
      const pin = { edge: 'left', offset: 0 };
      const pos = Symbol.getPinPosition(symbol, pin);
      expect(pos.row).toBe(6); // y + 1 (first non-corner)
    });

    test('offset 1 places pin at end of edge', () => {
      const pin = { edge: 'left', offset: 1 };
      const pos = Symbol.getPinPosition(symbol, pin);
      expect(pos.row).toBe(9); // y + height - 2 (last non-corner)
    });
  });

  describe('getAllPinPositions', () => {
    test('returns positions for all pins', () => {
      const symbol = createSymbol({
        pins: [
          { id: 'p1', edge: 'left', offset: 0.5 },
          { id: 'p2', edge: 'right', offset: 0.5 }
        ]
      });
      const positions = Symbol.getAllPinPositions(symbol);
      expect(positions).toHaveLength(2);
      expect(positions[0].pin.id).toBe('p1');
      expect(positions[0].position).toHaveProperty('col');
      expect(positions[0].position).toHaveProperty('row');
    });

    test('returns empty array for symbol with no pins', () => {
      const symbol = createSymbol({ pins: [] });
      expect(Symbol.getAllPinPositions(symbol)).toHaveLength(0);
    });
  });

  describe('findPinAtPosition', () => {
    test('finds pin at exact position', () => {
      const symbol = createSymbol({
        pins: [{ id: 'p1', edge: 'left', offset: 0.5 }]
      });
      const pinPos = Symbol.getPinPosition(symbol, symbol.pins[0]);
      const found = Symbol.findPinAtPosition(pinPos.col, pinPos.row, symbol);
      expect(found).not.toBeNull();
      expect(found.id).toBe('p1');
    });

    test('returns null when no pin at position', () => {
      const symbol = createSymbol({
        pins: [{ id: 'p1', edge: 'left', offset: 0.5 }]
      });
      expect(Symbol.findPinAtPosition(0, 0, symbol)).toBeNull();
    });
  });

  describe('findPinAtEdge', () => {
    const symbol = createSymbol({
      pins: [{ id: 'p1', edge: 'left', offset: 0.5 }]
    });

    test('finds pin at matching edge and offset', () => {
      const found = Symbol.findPinAtEdge(symbol, 'left', 0.5);
      expect(found).not.toBeNull();
      expect(found.id).toBe('p1');
    });

    test('finds pin within tolerance', () => {
      const found = Symbol.findPinAtEdge(symbol, 'left', 0.52);
      expect(found).not.toBeNull();
    });

    test('returns null for different edge', () => {
      expect(Symbol.findPinAtEdge(symbol, 'right', 0.5)).toBeNull();
    });

    test('returns null for offset outside tolerance', () => {
      expect(Symbol.findPinAtEdge(symbol, 'left', 0.7)).toBeNull();
    });
  });

  describe('checkPinCollision', () => {
    const symbol = createSymbol({
      pins: [
        { id: 'p1', edge: 'left', offset: 0.5 },
        { id: 'p2', edge: 'right', offset: 0.5 }
      ]
    });

    test('returns true for colliding position', () => {
      expect(Symbol.checkPinCollision(symbol, 'left', 0.5)).toBe(true);
    });

    test('returns false for non-colliding position', () => {
      expect(Symbol.checkPinCollision(symbol, 'left', 0.8)).toBe(false);
    });

    test('excludes specified pin from check', () => {
      expect(Symbol.checkPinCollision(symbol, 'left', 0.5, 'p1')).toBe(false);
    });
  });

  describe('findAllSymbols', () => {
    test('filters only symbol objects', () => {
      const objects = [
        { id: 's1', type: 'symbol' },
        { id: 'w1', type: 'wire' },
        { id: 's2', type: 'symbol' },
        { id: 'b1', type: 'box' }
      ];
      const symbols = Symbol.findAllSymbols(objects);
      expect(symbols).toHaveLength(2);
      expect(symbols.map(s => s.id)).toEqual(['s1', 's2']);
    });
  });

  describe('findSymbolAtPosition', () => {
    const objects = [
      createSymbol({ id: 's1', x: 0, y: 0, width: 10, height: 10 }),
      createSymbol({ id: 's2', x: 20, y: 20, width: 10, height: 10 })
    ];

    test('finds symbol containing point', () => {
      const found = Symbol.findSymbolAtPosition(5, 5, objects);
      expect(found).not.toBeNull();
      expect(found.id).toBe('s1');
    });

    test('returns null when no symbol contains point', () => {
      expect(Symbol.findSymbolAtPosition(15, 15, objects)).toBeNull();
    });
  });

  describe('findSymbolEdgeAtPoint', () => {
    const objects = [
      createSymbol({ id: 's1', x: 10, y: 5, width: 8, height: 6 })
    ];

    test('finds edge at valid edge position', () => {
      const result = Symbol.findSymbolEdgeAtPoint(10, 7, objects);
      expect(result).not.toBeNull();
      expect(result.edge).toBe('left');
      expect(result.symbol.id).toBe('s1');
    });

    test('returns null for corner position', () => {
      expect(Symbol.findSymbolEdgeAtPoint(10, 5, objects)).toBeNull();
    });

    test('returns null when not on any symbol edge', () => {
      expect(Symbol.findSymbolEdgeAtPoint(0, 0, objects)).toBeNull();
    });
  });

  describe('findPinAtPoint', () => {
    const pin = { id: 'p1', edge: 'left', offset: 0.5 };
    const symbol = createSymbol({ id: 's1', pins: [pin] });
    const objects = [symbol];

    test('finds pin at exact position', () => {
      const pinPos = Symbol.getPinPosition(symbol, pin);
      const result = Symbol.findPinAtPoint(pinPos.col, pinPos.row, objects);
      expect(result).not.toBeNull();
      expect(result.symbol.id).toBe('s1');
      expect(result.pin.id).toBe('p1');
    });

    test('returns null when no pin at position', () => {
      expect(Symbol.findPinAtPoint(0, 0, objects)).toBeNull();
    });
  });

  describe('getNextDesignatorNumber', () => {
    test('returns 1 for empty objects', () => {
      expect(Symbol.getNextDesignatorNumber('U', [])).toBe(1);
    });

    test('returns next number in sequence', () => {
      const objects = [
        { type: 'symbol', designator: { prefix: 'U', number: 1 } },
        { type: 'symbol', designator: { prefix: 'U', number: 3 } }
      ];
      expect(Symbol.getNextDesignatorNumber('U', objects)).toBe(4);
    });

    test('ignores symbols with different prefix', () => {
      const objects = [
        { type: 'symbol', designator: { prefix: 'R', number: 5 } }
      ];
      expect(Symbol.getNextDesignatorNumber('U', objects)).toBe(1);
    });
  });

  describe('formatDesignator', () => {
    test('formats designator with prefix and number', () => {
      expect(Symbol.formatDesignator({ prefix: 'U', number: 3 })).toBe('U3');
    });

    test('returns empty string for null', () => {
      expect(Symbol.formatDesignator(null)).toBe('');
    });
  });
});
