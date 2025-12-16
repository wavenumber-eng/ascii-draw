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
      case 'text':
        this.drawText(obj.text || '', obj.x, obj.y);
        break;
      default:
        // Placeholder for unimplemented types
        this.drawBox({ ...obj, width: obj.width || 10, height: obj.height || 3 });
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
