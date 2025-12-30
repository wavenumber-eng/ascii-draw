/**
 * Canvas2DViewport - 2D canvas viewport implementation
 *
 * Implements: VIEW-1 to VIEW-32
 *
 * This is the standard 2D viewport using HTML5 Canvas. It provides:
 * - Coordinate transforms between screen and cell space
 * - Pan and zoom navigation
 * - Canvas element management
 * - Render orchestration through backend and overlay renderer
 *
 * Refactored from: Editor.js canvas management + CharacterGrid
 */
var AsciiEditor = AsciiEditor || {};
AsciiEditor.viewport = AsciiEditor.viewport || {};

AsciiEditor.viewport.Canvas2DViewport = class Canvas2DViewport extends AsciiEditor.viewport.IViewport {

  constructor(options = {}) {
    super();

    // Canvas element
    this.canvas = null;
    this.ctx = null;
    this.container = null;

    // Cell dimensions (configurable per CELL-* requirements)
    this.cellWidth = options.cellWidth || 10;
    this.cellHeight = options.cellHeight || 20;

    // Navigation state
    this.panX = 0;
    this.panY = 0;
    this.zoomLevel = 1.0;
    this.minZoom = 0.25;
    this.maxZoom = 4.0;

    // Grid configuration
    this.gridCols = options.cols || 120;
    this.gridRows = options.rows || 60;
    this.gridVisible = true;

    // Pluggable renderers
    this.renderBackend = null;
    this.overlayRenderer = null;

    // Font settings
    this.fontLoaded = false;
    this.fontFamily = options.fontFamily || 'BerkeleyMono, monospace';
    this.fontSize = options.fontSize || 16;

    // Render batching
    this.renderPending = false;
    this.renderCallback = null;
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Attach viewport to a container element
   * @param {HTMLElement} container - The container to attach to
   */
  attach(container) {
    this.container = container;

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.ctx = this.canvas.getContext('2d');

    container.appendChild(this.canvas);

    // Initial sizing
    this._updateCanvasSize();

    // Initialize renderers if attached
    if (this.renderBackend) {
      this.renderBackend.initialize(this);
    }
    if (this.overlayRenderer) {
      this.overlayRenderer.initialize(this);
    }
  }

  /**
   * Detach viewport and clean up resources
   */
  detach() {
    if (this.renderBackend) {
      this.renderBackend.dispose();
    }
    if (this.overlayRenderer) {
      this.overlayRenderer.dispose();
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.container = null;
  }

  // ============================================================
  // Coordinate Transforms
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
    // Account for pan and zoom
    const x = (screenX - this.panX) / this.zoomLevel;
    const y = (screenY - this.panY) / this.zoomLevel;

    return {
      col: Math.floor(x / this.cellWidth),
      row: Math.floor(y / this.cellHeight)
    };
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
    return {
      x: col * this.cellWidth * this.zoomLevel + this.panX,
      y: row * this.cellHeight * this.zoomLevel + this.panY
    };
  }

  /**
   * Get the bounding rectangle of a cell in screen coordinates
   *
   * @param {number} col - Cell column
   * @param {number} row - Cell row
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  getCellBounds(col, row) {
    const pos = this.cellToScreen(col, row);
    return {
      x: pos.x,
      y: pos.y,
      width: this.cellWidth * this.zoomLevel,
      height: this.cellHeight * this.zoomLevel
    };
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
    this.cellWidth = width;
    this.cellHeight = height;
    this._updateCanvasSize();
  }

  /**
   * Get current cell dimensions
   *
   * @returns {{ width: number, height: number }}
   */
  getCellDimensions() {
    return {
      width: this.cellWidth,
      height: this.cellHeight
    };
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
    this.panX += dx;
    this.panY += dy;
    this.requestRender();
  }

  /**
   * Zoom the viewport
   *
   * @param {number} factor - Zoom factor (>1 zooms in, <1 zooms out)
   * @param {number} [centerX] - Zoom center X (screen coords), defaults to center
   * @param {number} [centerY] - Zoom center Y (screen coords), defaults to center
   */
  zoom(factor, centerX, centerY) {
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * factor));

    if (newZoom !== this.zoomLevel) {
      // Default to canvas center if no center specified
      if (centerX === undefined || centerY === undefined) {
        centerX = this.canvas.width / 2;
        centerY = this.canvas.height / 2;
      }

      // Adjust pan to keep the point under the cursor stationary
      const zoomRatio = newZoom / this.zoomLevel;
      this.panX = centerX - (centerX - this.panX) * zoomRatio;
      this.panY = centerY - (centerY - this.panY) * zoomRatio;

      this.zoomLevel = newZoom;
      this.requestRender();
    }
  }

  /**
   * Get current zoom level
   *
   * @returns {number} Current zoom factor (1.0 = 100%)
   */
  getZoom() {
    return this.zoomLevel;
  }

  /**
   * Reset view to default (no pan, 100% zoom)
   */
  resetView() {
    this.panX = 0;
    this.panY = 0;
    this.zoomLevel = 1.0;
    this.requestRender();
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
    if (this.renderBackend) {
      this.renderBackend.dispose();
    }
    this.renderBackend = backend;
    if (this.canvas && backend) {
      backend.initialize(this);
    }
  }

  /**
   * Get the current render backend
   *
   * @returns {IRenderBackend}
   */
  getRenderBackend() {
    return this.renderBackend;
  }

  /**
   * Set the overlay renderer for UI elements
   *
   * @param {IOverlayRenderer} overlay - The overlay renderer to use
   */
  setOverlayRenderer(overlay) {
    if (this.overlayRenderer) {
      this.overlayRenderer.dispose();
    }
    this.overlayRenderer = overlay;
    if (this.canvas && overlay) {
      overlay.initialize(this);
    }
  }

  /**
   * Get the current overlay renderer
   *
   * @returns {IOverlayRenderer}
   */
  getOverlayRenderer() {
    return this.overlayRenderer;
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
  render(renderState, overlayState = {}) {
    if (!this.canvas || !this.ctx) return;

    // Apply zoom transform
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    this.ctx.scale(dpr, dpr);

    // Apply pan and zoom
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoomLevel, this.zoomLevel);

    // Render content via backend
    if (this.renderBackend) {
      this.renderBackend.beginFrame();
      this.renderBackend.clear();

      // Draw grid first
      if (this.gridVisible) {
        this.renderBackend.drawGrid(this.gridCols, this.gridRows, true);
      }

      // Draw all objects from render list
      if (renderState && renderState.renderList) {
        renderState.renderList.forEach(obj => {
          this._drawObject(obj, renderState.editContext);
        });
      }

      this.renderBackend.endFrame();
    }

    // Render overlays
    if (this.overlayRenderer && overlayState) {
      this.overlayRenderer.beginFrame();
      this.overlayRenderer.clear();

      // Draw selection highlights
      if (overlayState.selectedObjects) {
        overlayState.selectedObjects.forEach(obj => {
          this.overlayRenderer.drawSelectionHighlight(obj);
        });
      }

      // Draw resize handles
      if (overlayState.handles) {
        this.overlayRenderer.drawResizeHandles(overlayState.selectedObject, overlayState.handles);
      }

      // Draw tool preview
      if (overlayState.toolPreview) {
        this.overlayRenderer.drawToolPreview(overlayState.toolPreview);
      }

      // Draw marquee
      if (overlayState.marquee) {
        this.overlayRenderer.drawMarquee(overlayState.marquee.bounds, overlayState.marquee.mode);
      }

      // Draw edit cursor
      if (overlayState.editCursor) {
        this.overlayRenderer.drawTextCursor(
          overlayState.editCursor.col,
          overlayState.editCursor.row,
          overlayState.editCursor.visible
        );
      }

      this.overlayRenderer.endFrame();
    }

    this.ctx.restore();
    this.renderPending = false;
  }

  /**
   * Request a render on the next animation frame
   * Use this instead of render() for frequent updates
   */
  requestRender() {
    if (!this.renderPending) {
      this.renderPending = true;
      requestAnimationFrame(() => {
        if (this.renderCallback) {
          this.renderCallback();
        }
        this.renderPending = false;
      });
    }
  }

  /**
   * Set the callback to invoke when requestRender triggers
   * @param {Function} callback
   */
  setRenderCallback(callback) {
    this.renderCallback = callback;
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
    return this.canvas;
  }

  /**
   * Get the container element
   *
   * @returns {HTMLElement}
   */
  getContainer() {
    return this.container;
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
    this.gridVisible = visible;
    this.requestRender();
  }

  /**
   * Check if grid is visible
   *
   * @returns {boolean}
   */
  isGridVisible() {
    return this.gridVisible;
  }

  /**
   * Set grid dimensions (page size)
   *
   * @param {number} cols - Number of columns
   * @param {number} rows - Number of rows
   */
  setGridDimensions(cols, rows) {
    this.gridCols = cols;
    this.gridRows = rows;
    this._updateCanvasSize();
  }

  /**
   * Get grid dimensions
   *
   * @returns {{ cols: number, rows: number }}
   */
  getGridDimensions() {
    return {
      cols: this.gridCols,
      rows: this.gridRows
    };
  }

  // ============================================================
  // Font Management
  // ============================================================

  /**
   * Load the font for rendering
   * @returns {Promise<boolean>} True if font loaded successfully
   */
  async loadFont() {
    try {
      await document.fonts.load(`${this.fontSize}px ${this.fontFamily.split(',')[0]}`);
      this.fontLoaded = true;
      return true;
    } catch (e) {
      this.fontLoaded = false;
      return false;
    }
  }

  /**
   * Check if font is loaded
   * @returns {boolean}
   */
  isFontLoaded() {
    return this.fontLoaded;
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
   * @returns {string} 'canvas2d'
   */
  getType() {
    return 'canvas2d';
  }

  // ============================================================
  // Canvas Access (for backward compatibility)
  // ============================================================

  /**
   * Get the raw canvas element
   * @returns {HTMLCanvasElement}
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Get the 2D rendering context
   * @returns {CanvasRenderingContext2D}
   */
  getContext() {
    return this.ctx;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  _updateCanvasSize() {
    if (!this.canvas) return;

    const width = this.gridCols * this.cellWidth;
    const height = this.gridRows * this.cellHeight;
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    // Reset transform after resize
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  _drawObject(obj, editContext) {
    if (!this.renderBackend) return;

    // Handle edit context preview
    let drawObj = obj;
    if (editContext && editContext.objectId === obj.id && editContext.previewText !== null) {
      drawObj = { ...obj, text: editContext.previewText };
    }

    switch (obj.type) {
      case 'box':
        this.renderBackend.drawBox(drawObj);
        break;
      case 'symbol':
        this.renderBackend.drawSymbol(drawObj);
        break;
      case 'line':
        this.renderBackend.drawLine(drawObj);
        break;
      case 'wire':
        this.renderBackend.drawWire(drawObj);
        break;
      case 'text':
        this.renderBackend.drawTextObject(drawObj);
        break;
      case 'junction':
        this.renderBackend.drawJunction(drawObj);
        break;
      case 'wire-junction':
        this.renderBackend.drawWireJunction(drawObj);
        break;
      case 'wire-noconnect':
        this.renderBackend.drawWireNoConnect(drawObj);
        break;
    }
  }
};
