/**
 * Tests for DerivedStateComputer - derived objects computation
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Set up minimal DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;

// Load dependencies
const utilsCode = fs.readFileSync(path.join(__dirname, '../js/core/utils.js'), 'utf8');
const debugCode = fs.readFileSync(path.join(__dirname, '../js/core/debug.js'), 'utf8');
const derivedCode = fs.readFileSync(path.join(__dirname, '../js/core/DerivedStateComputer.js'), 'utf8');

eval(debugCode);
eval(utilsCode);
eval(derivedCode);

const DerivedStateComputer = AsciiEditor.core.DerivedStateComputer;

describe('DerivedStateComputer', () => {
  let computer;

  beforeEach(() => {
    computer = new DerivedStateComputer();
  });

  describe('compute()', () => {
    test('returns empty derived objects for empty input', () => {
      const result = computer.compute([]);
      expect(result.derivedObjects).toEqual([]);
      expect(result.renderList).toEqual([]);
    });

    test('returns primary objects in renderList when no derived needed', () => {
      const objects = [
        { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3 }
      ];
      const result = computer.compute(objects);
      expect(result.derivedObjects).toEqual([]);
      expect(result.renderList).toHaveLength(1);
      expect(result.renderList[0].id).toBe('box-1');
    });
  });

  describe('computeLineJunctions()', () => {
    test('no junction for single line', () => {
      const lines = [{
        id: 'line-1',
        type: 'line',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        style: 'single'
      }];
      const junctions = computer.computeLineJunctions(lines);
      expect(junctions).toEqual([]);
    });

    test('no junction when lines share only endpoints (both endpoints)', () => {
      // Two lines meeting at their endpoints should NOT create a junction
      // (they should be merged instead)
      const lines = [
        { id: 'line-1', type: 'line', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }], style: 'single' },
        { id: 'line-2', type: 'line', points: [{ x: 5, y: 0 }, { x: 10, y: 0 }], style: 'single' }
      ];
      const junctions = computer.computeLineJunctions(lines);
      expect(junctions).toEqual([]);
    });

    test('creates junction for T-intersection (endpoint on segment)', () => {
      // Line 2 endpoint lands on Line 1 segment (T-junction)
      const lines = [
        { id: 'line-1', type: 'line', points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], style: 'single' },
        { id: 'line-2', type: 'line', points: [{ x: 5, y: 0 }, { x: 5, y: 5 }], style: 'single' }
      ];
      const junctions = computer.computeLineJunctions(lines);
      expect(junctions).toHaveLength(1);
      expect(junctions[0].x).toBe(5);
      expect(junctions[0].y).toBe(5);
      expect(junctions[0].type).toBe('junction');
      expect(junctions[0].derived).toBe(true);
      expect(junctions[0].connectedLines).toContain('line-1');
      expect(junctions[0].connectedLines).toContain('line-2');
    });

    test('creates junction for cross intersection (vertex on segment)', () => {
      // Vertical line has vertex at (5,5), horizontal line passes through
      const lines = [
        { id: 'line-h', type: 'line', points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], style: 'single' },
        { id: 'line-v', type: 'line', points: [{ x: 5, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 10 }], style: 'single' }
      ];
      const junctions = computer.computeLineJunctions(lines);
      expect(junctions).toHaveLength(1);
      expect(junctions[0].x).toBe(5);
      expect(junctions[0].y).toBe(5);
    });

    test('junction inherits style from connected lines', () => {
      const lines = [
        { id: 'line-1', type: 'line', points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], style: 'double' },
        { id: 'line-2', type: 'line', points: [{ x: 5, y: 0 }, { x: 5, y: 5 }], style: 'single' }
      ];
      const junctions = computer.computeLineJunctions(lines);
      expect(junctions[0].style).toBe('double');
    });

    test('multiple junctions for complex line arrangement', () => {
      // Horizontal line with two vertical lines touching it
      const lines = [
        { id: 'line-h', type: 'line', points: [{ x: 0, y: 5 }, { x: 20, y: 5 }], style: 'single' },
        { id: 'line-v1', type: 'line', points: [{ x: 5, y: 0 }, { x: 5, y: 5 }], style: 'single' },
        { id: 'line-v2', type: 'line', points: [{ x: 15, y: 5 }, { x: 15, y: 10 }], style: 'single' }
      ];
      const junctions = computer.computeLineJunctions(lines);
      expect(junctions).toHaveLength(2);
      expect(junctions.map(j => j.x).sort((a, b) => a - b)).toEqual([5, 15]);
    });
  });

  describe('computeWireJunctions()', () => {
    test('no junction for single wire', () => {
      const wires = [{
        id: 'wire-1',
        type: 'wire',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        style: 'single'
      }];
      const junctions = computer.computeWireJunctions(wires);
      expect(junctions).toEqual([]);
    });

    test('creates junction when wire endpoint lands on another wire segment', () => {
      const wires = [
        { id: 'wire-1', type: 'wire', points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], style: 'single' },
        { id: 'wire-2', type: 'wire', points: [{ x: 5, y: 0 }, { x: 5, y: 5 }], style: 'single' }
      ];
      const junctions = computer.computeWireJunctions(wires);
      expect(junctions).toHaveLength(1);
      expect(junctions[0].type).toBe('wire-junction');
      expect(junctions[0].x).toBe(5);
      expect(junctions[0].y).toBe(5);
    });

    test('creates junction when wire vertex lands on another wire segment', () => {
      // Wire with intermediate vertex landing on another wire
      const wires = [
        { id: 'wire-h', type: 'wire', points: [{ x: 0, y: 5 }, { x: 20, y: 5 }], style: 'single' },
        { id: 'wire-L', type: 'wire', points: [{ x: 10, y: 0 }, { x: 10, y: 5 }, { x: 15, y: 5 }], style: 'single' }
      ];
      const junctions = computer.computeWireJunctions(wires);
      // Junction at (10,5) where wire-L vertex is on wire-h
      // Also junction at (15,5) where both wires share point
      expect(junctions.length).toBeGreaterThanOrEqual(1);
      expect(junctions.some(j => j.x === 10 && j.y === 5)).toBe(true);
    });

    test('NO junction for crossing wires (segment crossing segment)', () => {
      // Two wires crossing but no endpoint/vertex at the cross point
      const wires = [
        { id: 'wire-h', type: 'wire', points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], style: 'single' },
        { id: 'wire-v', type: 'wire', points: [{ x: 5, y: 0 }, { x: 5, y: 10 }], style: 'single' }
      ];
      const junctions = computer.computeWireJunctions(wires);
      // No junction because neither wire has an endpoint/vertex at (5,5)
      expect(junctions).toEqual([]);
    });

    test('propagates net name from connected wires', () => {
      const wires = [
        { id: 'wire-1', type: 'wire', points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], style: 'single', net: 'VCC' },
        { id: 'wire-2', type: 'wire', points: [{ x: 5, y: 0 }, { x: 5, y: 5 }], style: 'single' }
      ];
      const junctions = computer.computeWireJunctions(wires);
      expect(junctions[0].net).toBe('VCC');
    });

    test('junction includes all connected wire IDs', () => {
      // wire-1 has segment through (5,5), wire-2 and wire-3 have endpoints at (5,5)
      // Junction created because wire-1 has non-endpoint at (5,5)
      const wires = [
        { id: 'wire-1', type: 'wire', points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], style: 'single' },
        { id: 'wire-2', type: 'wire', points: [{ x: 5, y: 0 }, { x: 5, y: 5 }], style: 'single' },
        { id: 'wire-3', type: 'wire', points: [{ x: 5, y: 5 }, { x: 5, y: 10 }], style: 'single' }
      ];
      const junctions = computer.computeWireJunctions(wires);
      expect(junctions).toHaveLength(1);
      expect(junctions[0].connectedWires).toHaveLength(3);
    });

    test('NO junction when all wires share only endpoints (merge candidate)', () => {
      // Two wires meeting at their endpoints - should NOT create junction
      // (this is a merge candidate, like when extending a wire to another wire's end)
      const wires = [
        { id: 'wire-1', type: 'wire', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }], style: 'single' },
        { id: 'wire-2', type: 'wire', points: [{ x: 5, y: 0 }, { x: 10, y: 0 }], style: 'single' }
      ];
      const junctions = computer.computeWireJunctions(wires);
      expect(junctions).toEqual([]);
    });
  });

  describe('computeWireNoConnects()', () => {
    test('creates no-connect for unbound wire endpoints', () => {
      const wires = [{
        id: 'wire-1',
        type: 'wire',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        style: 'single'
        // No startBinding, no endBinding
      }];
      const wireJunctions = [];
      const noConnects = computer.computeWireNoConnects(wires, wireJunctions);
      expect(noConnects).toHaveLength(2);
      expect(noConnects[0].type).toBe('wire-noconnect');
      expect(noConnects[0].endpoint).toBe('start');
      expect(noConnects[1].endpoint).toBe('end');
    });

    test('no no-connect for bound start endpoint', () => {
      const wires = [{
        id: 'wire-1',
        type: 'wire',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        style: 'single',
        startBinding: { symbolId: 'sym-1', pinId: 'pin-1' }
      }];
      const wireJunctions = [];
      const noConnects = computer.computeWireNoConnects(wires, wireJunctions);
      expect(noConnects).toHaveLength(1);
      expect(noConnects[0].endpoint).toBe('end');
    });

    test('no no-connect for bound end endpoint', () => {
      const wires = [{
        id: 'wire-1',
        type: 'wire',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        style: 'single',
        endBinding: { symbolId: 'sym-1', pinId: 'pin-1' }
      }];
      const wireJunctions = [];
      const noConnects = computer.computeWireNoConnects(wires, wireJunctions);
      expect(noConnects).toHaveLength(1);
      expect(noConnects[0].endpoint).toBe('start');
    });

    test('no no-connect when both endpoints bound', () => {
      const wires = [{
        id: 'wire-1',
        type: 'wire',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        style: 'single',
        startBinding: { symbolId: 'sym-1', pinId: 'pin-1' },
        endBinding: { symbolId: 'sym-2', pinId: 'pin-2' }
      }];
      const wireJunctions = [];
      const noConnects = computer.computeWireNoConnects(wires, wireJunctions);
      expect(noConnects).toHaveLength(0);
    });

    test('no no-connect at wire junction position', () => {
      const wires = [{
        id: 'wire-1',
        type: 'wire',
        points: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
        style: 'single'
        // Endpoint at (5,0), unbound
      }];
      // But there's a junction at (5,0)
      const wireJunctions = [{ x: 5, y: 0, type: 'wire-junction' }];
      const noConnects = computer.computeWireNoConnects(wires, wireJunctions);
      // Only start should have no-connect, end is at junction
      expect(noConnects).toHaveLength(1);
      expect(noConnects[0].x).toBe(0);
      expect(noConnects[0].y).toBe(0);
    });

    test('no-connect has correct wireId and endpoint references', () => {
      const wires = [{
        id: 'my-wire-123',
        type: 'wire',
        points: [{ x: 3, y: 7 }, { x: 15, y: 7 }],
        style: 'single'
      }];
      const noConnects = computer.computeWireNoConnects(wires, []);
      expect(noConnects[0].wireId).toBe('my-wire-123');
      expect(noConnects[0].x).toBe(3);
      expect(noConnects[0].y).toBe(7);
      expect(noConnects[1].wireId).toBe('my-wire-123');
      expect(noConnects[1].x).toBe(15);
      expect(noConnects[1].y).toBe(7);
    });

    test('no no-connect at shared endpoint (two wires meeting at endpoints)', () => {
      // Two wires with endpoints at the same position - neither should have no-connect there
      const wires = [
        { id: 'wire-1', type: 'wire', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }], style: 'single' },
        { id: 'wire-2', type: 'wire', points: [{ x: 5, y: 0 }, { x: 10, y: 0 }], style: 'single' }
      ];
      const noConnects = computer.computeWireNoConnects(wires, []);
      // Only 2 no-connects: wire-1 start (0,0) and wire-2 end (10,0)
      // NOT at (5,0) where they meet
      expect(noConnects).toHaveLength(2);
      expect(noConnects.some(nc => nc.x === 5 && nc.y === 0)).toBe(false);
      expect(noConnects.some(nc => nc.x === 0 && nc.y === 0)).toBe(true);
      expect(noConnects.some(nc => nc.x === 10 && nc.y === 0)).toBe(true);
    });
  });

  describe('buildRenderList()', () => {
    test('sorts by type render order', () => {
      const primary = [
        { id: 'sym-1', type: 'symbol' },  // order 50
        { id: 'line-1', type: 'line' },    // order 20
        { id: 'box-1', type: 'box' }       // order 40
      ];
      const derived = [];
      const renderList = computer.buildRenderList(primary, derived);
      expect(renderList[0].type).toBe('line');
      expect(renderList[1].type).toBe('box');
      expect(renderList[2].type).toBe('symbol');
    });

    test('includes derived objects in correct order', () => {
      const primary = [
        { id: 'wire-1', type: 'wire' }  // order 30
      ];
      const derived = [
        { id: 'wjunc-1', type: 'wire-junction' },   // order 35
        { id: 'wnc-1', type: 'wire-noconnect' }     // order 36
      ];
      const renderList = computer.buildRenderList(primary, derived);
      expect(renderList[0].type).toBe('wire');
      expect(renderList[1].type).toBe('wire-junction');
      expect(renderList[2].type).toBe('wire-noconnect');
    });

    test('sorts by zIndex within same type', () => {
      const primary = [
        { id: 'box-1', type: 'box', zIndex: 5 },
        { id: 'box-2', type: 'box', zIndex: 2 },
        { id: 'box-3', type: 'box', zIndex: 10 }
      ];
      const renderList = computer.buildRenderList(primary, []);
      expect(renderList[0].id).toBe('box-2');
      expect(renderList[1].id).toBe('box-1');
      expect(renderList[2].id).toBe('box-3');
    });

    test('handles missing zIndex (defaults to 0)', () => {
      const primary = [
        { id: 'box-1', type: 'box', zIndex: 5 },
        { id: 'box-2', type: 'box' },  // no zIndex
        { id: 'box-3', type: 'box', zIndex: -2 }
      ];
      const renderList = computer.buildRenderList(primary, []);
      expect(renderList[0].id).toBe('box-3');  // -2
      expect(renderList[1].id).toBe('box-2');  // 0 (default)
      expect(renderList[2].id).toBe('box-1');  // 5
    });

    test('unknown types get default order 50', () => {
      const primary = [
        { id: 'unknown-1', type: 'foobar' },
        { id: 'line-1', type: 'line' },          // order 20
        { id: 'text-1', type: 'text' }           // order 60
      ];
      const renderList = computer.buildRenderList(primary, []);
      expect(renderList[0].type).toBe('line');    // 20
      expect(renderList[1].type).toBe('foobar');  // 50 (default)
      expect(renderList[2].type).toBe('text');    // 60
    });
  });

  describe('_pointOnSegment()', () => {
    test('point on horizontal segment', () => {
      expect(computer._pointOnSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true);
    });

    test('point at segment endpoints', () => {
      expect(computer._pointOnSegment({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true);
      expect(computer._pointOnSegment({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true);
    });

    test('point on vertical segment', () => {
      expect(computer._pointOnSegment({ x: 0, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toBe(true);
    });

    test('point not on segment (wrong row)', () => {
      expect(computer._pointOnSegment({ x: 5, y: 1 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(false);
    });

    test('point not on segment (outside range)', () => {
      expect(computer._pointOnSegment({ x: 15, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(false);
    });

    test('diagonal segment (not orthogonal) returns false', () => {
      expect(computer._pointOnSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 10 })).toBe(false);
    });
  });

  describe('integration: compute() with full scenario', () => {
    test('schematic with wires, junctions, and no-connects', () => {
      const objects = [
        // Symbol
        { id: 'sym-1', type: 'symbol', x: 0, y: 0, width: 5, height: 5 },
        // Wire from symbol (bound start) to junction
        {
          id: 'wire-1', type: 'wire',
          points: [{ x: 5, y: 2 }, { x: 10, y: 2 }],
          startBinding: { symbolId: 'sym-1', pinId: 'pin-1' }
        },
        // Wire forming T-junction
        {
          id: 'wire-2', type: 'wire',
          points: [{ x: 10, y: 0 }, { x: 10, y: 2 }, { x: 10, y: 5 }]
        },
        // Floating wire
        {
          id: 'wire-3', type: 'wire',
          points: [{ x: 15, y: 2 }, { x: 20, y: 2 }]
        }
      ];

      const result = computer.compute(objects);

      // Should have junction at (10, 2) where wire-1 end meets wire-2 segment
      const junctions = result.derivedObjects.filter(o => o.type === 'wire-junction');
      expect(junctions.length).toBeGreaterThanOrEqual(1);
      expect(junctions.some(j => j.x === 10 && j.y === 2)).toBe(true);

      // wire-1: start bound, end at junction -> no no-connects
      // wire-2: unbound endpoints at (10,0) and (10,5) -> 2 no-connects
      // wire-3: unbound at both ends -> 2 no-connects
      const noConnects = result.derivedObjects.filter(o => o.type === 'wire-noconnect');
      expect(noConnects.length).toBe(4);

      // Render list should have everything in order
      expect(result.renderList.length).toBe(objects.length + result.derivedObjects.length);
    });
  });
});
