/**
 * Unit tests for domain/Wire.js
 * Tests pure functions for wire connectivity, binding, and endpoint management.
 */

describe('domain.Wire', () => {
  let Wire;
  let Symbol;

  beforeAll(() => {
    Wire = AsciiEditor.domain.Wire;
    Symbol = AsciiEditor.domain.Symbol;
  });

  // Helper to create a wire
  const createWire = (overrides = {}) => ({
    id: 'wire1',
    type: 'wire',
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    style: 'single',
    net: '',
    startBinding: null,
    endBinding: null,
    ...overrides
  });

  // Helper to create a symbol
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

  describe('findAllWires', () => {
    test('filters only wire objects', () => {
      const objects = [
        { id: 'w1', type: 'wire' },
        { id: 's1', type: 'symbol' },
        { id: 'w2', type: 'wire' },
        { id: 'b1', type: 'box' }
      ];
      const wires = Wire.findAllWires(objects);
      expect(wires).toHaveLength(2);
      expect(wires.map(w => w.id)).toEqual(['w1', 'w2']);
    });
  });

  describe('findWireById', () => {
    const objects = [
      createWire({ id: 'w1' }),
      createWire({ id: 'w2' })
    ];

    test('finds wire by id', () => {
      const found = Wire.findWireById('w2', objects);
      expect(found).not.toBeNull();
      expect(found.id).toBe('w2');
    });

    test('returns null for non-existent id', () => {
      expect(Wire.findWireById('w99', objects)).toBeNull();
    });
  });

  describe('getStartPoint / getEndPoint', () => {
    const wire = createWire({
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]
    });

    test('getStartPoint returns first point', () => {
      expect(Wire.getStartPoint(wire)).toEqual({ x: 0, y: 0 });
    });

    test('getEndPoint returns last point', () => {
      expect(Wire.getEndPoint(wire)).toEqual({ x: 5, y: 5 });
    });

    test('returns null for wire with no points', () => {
      const emptyWire = { points: [] };
      expect(Wire.getStartPoint(emptyWire)).toBeNull();
      expect(Wire.getEndPoint(emptyWire)).toBeNull();
    });
  });

  describe('getEndpointByIndex', () => {
    const wire = createWire({
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]
    });

    test('returns start endpoint for index 0', () => {
      const result = Wire.getEndpointByIndex(wire, 0);
      expect(result.isStart).toBe(true);
      expect(result.point).toEqual({ x: 0, y: 0 });
    });

    test('returns end endpoint for last index', () => {
      const result = Wire.getEndpointByIndex(wire, 2);
      expect(result.isStart).toBe(false);
      expect(result.point).toEqual({ x: 5, y: 5 });
    });

    test('returns null for middle index', () => {
      expect(Wire.getEndpointByIndex(wire, 1)).toBeNull();
    });
  });

  describe('getEndpointBinding / isEndpointBound', () => {
    test('returns binding for bound endpoint', () => {
      const wire = createWire({
        startBinding: { symbolId: 's1', pinId: 'p1' }
      });
      expect(Wire.getEndpointBinding(wire, true)).toEqual({ symbolId: 's1', pinId: 'p1' });
      expect(Wire.isEndpointBound(wire, true)).toBe(true);
    });

    test('returns null/false for unbound endpoint', () => {
      const wire = createWire();
      expect(Wire.getEndpointBinding(wire, true)).toBeNull();
      expect(Wire.isEndpointBound(wire, true)).toBe(false);
    });
  });

  describe('hasAnyBinding', () => {
    test('returns true if start is bound', () => {
      const wire = createWire({ startBinding: { symbolId: 's1', pinId: 'p1' } });
      expect(Wire.hasAnyBinding(wire)).toBe(true);
    });

    test('returns true if end is bound', () => {
      const wire = createWire({ endBinding: { symbolId: 's1', pinId: 'p1' } });
      expect(Wire.hasAnyBinding(wire)).toBe(true);
    });

    test('returns false if neither is bound', () => {
      const wire = createWire();
      expect(Wire.hasAnyBinding(wire)).toBe(false);
    });
  });

  describe('findWiresBoundToSymbol', () => {
    const objects = [
      createWire({ id: 'w1', startBinding: { symbolId: 's1', pinId: 'p1' } }),
      createWire({ id: 'w2', endBinding: { symbolId: 's1', pinId: 'p2' } }),
      createWire({ id: 'w3', startBinding: { symbolId: 's2', pinId: 'p3' } })
    ];

    test('finds wires bound to symbol at start', () => {
      const results = Wire.findWiresBoundToSymbol('s1', objects);
      expect(results).toHaveLength(2);
    });

    test('returns empty for symbol with no bound wires', () => {
      expect(Wire.findWiresBoundToSymbol('s99', objects)).toHaveLength(0);
    });

    test('includes binding info in results', () => {
      const results = Wire.findWiresBoundToSymbol('s1', objects);
      expect(results[0]).toHaveProperty('wire');
      expect(results[0]).toHaveProperty('isStart');
      expect(results[0]).toHaveProperty('binding');
    });
  });

  describe('findWiresBoundToPin', () => {
    const objects = [
      createWire({ id: 'w1', startBinding: { symbolId: 's1', pinId: 'p1' } }),
      createWire({ id: 'w2', startBinding: { symbolId: 's1', pinId: 'p2' } }),
      createWire({ id: 'w3', endBinding: { symbolId: 's1', pinId: 'p1' } })
    ];

    test('finds wires bound to specific pin', () => {
      const results = Wire.findWiresBoundToPin('s1', 'p1', objects);
      expect(results).toHaveLength(2);
      expect(results.map(r => r.wire.id).sort()).toEqual(['w1', 'w3']);
    });
  });

  describe('findFloatingEndpointAtPoint', () => {
    const wire1 = createWire({
      id: 'w1',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      startBinding: null,
      endBinding: null
    });

    const wire2 = createWire({
      id: 'w2',
      points: [{ x: 5, y: 5 }, { x: 5, y: 10 }],
      startBinding: { symbolId: 's1', pinId: 'p1' },
      endBinding: null
    });

    const objects = [wire1, wire2];

    test('finds floating start endpoint', () => {
      const result = Wire.findFloatingEndpointAtPoint(0, 0, objects);
      expect(result).not.toBeNull();
      expect(result.wire.id).toBe('w1');
      expect(result.isStart).toBe(true);
    });

    test('finds floating end endpoint', () => {
      const result = Wire.findFloatingEndpointAtPoint(10, 0, objects);
      expect(result).not.toBeNull();
      expect(result.wire.id).toBe('w1');
      expect(result.isStart).toBe(false);
    });

    test('does not find bound endpoint', () => {
      const result = Wire.findFloatingEndpointAtPoint(5, 5, objects);
      expect(result).toBeNull();
    });

    test('returns null for point not at any endpoint', () => {
      expect(Wire.findFloatingEndpointAtPoint(100, 100, objects)).toBeNull();
    });
  });

  describe('isPointOnAnyWire', () => {
    const objects = [
      createWire({ id: 'w1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }),
      createWire({ id: 'w2', points: [{ x: 5, y: 0 }, { x: 5, y: 10 }] })
    ];

    test('returns true for point on wire', () => {
      expect(Wire.isPointOnAnyWire(3, 0, objects)).toBe(true);
    });

    test('returns false for point not on any wire', () => {
      expect(Wire.isPointOnAnyWire(3, 3, objects)).toBe(false);
    });

    test('excludes specified wire', () => {
      expect(Wire.isPointOnAnyWire(3, 0, objects, 'w1')).toBe(false);
    });
  });

  describe('findConnectedWires', () => {
    const wire1 = createWire({
      id: 'w1',
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }]
    });

    const wire2 = createWire({
      id: 'w2',
      points: [{ x: 5, y: 0 }, { x: 5, y: 5 }]
    });

    const wire3 = createWire({
      id: 'w3',
      points: [{ x: 10, y: 10 }, { x: 15, y: 10 }]
    });

    const objects = [wire1, wire2, wire3];

    test('finds connected wires', () => {
      const results = Wire.findConnectedWires(wire1, objects);
      expect(results).toHaveLength(1);
      expect(results[0].wire.id).toBe('w2');
      expect(results[0].sharedPoint).toEqual({ x: 5, y: 0 });
    });

    test('returns empty for isolated wire', () => {
      expect(Wire.findConnectedWires(wire3, objects)).toHaveLength(0);
    });
  });

  describe('mergeWires', () => {
    test('merges wires at shared endpoint', () => {
      const wire1 = createWire({
        id: 'w1',
        points: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
        net: 'VCC'
      });

      const wire2 = createWire({
        id: 'w2',
        points: [{ x: 5, y: 0 }, { x: 5, y: 5 }]
      });

      const merged = Wire.mergeWires(wire1, false, wire2, true);
      expect(merged.id).toBe('w1');
      expect(merged.points[0]).toEqual({ x: 0, y: 0 });
      expect(merged.points[merged.points.length - 1]).toEqual({ x: 5, y: 5 });
      expect(merged.net).toBe('VCC');
    });

    test('preserves bindings correctly', () => {
      const wire1 = createWire({
        id: 'w1',
        points: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
        startBinding: { symbolId: 's1', pinId: 'p1' }
      });

      const wire2 = createWire({
        id: 'w2',
        points: [{ x: 5, y: 0 }, { x: 5, y: 5 }],
        endBinding: { symbolId: 's2', pinId: 'p2' }
      });

      const merged = Wire.mergeWires(wire1, false, wire2, true);
      expect(merged.startBinding).toEqual({ symbolId: 's1', pinId: 'p1' });
      expect(merged.endBinding).toEqual({ symbolId: 's2', pinId: 'p2' });
    });
  });

  describe('extendWire', () => {
    const wire = createWire({
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
      startBinding: { symbolId: 's1', pinId: 'p1' }
    });

    test('extends wire from end', () => {
      const newPoints = [{ x: 5, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 5 }];
      const extended = Wire.extendWire(wire, false, newPoints, { symbolId: 's2', pinId: 'p2' });

      expect(extended.points[0]).toEqual({ x: 0, y: 0 });
      expect(extended.points[extended.points.length - 1]).toEqual({ x: 10, y: 5 });
      expect(extended.startBinding).toEqual({ symbolId: 's1', pinId: 'p1' });
      expect(extended.endBinding).toEqual({ symbolId: 's2', pinId: 'p2' });
    });
  });

  describe('updateEndpointPosition', () => {
    test('updates endpoint and maintains path', () => {
      const wire = createWire({
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 5 }
        ]
      });

      const newPoints = Wire.updateEndpointPosition(wire, true, { x: 2, y: 2 });
      expect(newPoints[0]).toEqual({ x: 2, y: 2 });
      expect(newPoints.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getEndpointExitDirection', () => {
    const wire = createWire({
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 }
      ]
    });

    test('returns direction from start endpoint', () => {
      expect(Wire.getEndpointExitDirection(wire, true)).toBe('right');
    });

    test('returns direction from end endpoint', () => {
      expect(Wire.getEndpointExitDirection(wire, false)).toBe('up');
    });
  });
});
