/**
 * IRenderBackend Interface Contract Tests
 *
 * These tests document the IRenderBackend interface contract and verify that
 * the base class correctly throws "not implemented" errors.
 *
 * The render backend handles DOCUMENT CONTENT only (cells, objects, grid).
 * UI overlays are handled by IOverlayRenderer.
 */

describe('IRenderBackend Interface', () => {
  let backend;

  beforeEach(() => {
    backend = new AsciiEditor.backends.IRenderBackend();
  });

  describe('Lifecycle', () => {
    test('initialize() throws not implemented', () => {
      expect(() => backend.initialize({}))
        .toThrow('IRenderBackend.initialize() not implemented');
    });

    test('dispose() does not throw by default', () => {
      // Default is no-op - override if cleanup needed
      expect(() => backend.dispose()).not.toThrow();
    });
  });

  describe('Frame Management', () => {
    test('beginFrame() does not throw by default', () => {
      expect(() => backend.beginFrame()).not.toThrow();
    });

    test('endFrame() does not throw by default', () => {
      expect(() => backend.endFrame()).not.toThrow();
    });

    test('clear() throws not implemented', () => {
      expect(() => backend.clear())
        .toThrow('IRenderBackend.clear() not implemented');
    });
  });

  describe('Cell-Level Drawing', () => {
    test('drawCell() throws not implemented', () => {
      expect(() => backend.drawCell(0, 0, 'A'))
        .toThrow('IRenderBackend.drawCell() not implemented');
    });

    test('drawText() throws not implemented', () => {
      expect(() => backend.drawText(0, 0, 'Hello'))
        .toThrow('IRenderBackend.drawText() not implemented');
    });
  });

  describe('Object-Level Drawing', () => {
    test('drawBox() throws not implemented', () => {
      const box = { x: 0, y: 0, width: 5, height: 3 };
      expect(() => backend.drawBox(box))
        .toThrow('IRenderBackend.drawBox() not implemented');
    });

    test('drawLine() throws not implemented', () => {
      const line = { points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] };
      expect(() => backend.drawLine(line))
        .toThrow('IRenderBackend.drawLine() not implemented');
    });

    test('drawWire() defaults to drawLine()', () => {
      // drawWire calls drawLine by default, which throws
      const wire = { points: [{ x: 0, y: 0 }, { x: 5, y: 5 }], net: 'VCC' };
      expect(() => backend.drawWire(wire))
        .toThrow('IRenderBackend.drawLine() not implemented');
    });

    test('drawSymbol() throws not implemented', () => {
      const symbol = { x: 0, y: 0, width: 10, height: 5 };
      expect(() => backend.drawSymbol(symbol))
        .toThrow('IRenderBackend.drawSymbol() not implemented');
    });

    test('drawJunction() throws not implemented', () => {
      const junction = { x: 5, y: 5 };
      expect(() => backend.drawJunction(junction))
        .toThrow('IRenderBackend.drawJunction() not implemented');
    });

    test('drawWireJunction() defaults to drawJunction()', () => {
      const junction = { x: 5, y: 5 };
      expect(() => backend.drawWireJunction(junction))
        .toThrow('IRenderBackend.drawJunction() not implemented');
    });

    test('drawWireNoConnect() throws not implemented', () => {
      const noConnect = { x: 5, y: 5 };
      expect(() => backend.drawWireNoConnect(noConnect))
        .toThrow('IRenderBackend.drawWireNoConnect() not implemented');
    });

    test('drawTextObject() calls drawText()', () => {
      const textObj = { x: 0, y: 0, text: 'Hello' };
      expect(() => backend.drawTextObject(textObj))
        .toThrow('IRenderBackend.drawText() not implemented');
    });
  });

  describe('Grid', () => {
    test('drawGrid() throws not implemented', () => {
      expect(() => backend.drawGrid(80, 40, true))
        .toThrow('IRenderBackend.drawGrid() not implemented');
    });
  });

  describe('Style Support', () => {
    test('getCharacterSet() throws not implemented', () => {
      expect(() => backend.getCharacterSet())
        .toThrow('IRenderBackend.getCharacterSet() not implemented');
    });

    test('getSupportedBorderStyles() returns default styles', () => {
      const styles = backend.getSupportedBorderStyles();
      expect(styles).toContain('single');
      expect(styles).toContain('double');
      expect(styles).toContain('thick');
      expect(styles).toContain('none');
    });

    test('getSupportedFillPatterns() returns default patterns', () => {
      const patterns = backend.getSupportedFillPatterns();
      expect(patterns).toContain('none');
      expect(patterns).toContain('light');
      expect(patterns).toContain('medium');
      expect(patterns).toContain('dark');
      expect(patterns).toContain('solid');
      expect(patterns).toContain('dots');
    });
  });

  describe('Capabilities', () => {
    test('supports3D() returns false by default', () => {
      expect(backend.supports3D()).toBe(false);
    });

    test('getType() throws not implemented', () => {
      expect(() => backend.getType())
        .toThrow('IRenderBackend.getType() not implemented');
    });
  });
});
