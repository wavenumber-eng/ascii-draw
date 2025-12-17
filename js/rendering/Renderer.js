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
      console.log('BerkeleyMono font loaded');
    } catch (e) {
      console.warn('Could not load BerkeleyMono, using fallback');
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
      const innerWidth = width - 2;
      const innerHeight = height - 2;
      const lines = obj.text.split('\n');

      const maxLines = innerHeight;
      const displayLines = lines.slice(0, maxLines);

      const justify = obj.textJustify || 'center-center';
      const [vAlign, hAlign] = justify.split('-');

      // Calculate starting Y based on vertical alignment
      let startY;
      if (vAlign === 'top') {
        startY = y + 1;
      } else if (vAlign === 'bottom') {
        startY = y + height - 1 - displayLines.length;
      } else {
        startY = y + 1 + Math.floor((innerHeight - displayLines.length) / 2);
      }

      // Clear background for text if there's a fill
      const hasFill = obj.fill && obj.fill !== 'none';

      // Draw each line
      displayLines.forEach((line, i) => {
        const displayLine = line.length > innerWidth ? line.substring(0, innerWidth) : line;
        let textX;

        if (hAlign === 'left') {
          textX = x + 1;
        } else if (hAlign === 'right') {
          textX = x + width - 1 - displayLine.length;
        } else {
          textX = x + 1 + Math.floor((innerWidth - displayLine.length) / 2);
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
      case 'line':
        this.drawLine(obj);
        break;
      case 'text':
        this.drawText(obj.text || '', obj.x, obj.y);
        break;
      default:
        // Placeholder for unimplemented types
        this.drawBox({ ...obj, width: obj.width || 10, height: obj.height || 3 });
    }
  }

  // OBJ-30 to OBJ-37: Line/polyline rendering
  drawLine(obj) {
    const { points, style, startCap, endCap } = obj;
    if (!points || points.length < 2) return;

    const styles = getComputedStyle(document.documentElement);
    const color = styles.getPropertyValue('--text-canvas').trim() || '#cccccc';

    // Line style characters
    const lineChars = {
      single: { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' },
      double: { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝' },
      thick:  { h: '█', v: '█', tl: '█', tr: '█', bl: '█', br: '█' }
    };
    const chars = lineChars[style] || lineChars.single;

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

    // Draw endpoint caps
    if (startCap && startCap !== 'none') {
      this.drawEndCap(points[0], points[1], startCap, true, color);
    }
    if (endCap && endCap !== 'none') {
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
      this.drawChar(capChars[dir], point.x, point.y, color);
    }
  }

  render(state, toolManager, editContext = null) {
    this.clear();

    const page = state.project.pages.find(p => p.id === state.activePageId);
    if (!page) return;

    // Draw grid
    this.drawGrid(page.width, page.height, state.ui.gridVisible);

    // Draw all objects
    page.objects.forEach(obj => {
      // If this object is being edited, use preview text
      if (editContext && editContext.objectId === obj.id && editContext.previewText !== null) {
        const previewObj = { ...obj, text: editContext.previewText };
        this.drawObject(previewObj);

        // Draw blinking cursor if visible
        if (editContext.cursorVisible) {
          this.drawEditCursor(previewObj, editContext.cursorPosition);
        }
      } else {
        this.drawObject(obj);
      }
    });

    // Draw tool overlay
    toolManager.renderOverlay(this.ctx);
  }

  // SEL-33: Blinking cursor for inline editing
  drawEditCursor(obj, cursorPos) {
    if (!obj || obj.type !== 'box') return;

    const innerWidth = obj.width - 2;
    const innerHeight = obj.height - 2;
    const lines = (obj.text || '').split('\n');
    const displayLines = lines.slice(0, innerHeight);

    const justify = obj.textJustify || 'center-center';
    const [vAlign, hAlign] = justify.split('-');

    let startY;
    if (vAlign === 'top') {
      startY = obj.y + 1;
    } else if (vAlign === 'bottom') {
      startY = obj.y + obj.height - 1 - displayLines.length;
    } else {
      startY = obj.y + 1 + Math.floor((innerHeight - displayLines.length) / 2);
    }

    const lineIndex = Math.min(cursorPos.line, displayLines.length);
    const lineText = displayLines[lineIndex] || '';
    const cursorCol = Math.min(cursorPos.col, innerWidth);

    let lineStartX;
    if (hAlign === 'left') {
      lineStartX = obj.x + 1;
    } else if (hAlign === 'right') {
      lineStartX = obj.x + obj.width - 1 - lineText.length;
    } else {
      lineStartX = obj.x + 1 + Math.floor((innerWidth - lineText.length) / 2);
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
