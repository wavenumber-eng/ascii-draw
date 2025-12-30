/**
 * IOverlayRenderer Interface Contract Tests
 *
 * These tests document the IOverlayRenderer interface contract and verify that
 * the base class correctly throws "not implemented" errors.
 *
 * The overlay renderer handles TRANSIENT UI ELEMENTS that are NEVER exported:
 * - Selection highlights and resize handles
 * - Marquee selection rectangles
 * - Tool previews (box preview, line rubber-banding)
 * - Connection hints and snap indicators
 * - Drag ghosts and feedback
 * - Inline editing cursors
 */

describe('IOverlayRenderer Interface', () => {
  let overlay;

  beforeEach(() => {
    overlay = new AsciiEditor.overlays.IOverlayRenderer();
  });

  describe('Lifecycle', () => {
    test('initialize() throws not implemented', () => {
      expect(() => overlay.initialize({}))
        .toThrow('IOverlayRenderer.initialize() not implemented');
    });

    test('dispose() does not throw by default', () => {
      expect(() => overlay.dispose()).not.toThrow();
    });
  });

  describe('Frame Management', () => {
    test('beginFrame() does not throw by default', () => {
      expect(() => overlay.beginFrame()).not.toThrow();
    });

    test('endFrame() does not throw by default', () => {
      expect(() => overlay.endFrame()).not.toThrow();
    });

    test('clear() throws not implemented', () => {
      expect(() => overlay.clear())
        .toThrow('IOverlayRenderer.clear() not implemented');
    });
  });

  describe('Selection Overlays', () => {
    test('drawSelectionHighlight() throws not implemented', () => {
      const obj = { id: 'test', x: 0, y: 0, width: 5, height: 3 };
      expect(() => overlay.drawSelectionHighlight(obj))
        .toThrow('IOverlayRenderer.drawSelectionHighlight() not implemented');
    });

    test('drawMultiSelectionBox() throws not implemented', () => {
      const bounds = { x: 0, y: 0, width: 10, height: 10 };
      expect(() => overlay.drawMultiSelectionBox(bounds))
        .toThrow('IOverlayRenderer.drawMultiSelectionBox() not implemented');
    });

    test('drawResizeHandles() throws not implemented', () => {
      const obj = { id: 'test' };
      const handles = [{ type: 'nw', col: 0, row: 0 }];
      expect(() => overlay.drawResizeHandles(obj, handles))
        .toThrow('IOverlayRenderer.drawResizeHandles() not implemented');
    });
  });

  describe('Marquee Selection', () => {
    test('drawMarquee() throws not implemented', () => {
      const bounds = { x: 0, y: 0, width: 5, height: 5 };
      expect(() => overlay.drawMarquee(bounds, 'enclosed'))
        .toThrow('IOverlayRenderer.drawMarquee() not implemented');
    });
  });

  describe('Tool Hints and Previews', () => {
    test('drawToolPreview() throws not implemented', () => {
      const preview = { type: 'box', bounds: { x: 0, y: 0, width: 5, height: 3 } };
      expect(() => overlay.drawToolPreview(preview))
        .toThrow('IOverlayRenderer.drawToolPreview() not implemented');
    });

    test('drawSnapIndicator() is optional (no-op by default)', () => {
      expect(() => overlay.drawSnapIndicator(5, 5)).not.toThrow();
    });

    test('drawConnectionHint() is optional (no-op by default)', () => {
      expect(() => overlay.drawConnectionHint({ col: 5, row: 5 }, 'PIN')).not.toThrow();
    });

    test('drawHoverHighlight() is optional (no-op by default)', () => {
      const obj = { id: 'test' };
      expect(() => overlay.drawHoverHighlight(obj)).not.toThrow();
    });
  });

  describe('Drag Feedback', () => {
    test('drawDragGhost() is optional (no-op by default)', () => {
      const objects = [{ id: 'test', x: 0, y: 0 }];
      const offset = { col: 5, row: 5 };
      expect(() => overlay.drawDragGhost(objects, offset)).not.toThrow();
    });

    test('drawRubberBand() is optional (no-op by default)', () => {
      const start = { col: 0, row: 0 };
      const end = { col: 10, row: 10 };
      expect(() => overlay.drawRubberBand(start, end, 'single')).not.toThrow();
    });
  });

  describe('Inline Editing', () => {
    test('drawTextCursor() is optional (no-op by default)', () => {
      expect(() => overlay.drawTextCursor(5, 5, true)).not.toThrow();
    });

    test('drawTextSelection() is optional (no-op by default)', () => {
      const start = { col: 0, row: 0 };
      const end = { col: 10, row: 0 };
      expect(() => overlay.drawTextSelection(start, end)).not.toThrow();
    });
  });

  describe('Vertex/Segment Handles', () => {
    test('drawVertexHandle() throws not implemented', () => {
      expect(() => overlay.drawVertexHandle(5, 5, 'endpoint'))
        .toThrow('IOverlayRenderer.drawVertexHandle() not implemented');
    });

    test('drawSegmentHandle() throws not implemented', () => {
      expect(() => overlay.drawSegmentHandle(5, 5, 'h'))
        .toThrow('IOverlayRenderer.drawSegmentHandle() not implemented');
    });
  });

  describe('Pin Handles', () => {
    test('drawPinHandle() is optional (no-op by default)', () => {
      expect(() => overlay.drawPinHandle({ col: 5, row: 5 }, false)).not.toThrow();
    });

    test('drawPinDropTarget() is optional (no-op by default)', () => {
      expect(() => overlay.drawPinDropTarget({ col: 5, row: 5 }, true)).not.toThrow();
    });
  });

  describe('3D Configuration', () => {
    test('setScreenAligned() is no-op by default', () => {
      expect(() => overlay.setScreenAligned(true)).not.toThrow();
    });

    test('isScreenAligned() returns true by default', () => {
      expect(overlay.isScreenAligned()).toBe(true);
    });
  });

  describe('Capabilities', () => {
    test('getType() throws not implemented', () => {
      expect(() => overlay.getType())
        .toThrow('IOverlayRenderer.getType() not implemented');
    });
  });
});
