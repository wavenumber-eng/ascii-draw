/**
 * IViewport - Abstract viewport interface
 *
 * Implements: VIEW-1, VIEW-2, VIEW-3, VIEW-4
 *
 * The viewport abstraction handles all interaction between the user and the
 * rendering surface. It provides coordinate transforms, navigation, and
 * manages both the render backend (content) and overlay renderer (UI).
 *
 * Implementations:
 * - Canvas2DViewport: Traditional 2D canvas rendering
 * - ThreeJSViewport: Three.js 3D workspace with tilt/isometric support
 *
 * Tools should NEVER access the canvas directly. They receive cell coordinates
 * from viewport.screenToCell() and operate purely in cell space.
 */
var AsciiEditor = AsciiEditor || {};
AsciiEditor.viewport = AsciiEditor.viewport || {};

AsciiEditor.viewport.IViewport = class IViewport {

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Attach viewport to a container element
   * @param {HTMLElement} container - The container to attach to
   */
  attach(container) {
    throw new Error('IViewport.attach() not implemented');
  }

  /**
   * Detach viewport and clean up resources
   */
  detach() {
    throw new Error('IViewport.detach() not implemented');
  }

  // ============================================================
  // Coordinate Transforms (THE KEY ABSTRACTION)
  // ============================================================

  /**
   * Convert screen coordinates to cell coordinates
   * This is the primary method tools use for all mouse interactions
   *
   * @param {number} screenX - Screen X coordinate (relative to viewport)
   * @param {number} screenY - Screen Y coordinate (relative to viewport)
   * @returns {{ col: number, row: number }} Cell coordinates
   */
  screenToCell(screenX, screenY) {
    throw new Error('IViewport.screenToCell() not implemented');
  }

  /**
   * Convert cell coordinates to screen coordinates
   * Used for positioning UI elements and hit testing
   *
   * @param {number} col - Cell column
   * @param {number} row - Cell row
   * @returns {{ x: number, y: number }} Screen coordinates
   */
  cellToScreen(col, row) {
    throw new Error('IViewport.cellToScreen() not implemented');
  }

  /**
   * Get the bounding rectangle of a cell in screen coordinates
   *
   * @param {number} col - Cell column
   * @param {number} row - Cell row
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  getCellBounds(col, row) {
    throw new Error('IViewport.getCellBounds() not implemented');
  }

  // ============================================================
  // Cell Dimensions
  // ============================================================

  /**
   * Set cell dimensions (for different fonts/styles)
   *
   * @param {number} width - Cell width in pixels
   * @param {number} height - Cell height in pixels
   */
  setCellDimensions(width, height) {
    throw new Error('IViewport.setCellDimensions() not implemented');
  }

  /**
   * Get current cell dimensions
   *
   * @returns {{ width: number, height: number }}
   */
  getCellDimensions() {
    throw new Error('IViewport.getCellDimensions() not implemented');
  }

  // ============================================================
  // Navigation
  // ============================================================

  /**
   * Pan the viewport by a delta
   *
   * @param {number} dx - Delta X in screen pixels
   * @param {number} dy - Delta Y in screen pixels
   */
  pan(dx, dy) {
    throw new Error('IViewport.pan() not implemented');
  }

  /**
   * Zoom the viewport
   *
   * @param {number} factor - Zoom factor (>1 zooms in, <1 zooms out)
   * @param {number} [centerX] - Zoom center X (screen coords), defaults to center
   * @param {number} [centerY] - Zoom center Y (screen coords), defaults to center
   */
  zoom(factor, centerX, centerY) {
    throw new Error('IViewport.zoom() not implemented');
  }

  /**
   * Get current zoom level
   *
   * @returns {number} Current zoom factor (1.0 = 100%)
   */
  getZoom() {
    throw new Error('IViewport.getZoom() not implemented');
  }

  /**
   * Reset view to default (no pan, 100% zoom, top-down for 3D)
   */
  resetView() {
    throw new Error('IViewport.resetView() not implemented');
  }

  // ============================================================
  // 3D-Specific Navigation (no-op for 2D viewports)
  // ============================================================

  /**
   * Set camera tilt angle (drafting table effect)
   * No-op for 2D viewports
   *
   * @param {number} angle - Tilt angle in degrees (0 = top-down, 90 = side view)
   */
  setTilt(angle) {
    // No-op for 2D - override in ThreeJSViewport
  }

  /**
   * Get current tilt angle
   *
   * @returns {number} Tilt angle in degrees (0 for 2D viewports)
   */
  getTilt() {
    return 0;
  }

  /**
   * Enable/disable isometric view preset
   * No-op for 2D viewports
   *
   * @param {boolean} enabled - Whether to use isometric view
   */
  setIsometric(enabled) {
    // No-op for 2D - override in ThreeJSViewport
  }

  /**
   * Check if isometric view is enabled
   *
   * @returns {boolean} Always false for 2D viewports
   */
  isIsometric() {
    return false;
  }

  /**
   * Set arbitrary camera rotation angle (around Z axis)
   * No-op for 2D viewports
   *
   * @param {number} angle - Rotation angle in degrees
   */
  setCameraAngle(angle) {
    // No-op for 2D - override in ThreeJSViewport
  }

  // ============================================================
  // Rendering
  // ============================================================

  /**
   * Set the render backend for content (cells, objects)
   *
   * @param {IRenderBackend} backend - The render backend to use
   */
  setRenderBackend(backend) {
    throw new Error('IViewport.setRenderBackend() not implemented');
  }

  /**
   * Get the current render backend
   *
   * @returns {IRenderBackend}
   */
  getRenderBackend() {
    throw new Error('IViewport.getRenderBackend() not implemented');
  }

  /**
   * Set the overlay renderer for UI elements
   *
   * @param {IOverlayRenderer} overlay - The overlay renderer to use
   */
  setOverlayRenderer(overlay) {
    throw new Error('IViewport.setOverlayRenderer() not implemented');
  }

  /**
   * Get the current overlay renderer
   *
   * @returns {IOverlayRenderer}
   */
  getOverlayRenderer() {
    throw new Error('IViewport.getOverlayRenderer() not implemented');
  }

  /**
   * Render the current state
   *
   * @param {Object} renderState - State to render
   * @param {Array} renderState.primaryObjects - User-authored objects
   * @param {Array} renderState.derivedObjects - Computed objects (junctions, etc.)
   * @param {Array} renderState.renderList - Sorted list for rendering
   * @param {Object} [overlayState] - Overlay state (selection, tool preview, etc.)
   */
  render(renderState, overlayState) {
    throw new Error('IViewport.render() not implemented');
  }

  /**
   * Request a render on the next animation frame
   * Use this instead of render() for frequent updates
   */
  requestRender() {
    throw new Error('IViewport.requestRender() not implemented');
  }

  // ============================================================
  // Events
  // ============================================================

  /**
   * Get the event target element for mouse/keyboard events
   * Tools should attach listeners to this element
   *
   * @returns {HTMLElement}
   */
  getEventTarget() {
    throw new Error('IViewport.getEventTarget() not implemented');
  }

  /**
   * Get the container element
   *
   * @returns {HTMLElement}
   */
  getContainer() {
    throw new Error('IViewport.getContainer() not implemented');
  }

  // ============================================================
  // Grid
  // ============================================================

  /**
   * Set grid visibility
   *
   * @param {boolean} visible - Whether to show the grid
   */
  setGridVisible(visible) {
    throw new Error('IViewport.setGridVisible() not implemented');
  }

  /**
   * Check if grid is visible
   *
   * @returns {boolean}
   */
  isGridVisible() {
    throw new Error('IViewport.isGridVisible() not implemented');
  }

  /**
   * Set grid dimensions (page size)
   *
   * @param {number} cols - Number of columns
   * @param {number} rows - Number of rows
   */
  setGridDimensions(cols, rows) {
    throw new Error('IViewport.setGridDimensions() not implemented');
  }

  /**
   * Get grid dimensions
   *
   * @returns {{ cols: number, rows: number }}
   */
  getGridDimensions() {
    throw new Error('IViewport.getGridDimensions() not implemented');
  }

  // ============================================================
  // Capabilities
  // ============================================================

  /**
   * Check if this viewport supports 3D features
   *
   * @returns {boolean}
   */
  supports3D() {
    return false;
  }

  /**
   * Get viewport type identifier
   *
   * @returns {string} 'canvas2d' | 'threejs'
   */
  getType() {
    throw new Error('IViewport.getType() not implemented');
  }
};
