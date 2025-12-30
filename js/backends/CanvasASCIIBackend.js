/**
 * CanvasASCIIBackend - ASCII content rendering to 2D canvas
 *
 * Implements: BACK-1 to BACK-32
 *
 * This backend renders document content (boxes, lines, symbols, etc.)
 * as ASCII characters on a 2D canvas. Content rendered by this backend
 * CAN be exported.
 *
 * Refactored from: Renderer.js content drawing methods
 */
var AsciiEditor = AsciiEditor || {};
AsciiEditor.backends = AsciiEditor.backends || {};

AsciiEditor.backends.CanvasASCIIBackend = class CanvasASCIIBackend extends AsciiEditor.backends.IRenderBackend {

  constructor() {
    super();
    this.viewport = null;
    this.ctx = null;
    this.fontLoaded = false;

    // Junction points (for skipping end caps at junctions)
    this.junctionPoints = new Set();
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Initialize the backend with a viewport
   *
   * @param {IViewport} viewport - The viewport this backend renders to
   */
  initialize(viewport) {
    this.viewport = viewport;
    this.ctx = viewport.getContext();
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.viewport = null;
    this.ctx = null;
  }

  // ============================================================
  // Frame Management
  // ============================================================

  beginFrame() {
    this.junctionPoints.clear();
  }

  endFrame() {
    // Nothing to flush for immediate mode rendering
  }

  /**
   * Clear the rendering surface
   */
  clear() {
    if (!this.ctx || !this.viewport) return;

    const styles = getComputedStyle(document.documentElement);
    const bgCanvas = styles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';

    const dims = this.viewport.getCellDimensions();
    const grid = this.viewport.getGridDimensions();
    const width = grid.cols * dims.width;
    const height = grid.rows * dims.height;

    this.ctx.fillStyle = bgCanvas;
    this.ctx.fillRect(0, 0, width, height);
  }

  // ============================================================
  // Cell-Level Drawing
  // ============================================================

  /**
   * Draw a single character in a cell
   *
   * @param {number} col - Cell column
   * @param {number} row - Cell row
   * @param {string} char - Character to draw
   * @param {Object} [style] - Style options
   */
  drawCell(col, row, char, style = {}) {
    if (!this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const x = col * dims.width;
    const y = row * dims.height;

    // Clear cell background if requested
    if (style.clearBackground) {
      const styles = getComputedStyle(document.documentElement);
      const bgCanvas = styles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';
      this.ctx.fillStyle = bgCanvas;
      this.ctx.fillRect(x, y, dims.width, dims.height);
    }

    // Set color
    let color = style.foreground;
    if (!color) {
      const styles = getComputedStyle(document.documentElement);
      color = styles.getPropertyValue('--text-canvas').trim() || '#cccccc';
    }

    // Draw character
    const fontFamily = this.viewport.isFontLoaded() ? 'BerkeleyMono' : 'monospace';
    this.ctx.font = `16px ${fontFamily}`;
    this.ctx.fillStyle = color;
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(char, x, y + 2);
  }

  /**
   * Draw text starting at a cell position
   *
   * @param {number} col - Starting cell column
   * @param {number} row - Starting cell row
   * @param {string} text - Text to draw
   * @param {Object} [style] - Style options
   */
  drawText(col, row, text, style = {}) {
    for (let i = 0; i < text.length; i++) {
      this.drawCell(col + i, row, text[i], style);
    }
  }

  // ============================================================
  // Object-Level Drawing
  // ============================================================

  /**
   * Draw a box object
   */
  drawBox(obj, options = {}) {
    const { x, y, width, height, style, shadow } = obj;

    const chars = this.getCharacterSet().box[style] || this.getCharacterSet().box.single;
    const hasBorder = style && style !== 'none';

    const cssStyles = getComputedStyle(document.documentElement);
    const color = cssStyles.getPropertyValue('--text-canvas').trim() || '#cccccc';
    const shadowColor = cssStyles.getPropertyValue('--text-shadow').trim() || '#555555';

    // Draw shadow first if enabled
    if (shadow && hasBorder) {
      for (let row = 1; row <= height; row++) {
        this.drawCell(x + width, y + row, '░', { foreground: shadowColor });
      }
      for (let col = 1; col < width; col++) {
        this.drawCell(x + col, y + height, '░', { foreground: shadowColor });
      }
      this.drawCell(x + width, y + height, '░', { foreground: shadowColor });
    }

    // Draw border
    if (hasBorder) {
      // Top border
      this.drawCell(x, y, chars.tl, { foreground: color });
      for (let col = 1; col < width - 1; col++) {
        this.drawCell(x + col, y, chars.h, { foreground: color });
      }
      this.drawCell(x + width - 1, y, chars.tr, { foreground: color });

      // Sides
      for (let row = 1; row < height - 1; row++) {
        this.drawCell(x, y + row, chars.v, { foreground: color });
        this.drawCell(x + width - 1, y + row, chars.v, { foreground: color });
      }

      // Bottom border
      this.drawCell(x, y + height - 1, chars.bl, { foreground: color });
      for (let col = 1; col < width - 1; col++) {
        this.drawCell(x + col, y + height - 1, chars.h, { foreground: color });
      }
      this.drawCell(x + width - 1, y + height - 1, chars.br, { foreground: color });
    }

    // Draw fill
    const fillChars = this.getCharacterSet().fill;
    const fillChar = fillChars[obj.fill];
    if (fillChar) {
      for (let row = 1; row < height - 1; row++) {
        for (let col = 1; col < width - 1; col++) {
          this.drawCell(x + col, y + row, fillChar, { foreground: color });
        }
      }
    }

    // Draw text
    if (obj.text) {
      this._drawBoxText(obj, color);
    }
  }

  /**
   * Draw a line/polyline object
   */
  drawLine(obj, options = {}) {
    const { points, style, startCap, endCap } = obj;
    if (!points || points.length < 2) return;

    const cssStyles = getComputedStyle(document.documentElement);
    const color = cssStyles.getPropertyValue('--text-canvas').trim() || '#cccccc';

    // Get line style characters
    let chars = this.getCharacterSet().line.single;
    if (AsciiEditor.tools && AsciiEditor.tools.LineStyles) {
      const styleDef = AsciiEditor.tools.LineStyles.find(s => s.key === style);
      if (styleDef) {
        chars = styleDef.chars;
      }
    }

    // Draw each segment
    for (let i = 0; i < points.length - 1; i++) {
      this._drawSegment(points[i], points[i + 1], chars, color);
    }

    // Draw corners at intermediate points
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const cornerChar = this._getCornerChar(prev, curr, next, chars);
      if (cornerChar) {
        this.drawCell(curr.x, curr.y, cornerChar, { foreground: color, clearBackground: true });
      }
    }

    // Draw endpoint caps (skip if endpoint is a junction)
    const startKey = `${points[0].x},${points[0].y}`;
    const endKey = `${points[points.length - 1].x},${points[points.length - 1].y}`;

    if (startCap && startCap !== 'none' && !this.junctionPoints.has(startKey)) {
      this._drawEndCap(points[0], points[1], startCap, true, color);
    }
    if (endCap && endCap !== 'none' && !this.junctionPoints.has(endKey)) {
      this._drawEndCap(points[points.length - 1], points[points.length - 2], endCap, false, color);
    }
  }

  /**
   * Draw a wire object
   */
  drawWire(obj, options = {}) {
    // Wires render same as lines
    this.drawLine(obj, options);

    // Draw net label if present
    if (obj.net) {
      this._drawWireNetLabel(obj);
    }
  }

  /**
   * Draw a symbol object
   */
  drawSymbol(obj, options = {}) {
    const cssStyles = getComputedStyle(document.documentElement);
    const color = cssStyles.getPropertyValue('--text-canvas').trim() || '#cccccc';

    // Draw border and shadow
    this._drawSymbolBorder(obj, color);

    // Draw fill
    this._drawSymbolFill(obj, color);

    // Draw pins
    if (obj.pins && obj.pins.length > 0) {
      this._drawSymbolPins(obj);
    }

    // Draw internal text
    this._drawSymbolInternalText(obj, color);

    // Draw designator
    if (obj.designator && obj.designator.visible) {
      const desig = obj.designator;
      const designatorText = `${desig.prefix}${desig.number}`;
      const desigX = obj.x + (desig.offset?.x || 0);
      const desigY = obj.y + (desig.offset?.y || -1);
      this.drawText(desigX, desigY, designatorText, { foreground: color, clearBackground: true });
    }

    // Draw parameters
    if (obj.parameters && obj.parameters.length > 0) {
      obj.parameters.forEach(param => {
        if (param.visible && param.value) {
          const paramX = obj.x + (param.offset?.x || 0);
          const paramY = obj.y + (param.offset?.y || obj.height);
          this.drawText(paramX, paramY, param.value, { foreground: color, clearBackground: true });
        }
      });
    }
  }

  /**
   * Draw a junction object
   */
  drawJunction(obj, options = {}) {
    const { x, y, style } = obj;

    // Track junction position for line rendering
    this.junctionPoints.add(`${x},${y}`);

    const cssStyles = getComputedStyle(document.documentElement);
    const color = cssStyles.getPropertyValue('--text-canvas').trim() || '#cccccc';

    const junctionChars = {
      single: '●',
      double: '■',
      thick: '█'
    };

    const char = junctionChars[style] || junctionChars.single;
    this.drawCell(x, y, char, { foreground: color, clearBackground: true });
  }

  /**
   * Draw a wire junction object
   */
  drawWireJunction(obj, options = {}) {
    const { x, y, style } = obj;

    this.junctionPoints.add(`${x},${y}`);

    const cssStyles = getComputedStyle(document.documentElement);
    const accentSecondary = cssStyles.getPropertyValue('--accent-secondary').trim() || '#00aa66';

    const junctionChars = {
      single: '●',
      double: '●',
      thick: '█'
    };

    const char = junctionChars[style] || junctionChars.single;
    this.drawCell(x, y, char, { foreground: accentSecondary, clearBackground: true });
  }

  /**
   * Draw a wire no-connect marker
   */
  drawWireNoConnect(obj, options = {}) {
    const { x, y } = obj;
    this.drawCell(x, y, 'X', { foreground: '#000000', clearBackground: true });
  }

  // ============================================================
  // Grid
  // ============================================================

  /**
   * Draw the background grid
   */
  drawGrid(cols, rows, visible) {
    if (!visible || !this.ctx || !this.viewport) return;

    const dims = this.viewport.getCellDimensions();
    const cssStyles = getComputedStyle(document.documentElement);
    const gridColor = cssStyles.getPropertyValue('--bg-grid').trim() || '#2a2a2a';

    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 0.5;

    // Vertical lines
    for (let c = 0; c <= cols; c++) {
      const x = c * dims.width;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, rows * dims.height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let r = 0; r <= rows; r++) {
      const y = r * dims.height;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(cols * dims.width, y);
      this.ctx.stroke();
    }
  }

  // ============================================================
  // Style Support
  // ============================================================

  /**
   * Get the character set used by this backend
   */
  getCharacterSet() {
    return {
      box: {
        single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
        double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
        thick: { tl: '█', tr: '█', bl: '█', br: '█', h: '█', v: '█' }
      },
      line: {
        single: { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' },
        double: { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝' },
        thick: { h: '█', v: '█', tl: '█', tr: '█', bl: '█', br: '█' }
      },
      fill: {
        'none': null,
        'light': '░',
        'medium': '▒',
        'dark': '▓',
        'solid': '█',
        'dots': '·'
      },
      pin: {
        'circle': '●',
        'circle-outline': '○',
        'square': '■',
        'square-outline': '□',
        'diamond': '◆',
        'diamond-outline': '◇',
        'triangle': '▶',
        'triangle-outline': '▷'
      },
      cap: {
        arrow: { right: '>', left: '<', down: 'v', up: '^' },
        triangle: { right: '▶', left: '◀', down: '▼', up: '▲' },
        'triangle-outline': { right: '▷', left: '◁', down: '▽', up: '△' },
        diamond: { right: '◆', left: '◆', down: '◆', up: '◆' },
        'diamond-outline': { right: '◇', left: '◇', down: '◇', up: '◇' },
        circle: { right: '●', left: '●', down: '●', up: '●' },
        'circle-outline': { right: '○', left: '○', down: '○', up: '○' },
        square: { right: '■', left: '■', down: '■', up: '■' },
        'square-outline': { right: '□', left: '□', down: '□', up: '□' }
      }
    };
  }

  /**
   * Get backend type identifier
   */
  getType() {
    return 'canvas-ascii';
  }

  // ============================================================
  // Private Methods - Box
  // ============================================================

  _drawBoxText(obj, color) {
    const { x, y, width, height, style } = obj;
    const hasBorder = style && style !== 'none';
    const hasFill = obj.fill && obj.fill !== 'none';

    const borderOffset = hasBorder ? 1 : 0;
    const innerWidth = hasBorder ? width - 2 : width;
    const innerHeight = hasBorder ? height - 2 : height;
    const lines = obj.text.split('\n');

    const maxLines = Math.max(innerHeight, 1);
    const displayLines = lines.slice(0, maxLines);

    const justify = obj.textJustify || 'center-center';
    const [vAlign, hAlign] = justify.split('-');

    let startY;
    if (vAlign === 'top') {
      startY = y + borderOffset;
    } else if (vAlign === 'bottom') {
      startY = y + height - borderOffset - displayLines.length;
    } else {
      startY = y + borderOffset + Math.floor((innerHeight - displayLines.length) / 2);
    }

    displayLines.forEach((line, i) => {
      const displayLine = line.length > innerWidth ? line.substring(0, innerWidth) : line;
      let textX;

      if (hAlign === 'left') {
        textX = x + borderOffset;
      } else if (hAlign === 'right') {
        textX = x + width - borderOffset - displayLine.length;
      } else {
        textX = x + borderOffset + Math.floor((innerWidth - displayLine.length) / 2);
      }

      this.drawText(textX, startY + i, displayLine, { foreground: color, clearBackground: hasFill });
    });
  }

  // ============================================================
  // Private Methods - Line
  // ============================================================

  _drawSegment(p1, p2, chars, color) {
    const dx = Math.sign(p2.x - p1.x);
    const dy = Math.sign(p2.y - p1.y);

    if (dx !== 0 && dy === 0) {
      // Horizontal segment
      const startX = Math.min(p1.x, p2.x);
      const endX = Math.max(p1.x, p2.x);
      for (let x = startX; x <= endX; x++) {
        this.drawCell(x, p1.y, chars.h, { foreground: color });
      }
    } else if (dy !== 0 && dx === 0) {
      // Vertical segment
      const startY = Math.min(p1.y, p2.y);
      const endY = Math.max(p1.y, p2.y);
      for (let y = startY; y <= endY; y++) {
        this.drawCell(p1.x, y, chars.v, { foreground: color });
      }
    }
  }

  _getCornerChar(prev, curr, next, chars) {
    const inDir = this._getDirection(prev, curr);
    const outDir = this._getDirection(curr, next);

    const cornerMap = {
      'right-down': chars.tr,
      'right-up': chars.br,
      'left-down': chars.tl,
      'left-up': chars.bl,
      'down-right': chars.bl,
      'down-left': chars.br,
      'up-right': chars.tl,
      'up-left': chars.tr
    };

    return cornerMap[`${inDir}-${outDir}`] || null;
  }

  _getDirection(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (dx > 0) return 'right';
    if (dx < 0) return 'left';
    if (dy > 0) return 'down';
    if (dy < 0) return 'up';
    return 'none';
  }

  _drawEndCap(point, adjacentPoint, capType, isStart, color) {
    const dir = isStart
      ? this._getDirection(point, adjacentPoint)
      : this._getDirection(adjacentPoint, point);

    const caps = this.getCharacterSet().cap;
    const capChars = caps[capType];

    if (capChars && capChars[dir]) {
      this.drawCell(point.x, point.y, capChars[dir], { foreground: color, clearBackground: true });
    }
  }

  _drawWireNetLabel(wire) {
    if (!wire.points || wire.points.length < 2) return;

    const cssStyles = getComputedStyle(document.documentElement);
    const accentSecondary = cssStyles.getPropertyValue('--accent-secondary').trim() || '#00aa66';

    const midIndex = Math.floor((wire.points.length - 1) / 2);
    const p1 = wire.points[midIndex];
    const p2 = wire.points[midIndex + 1] || p1;

    const midX = Math.round((p1.x + p2.x) / 2);
    const midY = Math.round((p1.y + p2.y) / 2);

    const isHorizontal = p1.y === p2.y;
    const labelX = midX;
    const labelY = isHorizontal ? midY - 1 : midY;

    for (let i = 0; i < wire.net.length; i++) {
      this.drawCell(labelX + i, labelY, wire.net[i], { foreground: accentSecondary });
    }
  }

  // ============================================================
  // Private Methods - Symbol
  // ============================================================

  _drawSymbolBorder(obj, color) {
    const { x, y, width, height, style, shadow } = obj;

    const chars = this.getCharacterSet().box[style] || this.getCharacterSet().box.single;
    const hasBorder = style && style !== 'none';

    const cssStyles = getComputedStyle(document.documentElement);
    const shadowColor = cssStyles.getPropertyValue('--text-shadow').trim() || '#555555';

    // Draw shadow
    if (shadow && hasBorder) {
      for (let row = 1; row <= height; row++) {
        this.drawCell(x + width, y + row, '░', { foreground: shadowColor });
      }
      for (let col = 1; col < width; col++) {
        this.drawCell(x + col, y + height, '░', { foreground: shadowColor });
      }
      this.drawCell(x + width, y + height, '░', { foreground: shadowColor });
    }

    // Draw border
    if (hasBorder) {
      this.drawCell(x, y, chars.tl, { foreground: color });
      for (let col = 1; col < width - 1; col++) {
        this.drawCell(x + col, y, chars.h, { foreground: color });
      }
      this.drawCell(x + width - 1, y, chars.tr, { foreground: color });

      for (let row = 1; row < height - 1; row++) {
        this.drawCell(x, y + row, chars.v, { foreground: color });
        this.drawCell(x + width - 1, y + row, chars.v, { foreground: color });
      }

      this.drawCell(x, y + height - 1, chars.bl, { foreground: color });
      for (let col = 1; col < width - 1; col++) {
        this.drawCell(x + col, y + height - 1, chars.h, { foreground: color });
      }
      this.drawCell(x + width - 1, y + height - 1, chars.br, { foreground: color });
    }
  }

  _drawSymbolFill(obj, color) {
    const { x, y, width, height, style } = obj;
    const hasBorder = style && style !== 'none';

    const fillChars = this.getCharacterSet().fill;
    const fillChar = fillChars[obj.fill];

    if (fillChar) {
      const startCol = hasBorder ? 1 : 0;
      const endCol = hasBorder ? width - 1 : width;
      const startRow = hasBorder ? 1 : 0;
      const endRow = hasBorder ? height - 1 : height;

      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          this.drawCell(x + col, y + row, fillChar, { foreground: color });
        }
      }
    }
  }

  _drawSymbolPins(obj) {
    const cssStyles = getComputedStyle(document.documentElement);
    const pinColor = cssStyles.getPropertyValue('--text-canvas').trim() || '#cccccc';
    const pinNameColor = cssStyles.getPropertyValue('--text-dim').trim() || '#888888';

    const pinShapes = this.getCharacterSet().pin;

    obj.pins.forEach(pin => {
      const pos = this._getPinWorldPosition(obj, pin);
      const char = pinShapes[pin.shape] || pinShapes['circle-outline'];

      // Draw pin character
      this.drawCell(pos.x, pos.y, char, { foreground: pinColor, clearBackground: true });

      // Draw pin name
      if (pin.name && pin.name.length > 0) {
        this._drawPinName(obj, pin, pos, pinNameColor);
      }
    });
  }

  _getPinWorldPosition(symbol, pin) {
    const { x, y, width, height } = symbol;
    const offset = pin.offset || 0.5;

    switch (pin.edge) {
      case 'left':
        return { x: x, y: Math.floor(y + offset * (height - 1)) };
      case 'right':
        return { x: x + width - 1, y: Math.floor(y + offset * (height - 1)) };
      case 'top':
        return { x: Math.floor(x + offset * (width - 1)), y: y };
      case 'bottom':
        return { x: Math.floor(x + offset * (width - 1)), y: y + height - 1 };
      default:
        return { x: x, y: y };
    }
  }

  _drawPinName(symbol, pin, pinPos, color) {
    const name = pin.name;
    if (!name) return;

    const { x, y, width, height } = symbol;

    switch (pin.edge) {
      case 'left':
        for (let i = 0; i < name.length; i++) {
          const nameX = pinPos.x + 1 + i;
          if (nameX < x + width - 1) {
            this.drawCell(nameX, pinPos.y, name[i], { foreground: color, clearBackground: true });
          }
        }
        break;

      case 'right':
        const startX = pinPos.x - name.length;
        for (let i = 0; i < name.length; i++) {
          const nameX = startX + i;
          if (nameX > x) {
            this.drawCell(nameX, pinPos.y, name[i], { foreground: color, clearBackground: true });
          }
        }
        break;

      case 'top':
        const topCenterX = pinPos.x - Math.floor(name.length / 2);
        for (let i = 0; i < name.length; i++) {
          const nameX = topCenterX + i;
          if (nameX > x && nameX < x + width - 1) {
            this.drawCell(nameX, pinPos.y + 1, name[i], { foreground: color, clearBackground: true });
          }
        }
        break;

      case 'bottom':
        const bottomCenterX = pinPos.x - Math.floor(name.length / 2);
        for (let i = 0; i < name.length; i++) {
          const nameX = bottomCenterX + i;
          if (nameX > x && nameX < x + width - 1) {
            this.drawCell(nameX, pinPos.y - 1, name[i], { foreground: color, clearBackground: true });
          }
        }
        break;
    }
  }

  _drawSymbolInternalText(obj, color) {
    if (!obj.text) return;

    const { x, y, width, height, style } = obj;
    const hasBorder = style && style !== 'none';
    const hasFill = obj.fill && obj.fill !== 'none';

    const borderOffset = hasBorder ? 1 : 0;
    const innerWidth = hasBorder ? width - 2 : width;
    const innerHeight = hasBorder ? height - 2 : height;
    const lines = obj.text.split('\n');

    const maxLines = Math.max(innerHeight, 1);
    const displayLines = lines.slice(0, maxLines);

    const justify = obj.textJustify || 'center-center';
    const [vAlign, hAlign] = justify.split('-');

    let startY;
    if (vAlign === 'top') {
      startY = y + borderOffset;
    } else if (vAlign === 'bottom') {
      startY = y + height - borderOffset - displayLines.length;
    } else {
      startY = y + borderOffset + Math.floor((innerHeight - displayLines.length) / 2);
    }

    displayLines.forEach((line, i) => {
      const displayLine = line.length > innerWidth ? line.substring(0, innerWidth) : line;
      let textX;

      if (hAlign === 'left') {
        textX = x + borderOffset;
      } else if (hAlign === 'right') {
        textX = x + width - borderOffset - displayLine.length;
      } else {
        textX = x + borderOffset + Math.floor((innerWidth - displayLine.length) / 2);
      }

      this.drawText(textX, startY + i, displayLine, { foreground: color, clearBackground: hasFill });
    });
  }
};
