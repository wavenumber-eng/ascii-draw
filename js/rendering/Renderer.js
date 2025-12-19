/**
 * Renderer - Canvas drawing for all objects
 * Implements: VIS-*, OBJ-13, OBJ-14
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.rendering = AsciiEditor.rendering || {};

AsciiEditor.rendering.Renderer = class Renderer {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.grid = grid;
    this.fontLoaded = false;
  }

  async loadFont() {
    try {
      await document.fonts.load('16px BerkeleyMono');
      this.fontLoaded = true;
      AsciiEditor.debug.info('Renderer', 'BerkeleyMono font loaded');
    } catch (e) {
      AsciiEditor.debug.warn('Renderer', 'Could not load BerkeleyMono, using fallback');
    }
  }

  setCanvasSize(width, height) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.scale(dpr, dpr);
  }

  clear() {
    const styles = getComputedStyle(document.documentElement);
    const bgCanvas = styles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';
    this.ctx.fillStyle = bgCanvas;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // VIS-31: Grid overlay
  drawGrid(cols, rows, showGrid) {
    if (!showGrid) return;

    const styles = getComputedStyle(document.documentElement);
    const gridColor = styles.getPropertyValue('--bg-grid').trim() || '#2a2a2a';
    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 0.5;

    // Vertical lines
    for (let c = 0; c <= cols; c++) {
      const x = c * this.grid.charWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, rows * this.grid.charHeight);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let r = 0; r <= rows; r++) {
      const y = r * this.grid.charHeight;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(cols * this.grid.charWidth, y);
      this.ctx.stroke();
    }
  }

  drawChar(char, col, row, color = null, clearBackground = false) {
    const font = this.fontLoaded ? 'BerkeleyMono' : 'monospace';
    this.ctx.font = `16px ${font}`;

    const x = col * this.grid.charWidth;
    const y = row * this.grid.charHeight;

    // Clear cell background if requested (for text over fill)
    if (clearBackground) {
      const styles = getComputedStyle(document.documentElement);
      const bgCanvas = styles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';
      this.ctx.fillStyle = bgCanvas;
      this.ctx.fillRect(x, y, this.grid.charWidth, this.grid.charHeight);
    }

    if (color === null) {
      const styles = getComputedStyle(document.documentElement);
      color = styles.getPropertyValue('--text-canvas').trim() || '#cccccc';
    }
    this.ctx.fillStyle = color;
    this.ctx.textBaseline = 'top';

    this.ctx.fillText(char, x, y + 2); // +2 for vertical alignment
  }

  drawText(text, col, row, color = null, clearBackground = false) {
    for (let i = 0; i < text.length; i++) {
      this.drawChar(text[i], col + i, row, color, clearBackground);
    }
  }

  // OBJ-13, OBJ-14: Box rendering with UTF-8 characters and shadow
  drawBox(obj) {
    const { x, y, width, height, style, shadow } = obj;

    // VIS-10 to VIS-12: Box drawing characters
    const chars = {
      single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
      double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
      thick: { tl: '█', tr: '█', bl: '█', br: '█', h: '█', v: '█' }
    };

    const c = chars[style] || chars.single;
    const hasBorder = style && style !== 'none';
    const styles = getComputedStyle(document.documentElement);
    const color = styles.getPropertyValue('--text-canvas').trim() || '#cccccc';
    const shadowColor = styles.getPropertyValue('--text-shadow').trim() || '#555555';

    // VIS-20: Draw shadow first if enabled (only if has border)
    if (shadow && hasBorder) {
      for (let row = 1; row <= height; row++) {
        this.drawChar('░', x + width, y + row, shadowColor);
      }
      for (let col = 1; col < width; col++) {
        this.drawChar('░', x + col, y + height, shadowColor);
      }
      this.drawChar('░', x + width, y + height, shadowColor);
    }

    // Draw border (if not style: none)
    if (hasBorder) {
      // Top border
      this.drawChar(c.tl, x, y, color);
      for (let col = 1; col < width - 1; col++) {
        this.drawChar(c.h, x + col, y, color);
      }
      this.drawChar(c.tr, x + width - 1, y, color);

      // Sides
      for (let row = 1; row < height - 1; row++) {
        this.drawChar(c.v, x, y + row, color);
        this.drawChar(c.v, x + width - 1, y + row, color);
      }

      // Bottom border
      this.drawChar(c.bl, x, y + height - 1, color);
      for (let col = 1; col < width - 1; col++) {
        this.drawChar(c.h, x + col, y + height - 1, color);
      }
      this.drawChar(c.br, x + width - 1, y + height - 1, color);
    }

    // OBJ-16, OBJ-17: Draw fill in interior
    const fillChars = {
      'none': null,
      'light': '░',
      'medium': '▒',
      'dark': '▓',
      'solid': '█',
      'dots': '·'
    };
    const fillChar = fillChars[obj.fill];
    if (fillChar) {
      for (let row = 1; row < height - 1; row++) {
        for (let col = 1; col < width - 1; col++) {
          this.drawChar(fillChar, x + col, y + row, color);
        }
      }
    }

    // OBJ-15: Draw multi-line text inside with 9-position justification
    if (obj.text) {
      // For borderless boxes (style: 'none'), use full dimensions
      const borderOffset = hasBorder ? 1 : 0;
      const innerWidth = hasBorder ? width - 2 : width;
      const innerHeight = hasBorder ? height - 2 : height;
      const lines = obj.text.split('\n');

      const maxLines = Math.max(innerHeight, 1);
      const displayLines = lines.slice(0, maxLines);

      const justify = obj.textJustify || 'center-center';
      const [vAlign, hAlign] = justify.split('-');

      // Calculate starting Y based on vertical alignment
      let startY;
      if (vAlign === 'top') {
        startY = y + borderOffset;
      } else if (vAlign === 'bottom') {
        startY = y + height - borderOffset - displayLines.length;
      } else {
        startY = y + borderOffset + Math.floor((innerHeight - displayLines.length) / 2);
      }

      // Clear background for text if there's a fill
      const hasFill = obj.fill && obj.fill !== 'none';

      // Draw each line
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

        this.drawText(displayLine, textX, startY + i, color, hasFill);
      });
    }
  }

  drawObject(obj) {
    switch (obj.type) {
      case 'box':
        this.drawBox(obj);
        break;
      case 'symbol':
        this.drawSymbol(obj);
        break;
      case 'line':
        this.drawLine(obj);
        break;
      case 'text':
        this.drawText(obj.text || '', obj.x, obj.y);
        break;
      case 'junction':
        this.drawJunction(obj);
        break;
      default:
        // Unknown type - log warning but don't render anything that might obscure content
        AsciiEditor.debug.warn('Renderer', 'Unknown object type', { type: obj.type, obj });
    }
  }

  // OBJ-50 to OBJ-5J: Symbol rendering with explicit layer order (SYM-R1 to SYM-R12)
  // Order: 1.Border → 2.Fill → 3.Pins → 4.Pin Names → 5.Text → 6.Designator → 7.Parameters
  drawSymbol(obj) {
    const styles = getComputedStyle(document.documentElement);
    const color = styles.getPropertyValue('--text-canvas').trim() || '#cccccc';
    const accentColor = styles.getPropertyValue('--accent').trim() || '#007acc';

    // SYM-R1: Draw border (and shadow)
    this.drawSymbolBorder(obj, color);

    // SYM-R2: Draw fill
    this.drawSymbolFill(obj, color);

    // SYM-R3 & SYM-R4: Draw pins and pin names
    if (obj.pins && obj.pins.length > 0) {
      this.drawSymbolPins(obj);
    }

    // SYM-R5: Draw internal text
    this.drawSymbolInternalText(obj, color);

    // SYM-R6: Draw designator (on top of fill when inside)
    if (obj.designator && obj.designator.visible) {
      const desig = obj.designator;
      const designatorText = `${desig.prefix}${desig.number}`;
      const desigX = obj.x + (desig.offset?.x || 0);
      const desigY = obj.y + (desig.offset?.y || -1);
      this.drawText(designatorText, desigX, desigY, color, true);
    }

    // SYM-R7: Draw visible parameters (on top of fill when inside)
    if (obj.parameters && obj.parameters.length > 0) {
      obj.parameters.forEach(param => {
        if (param.visible && param.value) {
          const paramX = obj.x + (param.offset?.x || 0);
          const paramY = obj.y + (param.offset?.y || obj.height);
          this.drawText(param.value, paramX, paramY, color, true);
        }
      });
    }
  }

  // SYM-R1: Draw symbol border (and shadow)
  drawSymbolBorder(obj, color) {
    const { x, y, width, height, style, shadow } = obj;

    const chars = {
      single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
      double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
      thick: { tl: '█', tr: '█', bl: '█', br: '█', h: '█', v: '█' }
    };

    const c = chars[style] || chars.single;
    const hasBorder = style && style !== 'none';
    const styles = getComputedStyle(document.documentElement);
    const shadowColor = styles.getPropertyValue('--text-shadow').trim() || '#555555';

    // Draw shadow first if enabled
    if (shadow && hasBorder) {
      for (let row = 1; row <= height; row++) {
        this.drawChar('░', x + width, y + row, shadowColor);
      }
      for (let col = 1; col < width; col++) {
        this.drawChar('░', x + col, y + height, shadowColor);
      }
      this.drawChar('░', x + width, y + height, shadowColor);
    }

    // Draw border
    if (hasBorder) {
      this.drawChar(c.tl, x, y, color);
      for (let col = 1; col < width - 1; col++) {
        this.drawChar(c.h, x + col, y, color);
      }
      this.drawChar(c.tr, x + width - 1, y, color);

      for (let row = 1; row < height - 1; row++) {
        this.drawChar(c.v, x, y + row, color);
        this.drawChar(c.v, x + width - 1, y + row, color);
      }

      this.drawChar(c.bl, x, y + height - 1, color);
      for (let col = 1; col < width - 1; col++) {
        this.drawChar(c.h, x + col, y + height - 1, color);
      }
      this.drawChar(c.br, x + width - 1, y + height - 1, color);
    }
  }

  // SYM-R2: Draw symbol fill
  drawSymbolFill(obj, color) {
    const { x, y, width, height, style } = obj;
    const hasBorder = style && style !== 'none';

    const fillChars = {
      'none': null,
      'light': '░',
      'medium': '▒',
      'dark': '▓',
      'solid': '█',
      'dots': '·'
    };
    const fillChar = fillChars[obj.fill];

    if (fillChar) {
      const startCol = hasBorder ? 1 : 0;
      const endCol = hasBorder ? width - 1 : width;
      const startRow = hasBorder ? 1 : 0;
      const endRow = hasBorder ? height - 1 : height;

      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          this.drawChar(fillChar, x + col, y + row, color);
        }
      }
    }
  }

  // SYM-R5: Draw symbol internal text
  drawSymbolInternalText(obj, color) {
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

      this.drawText(displayLine, textX, startY + i, color, hasFill);
    });
  }

  // Draw pins on symbol edges
  drawSymbolPins(obj) {
    const styles = getComputedStyle(document.documentElement);
    const pinColor = styles.getPropertyValue('--text-canvas').trim() || '#cccccc';
    const pinNameColor = styles.getPropertyValue('--text-dim').trim() || '#888888';

    // Pin shape characters (same as line end caps)
    const pinShapes = {
      'circle': '●',
      'circle-outline': '○',
      'square': '■',
      'square-outline': '□',
      'diamond': '◆',
      'diamond-outline': '◇',
      'triangle': '▶',
      'triangle-outline': '▷'
    };

    obj.pins.forEach(pin => {
      const pos = this.getPinWorldPosition(obj, pin);
      const char = pinShapes[pin.shape] || pinShapes['circle-outline'];

      // Clear the cell first to remove the box edge character
      const px = pos.x * this.grid.charWidth;
      const py = pos.y * this.grid.charHeight;
      const bgCanvas = styles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';
      this.ctx.fillStyle = bgCanvas;
      this.ctx.fillRect(px, py, this.grid.charWidth, this.grid.charHeight);

      // Draw the pin character
      this.drawChar(char, pos.x, pos.y, pinColor);

      // OBJ-5O to OBJ-5R: Render pin name toward interior of symbol
      if (pin.name && pin.name.length > 0) {
        this.drawPinName(obj, pin, pos, pinNameColor);
      }
    });
  }

  // OBJ-5O to OBJ-5R: Draw pin name inside the symbol box
  drawPinName(symbol, pin, pinPos, color) {
    const name = pin.name;
    if (!name) return;

    const { x, y, width, height } = symbol;

    // Get background color for clearing fill characters under pin names
    const styles = getComputedStyle(document.documentElement);
    const bgCanvas = styles.getPropertyValue('--bg-canvas').trim() || '#ffffff';

    // Helper to clear background and draw character
    const drawPinChar = (char, charX, charY) => {
      const px = charX * this.grid.charWidth;
      const py = charY * this.grid.charHeight;
      this.ctx.fillStyle = bgCanvas;
      this.ctx.fillRect(px, py, this.grid.charWidth, this.grid.charHeight);
      this.drawChar(char, charX, charY, color);
    };

    switch (pin.edge) {
      case 'left':
        // OBJ-5O: Left edge - name starts 1 cell right of pin (inside symbol)
        // Text reads left-to-right, starting just inside the border
        for (let i = 0; i < name.length; i++) {
          const nameX = pinPos.x + 1 + i;
          // Don't draw outside symbol interior
          if (nameX < x + width - 1) {
            drawPinChar(name[i], nameX, pinPos.y);
          }
        }
        break;

      case 'right':
        // OBJ-5P: Right edge - name ends 1 cell left of pin (inside symbol)
        // Text reads left-to-right, ending just inside the border
        const startX = pinPos.x - name.length;
        for (let i = 0; i < name.length; i++) {
          const nameX = startX + i;
          // Don't draw outside symbol interior
          if (nameX > x) {
            drawPinChar(name[i], nameX, pinPos.y);
          }
        }
        break;

      case 'top':
        // OBJ-5Q: Top edge - name centered horizontally, 1 row below pin (inside symbol)
        // Text reads left-to-right
        const topCenterX = pinPos.x - Math.floor(name.length / 2);
        for (let i = 0; i < name.length; i++) {
          const nameX = topCenterX + i;
          // Stay within symbol bounds horizontally
          if (nameX > x && nameX < x + width - 1) {
            drawPinChar(name[i], nameX, pinPos.y + 1);
          }
        }
        break;

      case 'bottom':
        // OBJ-5R: Bottom edge - name centered horizontally, 1 row above pin (inside symbol)
        // Text reads left-to-right
        const bottomCenterX = pinPos.x - Math.floor(name.length / 2);
        for (let i = 0; i < name.length; i++) {
          const nameX = bottomCenterX + i;
          // Stay within symbol bounds horizontally
          if (nameX > x && nameX < x + width - 1) {
            drawPinChar(name[i], nameX, pinPos.y - 1);
          }
        }
        break;
    }
  }

  // Calculate world position of a pin (ON the symbol border)
  getPinWorldPosition(symbol, pin) {
    const { x, y, width, height } = symbol;
    const offset = pin.offset || 0.5;

    switch (pin.edge) {
      case 'left':
        // Left edge: x stays at symbol left, y varies along height
        return { x: x, y: Math.floor(y + offset * (height - 1)) };
      case 'right':
        // Right edge: x at symbol right border, y varies along height
        return { x: x + width - 1, y: Math.floor(y + offset * (height - 1)) };
      case 'top':
        // Top edge: y at symbol top, x varies along width
        return { x: Math.floor(x + offset * (width - 1)), y: y };
      case 'bottom':
        // Bottom edge: y at symbol bottom border, x varies along width
        return { x: Math.floor(x + offset * (width - 1)), y: y + height - 1 };
      default:
        return { x: x, y: y };
    }
  }

  // OBJ-47: Draw junction with style-based character
  drawJunction(obj) {
    const { x, y, style } = obj;

    const cssStyles = getComputedStyle(document.documentElement);
    const color = cssStyles.getPropertyValue('--text-canvas').trim() || '#cccccc';

    // Clear the cell first to remove overlapping line characters
    const px = x * this.grid.charWidth;
    const py = y * this.grid.charHeight;
    const bgCanvas = cssStyles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';
    this.ctx.fillStyle = bgCanvas;
    this.ctx.fillRect(px, py, this.grid.charWidth, this.grid.charHeight);

    // Junction characters based on connected line style
    const junctionChars = {
      single: '●',
      double: '■',
      thick: '█'
    };

    const char = junctionChars[style] || junctionChars.single;
    this.drawChar(char, x, y, color);
  }

  // OBJ-30 to OBJ-37: Line/polyline rendering
  drawLine(obj) {
    const { points, style, startCap, endCap } = obj;
    if (!points || points.length < 2) return;

    const cssStyles = getComputedStyle(document.documentElement);
    const color = cssStyles.getPropertyValue('--text-canvas').trim() || '#cccccc';

    // Use shared LineStyles definition if available, fallback to default
    let chars = { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' };
    if (AsciiEditor.tools && AsciiEditor.tools.LineStyles) {
      const styleDef = AsciiEditor.tools.LineStyles.find(s => s.key === style);
      if (styleDef) {
        chars = styleDef.chars;
      }
    }

    // Draw each segment
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      this.drawSegment(p1, p2, chars, color);
    }

    // Draw corners at intermediate points (clear background first to avoid overlap artifacts)
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const cornerChar = this.getCornerChar(prev, curr, next, chars);
      if (cornerChar) {
        // Clear the cell first to remove overlapping segment characters
        const cx = curr.x * this.grid.charWidth;
        const cy = curr.y * this.grid.charHeight;
        const bgStyles = getComputedStyle(document.documentElement);
        const bgCanvas = bgStyles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';
        this.ctx.fillStyle = bgCanvas;
        this.ctx.fillRect(cx, cy, this.grid.charWidth, this.grid.charHeight);

        this.drawChar(cornerChar, curr.x, curr.y, color);
      }
    }

    // Draw endpoint caps (skip if endpoint is a junction - junction takes precedence)
    const startKey = `${points[0].x},${points[0].y}`;
    const endKey = `${points[points.length - 1].x},${points[points.length - 1].y}`;

    if (startCap && startCap !== 'none' && !this.junctionPoints?.has(startKey)) {
      this.drawEndCap(points[0], points[1], startCap, true, color);
    }
    if (endCap && endCap !== 'none' && !this.junctionPoints?.has(endKey)) {
      this.drawEndCap(points[points.length - 1], points[points.length - 2], endCap, false, color);
    }
  }

  drawSegment(p1, p2, chars, color) {
    const dx = Math.sign(p2.x - p1.x);
    const dy = Math.sign(p2.y - p1.y);

    if (dx !== 0 && dy === 0) {
      // Horizontal segment
      const startX = Math.min(p1.x, p2.x);
      const endX = Math.max(p1.x, p2.x);
      for (let x = startX; x <= endX; x++) {
        this.drawChar(chars.h, x, p1.y, color);
      }
    } else if (dy !== 0 && dx === 0) {
      // Vertical segment
      const startY = Math.min(p1.y, p2.y);
      const endY = Math.max(p1.y, p2.y);
      for (let y = startY; y <= endY; y++) {
        this.drawChar(chars.v, p1.x, y, color);
      }
    }
    // Diagonal segments not supported for orthogonal lines
  }

  getCornerChar(prev, curr, next, chars) {
    // Determine incoming and outgoing directions
    const inDir = this.getDirection(prev, curr);
    const outDir = this.getDirection(curr, next);

    // Map direction pairs to corner characters
    // Incoming from left/right/up/down, outgoing to left/right/up/down
    const cornerMap = {
      'right-down': chars.tr,  // ┐ coming from left, going down
      'right-up': chars.br,    // ┘ coming from left, going up
      'left-down': chars.tl,   // ┌ coming from right, going down
      'left-up': chars.bl,     // └ coming from right, going up
      'down-right': chars.bl,  // └ coming from above, going right
      'down-left': chars.br,   // ┘ coming from above, going left
      'up-right': chars.tl,    // ┌ coming from below, going right
      'up-left': chars.tr      // ┐ coming from below, going left
    };

    return cornerMap[`${inDir}-${outDir}`] || null;
  }

  getDirection(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (dx > 0) return 'right';
    if (dx < 0) return 'left';
    if (dy > 0) return 'down';
    if (dy < 0) return 'up';
    return 'none';
  }

  drawEndCap(point, adjacentPoint, capType, isStart, color) {
    // Determine direction of the segment at this endpoint
    const dir = isStart
      ? this.getDirection(point, adjacentPoint)
      : this.getDirection(adjacentPoint, point);

    // Cap characters based on type and direction
    const caps = {
      arrow: { right: '>', left: '<', down: 'v', up: '^' },
      triangle: { right: '▶', left: '◀', down: '▼', up: '▲' },
      'triangle-outline': { right: '▷', left: '◁', down: '▽', up: '△' },
      diamond: { right: '◆', left: '◆', down: '◆', up: '◆' },
      'diamond-outline': { right: '◇', left: '◇', down: '◇', up: '◇' },
      circle: { right: '●', left: '●', down: '●', up: '●' },
      'circle-outline': { right: '○', left: '○', down: '○', up: '○' },
      square: { right: '■', left: '■', down: '■', up: '■' },
      'square-outline': { right: '□', left: '□', down: '□', up: '□' }
    };

    const capChars = caps[capType];
    if (capChars && capChars[dir]) {
      // Clear the cell first to remove overlapping segment characters
      const px = point.x * this.grid.charWidth;
      const py = point.y * this.grid.charHeight;
      const bgStyles = getComputedStyle(document.documentElement);
      const bgCanvas = bgStyles.getPropertyValue('--bg-canvas').trim() || '#1a1a1a';
      this.ctx.fillStyle = bgCanvas;
      this.ctx.fillRect(px, py, this.grid.charWidth, this.grid.charHeight);

      this.drawChar(capChars[dir], point.x, point.y, color);
    }
  }

  // VIS-50 to VIS-55: Multi-pass rendering with type-based layers
  // Order: Grid → Lines/Junctions → Boxes/Text → Symbols → Tool Overlays
  render(state, toolManager, editContext = null) {
    this.clear();

    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    // VIS-40: Draw grid (Layer 0)
    this.drawGrid(page.width, page.height, state.ui.gridVisible);

    // Collect junction positions - end caps should not be drawn at junctions
    this.junctionPoints = new Set();
    page.objects.forEach(obj => {
      if (obj.type === 'junction') {
        this.junctionPoints.add(`${obj.x},${obj.y}`);
      }
    });

    // Helper to draw an object with edit context support
    const drawWithEditContext = (obj) => {
      if (editContext && editContext.objectId === obj.id && editContext.previewText !== null) {
        const previewObj = { ...obj, text: editContext.previewText };
        this.drawObject(previewObj);
        if (editContext.cursorVisible) {
          this.drawEditCursor(previewObj, editContext.cursorPosition);
        }
      } else {
        this.drawObject(obj);
      }
    };

    // VIS-41 to VIS-44: PASS 1 - Lines and line junctions (lowest layer)
    page.objects.forEach(obj => {
      if (obj.type === 'line') {
        drawWithEditContext(obj);
      }
    });
    page.objects.forEach(obj => {
      if (obj.type === 'junction') {
        drawWithEditContext(obj);
      }
    });

    // VIS-45 to VIS-46: PASS 2 - Boxes and text (middle layer)
    page.objects.forEach(obj => {
      if (obj.type === 'box' || obj.type === 'text') {
        drawWithEditContext(obj);
      }
    });

    // VIS-47 to VIS-4D: PASS 3 - Symbols (top layer - includes pins, designators)
    page.objects.forEach(obj => {
      if (obj.type === 'symbol') {
        drawWithEditContext(obj);
      }
    });

    // VIS-4A: Draw tool overlay (always on top)
    toolManager.renderOverlay(this.ctx);
  }

  // SEL-33: Blinking cursor for inline editing
  drawEditCursor(obj, cursorPos) {
    if (!obj || (obj.type !== 'box' && obj.type !== 'symbol')) return;

    // For borderless boxes (style: 'none'), use full dimensions
    const hasBorder = obj.style && obj.style !== 'none';
    const borderOffset = hasBorder ? 1 : 0;
    const innerWidth = hasBorder ? obj.width - 2 : obj.width;
    const innerHeight = hasBorder ? obj.height - 2 : obj.height;
    const lines = (obj.text || '').split('\n');
    const displayLines = lines.slice(0, Math.max(innerHeight, 1));

    const justify = obj.textJustify || 'center-center';
    const [vAlign, hAlign] = justify.split('-');

    let startY;
    if (vAlign === 'top') {
      startY = obj.y + borderOffset;
    } else if (vAlign === 'bottom') {
      startY = obj.y + obj.height - borderOffset - displayLines.length;
    } else {
      startY = obj.y + borderOffset + Math.floor((innerHeight - displayLines.length) / 2);
    }

    const lineIndex = Math.min(cursorPos.line, displayLines.length);
    const lineText = displayLines[lineIndex] || '';
    const cursorCol = Math.min(cursorPos.col, innerWidth);

    let lineStartX;
    if (hAlign === 'left') {
      lineStartX = obj.x + borderOffset;
    } else if (hAlign === 'right') {
      lineStartX = obj.x + obj.width - borderOffset - lineText.length;
    } else {
      lineStartX = obj.x + borderOffset + Math.floor((innerWidth - lineText.length) / 2);
    }

    const cursorX = lineStartX + cursorCol;
    const cursorY = startY + lineIndex;

    const styles = getComputedStyle(document.documentElement);
    const cursorColor = styles.getPropertyValue('--accent').trim() || '#007acc';

    const px = cursorX * this.grid.charWidth;
    const py = cursorY * this.grid.charHeight;

    this.ctx.fillStyle = cursorColor;
    this.ctx.fillRect(px, py + 2, 2, this.grid.charHeight - 4);
  }
};
