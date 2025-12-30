/**
 * IViewport Interface Contract Tests
 *
 * These tests document the IViewport interface contract and verify that
 * the base class correctly throws "not implemented" errors.
 *
 * When implementing a new viewport (e.g., Canvas2DViewport, ThreeJSViewport),
 * use these tests as a reference for required methods.
 */

describe('IViewport Interface', () => {
  let viewport;

  beforeEach(() => {
    viewport = new AsciiEditor.viewport.IViewport();
  });

  describe('Lifecycle', () => {
    test('attach() throws not implemented', () => {
      // Pass a mock container - in Node.js we don't have document
      const mockContainer = { appendChild: () => {} };
      expect(() => viewport.attach(mockContainer))
        .toThrow('IViewport.attach() not implemented');
    });

    test('detach() throws not implemented', () => {
      expect(() => viewport.detach())
        .toThrow('IViewport.detach() not implemented');
    });
  });

  describe('Coordinate Transforms', () => {
    test('screenToCell() throws not implemented', () => {
      expect(() => viewport.screenToCell(100, 100))
        .toThrow('IViewport.screenToCell() not implemented');
    });

    test('cellToScreen() throws not implemented', () => {
      expect(() => viewport.cellToScreen(5, 5))
        .toThrow('IViewport.cellToScreen() not implemented');
    });

    test('getCellBounds() throws not implemented', () => {
      expect(() => viewport.getCellBounds(0, 0))
        .toThrow('IViewport.getCellBounds() not implemented');
    });
  });

  describe('Cell Dimensions', () => {
    test('setCellDimensions() throws not implemented', () => {
      expect(() => viewport.setCellDimensions(10, 20))
        .toThrow('IViewport.setCellDimensions() not implemented');
    });

    test('getCellDimensions() throws not implemented', () => {
      expect(() => viewport.getCellDimensions())
        .toThrow('IViewport.getCellDimensions() not implemented');
    });
  });

  describe('Navigation', () => {
    test('pan() throws not implemented', () => {
      expect(() => viewport.pan(10, 10))
        .toThrow('IViewport.pan() not implemented');
    });

    test('zoom() throws not implemented', () => {
      expect(() => viewport.zoom(1.5))
        .toThrow('IViewport.zoom() not implemented');
    });

    test('getZoom() throws not implemented', () => {
      expect(() => viewport.getZoom())
        .toThrow('IViewport.getZoom() not implemented');
    });

    test('resetView() throws not implemented', () => {
      expect(() => viewport.resetView())
        .toThrow('IViewport.resetView() not implemented');
    });
  });

  describe('3D Navigation (optional for 2D)', () => {
    test('setTilt() is no-op by default', () => {
      // Should not throw - default is no-op for 2D viewports
      expect(() => viewport.setTilt(45)).not.toThrow();
    });

    test('getTilt() returns 0 by default', () => {
      expect(viewport.getTilt()).toBe(0);
    });

    test('setIsometric() is no-op by default', () => {
      expect(() => viewport.setIsometric(true)).not.toThrow();
    });

    test('isIsometric() returns false by default', () => {
      expect(viewport.isIsometric()).toBe(false);
    });

    test('setCameraAngle() is no-op by default', () => {
      expect(() => viewport.setCameraAngle(30)).not.toThrow();
    });
  });

  describe('Rendering', () => {
    test('setRenderBackend() throws not implemented', () => {
      expect(() => viewport.setRenderBackend({}))
        .toThrow('IViewport.setRenderBackend() not implemented');
    });

    test('getRenderBackend() throws not implemented', () => {
      expect(() => viewport.getRenderBackend())
        .toThrow('IViewport.getRenderBackend() not implemented');
    });

    test('setOverlayRenderer() throws not implemented', () => {
      expect(() => viewport.setOverlayRenderer({}))
        .toThrow('IViewport.setOverlayRenderer() not implemented');
    });

    test('getOverlayRenderer() throws not implemented', () => {
      expect(() => viewport.getOverlayRenderer())
        .toThrow('IViewport.getOverlayRenderer() not implemented');
    });

    test('render() throws not implemented', () => {
      expect(() => viewport.render({}, {}))
        .toThrow('IViewport.render() not implemented');
    });

    test('requestRender() throws not implemented', () => {
      expect(() => viewport.requestRender())
        .toThrow('IViewport.requestRender() not implemented');
    });
  });

  describe('Events', () => {
    test('getEventTarget() throws not implemented', () => {
      expect(() => viewport.getEventTarget())
        .toThrow('IViewport.getEventTarget() not implemented');
    });

    test('getContainer() throws not implemented', () => {
      expect(() => viewport.getContainer())
        .toThrow('IViewport.getContainer() not implemented');
    });
  });

  describe('Grid', () => {
    test('setGridVisible() throws not implemented', () => {
      expect(() => viewport.setGridVisible(true))
        .toThrow('IViewport.setGridVisible() not implemented');
    });

    test('isGridVisible() throws not implemented', () => {
      expect(() => viewport.isGridVisible())
        .toThrow('IViewport.isGridVisible() not implemented');
    });

    test('setGridDimensions() throws not implemented', () => {
      expect(() => viewport.setGridDimensions(80, 40))
        .toThrow('IViewport.setGridDimensions() not implemented');
    });

    test('getGridDimensions() throws not implemented', () => {
      expect(() => viewport.getGridDimensions())
        .toThrow('IViewport.getGridDimensions() not implemented');
    });
  });

  describe('Capabilities', () => {
    test('supports3D() returns false by default', () => {
      expect(viewport.supports3D()).toBe(false);
    });

    test('getType() throws not implemented', () => {
      expect(() => viewport.getType())
        .toThrow('IViewport.getType() not implemented');
    });
  });
});
