/**
 * ASCIIExporter - Export diagrams as plain text
 *
 * Implements: EXP-1
 *
 * Renders the document to a plain text string using box-drawing characters.
 * This is the primary export format for ASCII diagrams.
 */
var AsciiEditor = AsciiEditor || {};
AsciiEditor.export = AsciiEditor.export || {};

AsciiEditor.export.ASCIIExporter = class ASCIIExporter extends AsciiEditor.export.IExporter {

  constructor() {
    super();
    // Character buffer: 2D array of characters
    this.buffer = null;
    this.width = 0;
    this.height = 0;
  }

  // ============================================================
  // IExporter Implementation
  // ============================================================

  export(state, options = {}) {
    const opts = { ...this.getDefaultOptions(), ...options };

    // Find the page to export
    let page;
    if (opts.pageId) {
      page = state.project.pages.find(p => p.id === opts.pageId);
    } else {
      page = state.project.pages.find(p => p.id === state.activePageId);
    }

    if (!page) {
      return '';
    }

    return this.exportPage(page, opts);
  }

  exportPage(page, options = {}) {
    const opts = { ...this.getDefaultOptions(), ...options };

    // Initialize buffer
    this.width = page.width || 120;
    this.height = page.height || 60;
    this._initBuffer();

    // Get objects to render
    let objects = page.objects || [];

    // Optionally include derived objects (junctions, etc.)
    if (opts.includeDerived && AsciiEditor.core && AsciiEditor.core.DerivedStateComputer) {
      const computer = new AsciiEditor.core.DerivedStateComputer();
      const derived = computer.compute(objects.filter(o => !o.derived));
      objects = derived.renderList || objects;
    }

    // Sort by z-order (render order)
    const sortedObjects = this._sortByZOrder(objects);

    // Render each object
    for (const obj of sortedObjects) {
      this._renderObject(obj, opts);
    }

    // Convert buffer to string, trimming trailing whitespace
    return this._bufferToString(opts);
  }

  getName() {
    return 'ASCII Text';
  }

  getFileExtension() {
    return 'txt';
  }

  getMimeType() {
    return 'text/plain';
  }

  getDescription() {
    return 'Plain text with box-drawing characters';
  }

  getType() {
    return 'ascii';
  }

  getDefaultOptions() {
    return {
      ...super.getDefaultOptions(),
      trimTrailingWhitespace: true,
      trimEmptyLines: true
    };
  }

  getSupportedOptions() {
    return [
      ...super.getSupportedOptions(),
      {
        key: 'trimTrailingWhitespace',
        type: 'boolean',
        label: 'Trim trailing whitespace',
        default: true
      },
      {
        key: 'trimEmptyLines',
        type: 'boolean',
        label: 'Trim empty lines at end',
        default: true
      }
    ];
  }

  // ============================================================
  // Buffer Management
  // ============================================================

  _initBuffer() {
    this.buffer = [];
    for (let y = 0; y < this.height; y++) {
      this.buffer.push(new Array(this.width).fill(' '));
    }
  }

  _setCell(x, y, char) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.buffer[y][x] = char;
    }
  }

  _getCell(x, y) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.buffer[y][x];
    }
    return ' ';
  }

  _setText(x, y, text) {
    for (let i = 0; i < text.length; i++) {
      this._setCell(x + i, y, text[i]);
    }
  }

  _bufferToString(options) {
    let lines = this.buffer.map(row => row.join(''));

    // Trim trailing whitespace from each line
    if (options.trimTrailingWhitespace) {
      lines = lines.map(line => line.trimEnd());
    }

    // Trim empty lines at end
    if (options.trimEmptyLines) {
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
      }
    }

    return lines.join('\n');
  }

  // ============================================================
  // Object Rendering
  // ============================================================

  _sortByZOrder(objects) {
    // Simple sort: boxes/symbols first, then lines/wires, then junctions on top
    const order = { 'box': 0, 'symbol': 1, 'line': 2, 'wire': 3, 'junction': 4, 'wire-junction': 5, 'wire-noconnect': 6 };
    return [...objects].sort((a, b) => (order[a.type] || 0) - (order[b.type] || 0));
  }

  _renderObject(obj, options) {
    switch (obj.type) {
      case 'box':
        this._renderBox(obj, options);
        break;
      case 'symbol':
        this._renderSymbol(obj, options);
        break;
      case 'line':
        this._renderLine(obj, options);
        break;
      case 'wire':
        this._renderWire(obj, options);
        break;
      case 'junction':
        this._renderJunction(obj, options);
        break;
      case 'wire-junction':
        this._renderWireJunction(obj, options);
        break;
      case 'wire-noconnect':
        this._renderWireNoConnect(obj, options);
        break;
    }
  }

  // ============================================================
  // Box Rendering
  // ============================================================

  _renderBox(obj, options) {
    const { x, y, width, height, style, shadow, text } = obj;
    const chars = this._getBoxChars(style);
    const hasBorder = style && style !== 'none';

    // Draw shadow first if enabled
    if (shadow && hasBorder && options.includeShadows) {
      for (let row = 1; row <= height; row++) {
        this._setCell(x + width, y + row, '░');
      }
      for (let col = 1; col < width; col++) {
        this._setCell(x + col, y + height, '░');
      }
      this._setCell(x + width, y + height, '░');
    }

    // Draw border
    if (hasBorder) {
      // Top
      this._setCell(x, y, chars.tl);
      for (let col = 1; col < width - 1; col++) {
        this._setCell(x + col, y, chars.h);
      }
      this._setCell(x + width - 1, y, chars.tr);

      // Sides
      for (let row = 1; row < height - 1; row++) {
        this._setCell(x, y + row, chars.v);
        this._setCell(x + width - 1, y + row, chars.v);
      }

      // Bottom
      this._setCell(x, y + height - 1, chars.bl);
      for (let col = 1; col < width - 1; col++) {
        this._setCell(x + col, y + height - 1, chars.h);
      }
      this._setCell(x + width - 1, y + height - 1, chars.br);
    }

    // Draw fill
    const fillChar = this._getFillChar(obj.fill);
    if (fillChar) {
      const startCol = hasBorder ? 1 : 0;
      const endCol = hasBorder ? width - 1 : width;
      const startRow = hasBorder ? 1 : 0;
      const endRow = hasBorder ? height - 1 : height;

      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          this._setCell(x + col, y + row, fillChar);
        }
      }
    }

    // Draw text
    if (text) {
      this._renderBoxText(obj);
    }
  }

  _renderBoxText(obj) {
    const { x, y, width, height, style, text, textJustify } = obj;
    const hasBorder = style && style !== 'none';

    const borderOffset = hasBorder ? 1 : 0;
    const innerWidth = hasBorder ? width - 2 : width;
    const innerHeight = hasBorder ? height - 2 : height;
    const lines = text.split('\n');

    const maxLines = Math.max(innerHeight, 1);
    const displayLines = lines.slice(0, maxLines);

    const justify = textJustify || 'center-center';
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

      this._setText(textX, startY + i, displayLine);
    });
  }

  // ============================================================
  // Line Rendering
  // ============================================================

  _renderLine(obj, options) {
    const { points, style, startCap, endCap } = obj;
    if (!points || points.length < 2) return;

    const chars = this._getLineChars(style);

    // Draw segments
    for (let i = 0; i < points.length - 1; i++) {
      this._renderSegment(points[i], points[i + 1], chars);
    }

    // Draw corners at intermediate points
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const cornerChar = this._getCornerChar(prev, curr, next, chars);
      if (cornerChar) {
        this._setCell(curr.x, curr.y, cornerChar);
      }
    }

    // Draw end caps
    if (startCap && startCap !== 'none') {
      this._renderEndCap(points[0], points[1], startCap, true);
    }
    if (endCap && endCap !== 'none') {
      this._renderEndCap(points[points.length - 1], points[points.length - 2], endCap, false);
    }
  }

  _renderSegment(p1, p2, chars) {
    const dx = Math.sign(p2.x - p1.x);
    const dy = Math.sign(p2.y - p1.y);

    if (dx !== 0 && dy === 0) {
      // Horizontal
      const startX = Math.min(p1.x, p2.x);
      const endX = Math.max(p1.x, p2.x);
      for (let x = startX; x <= endX; x++) {
        this._setCell(x, p1.y, chars.h);
      }
    } else if (dy !== 0 && dx === 0) {
      // Vertical
      const startY = Math.min(p1.y, p2.y);
      const endY = Math.max(p1.y, p2.y);
      for (let y = startY; y <= endY; y++) {
        this._setCell(p1.x, y, chars.v);
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

  _renderEndCap(point, adjacentPoint, capType, isStart) {
    const dir = isStart
      ? this._getDirection(point, adjacentPoint)
      : this._getDirection(adjacentPoint, point);

    const caps = this._getCapChars();
    const capChars = caps[capType];

    if (capChars && capChars[dir]) {
      this._setCell(point.x, point.y, capChars[dir]);
    }
  }

  // ============================================================
  // Wire Rendering
  // ============================================================

  _renderWire(obj, options) {
    // Wires render same as lines
    this._renderLine(obj, options);

    // Draw net label if present
    if (obj.net) {
      this._renderWireNetLabel(obj);
    }
  }

  _renderWireNetLabel(wire) {
    if (!wire.points || wire.points.length < 2) return;

    const midIndex = Math.floor((wire.points.length - 1) / 2);
    const p1 = wire.points[midIndex];
    const p2 = wire.points[midIndex + 1] || p1;

    const midX = Math.round((p1.x + p2.x) / 2);
    const midY = Math.round((p1.y + p2.y) / 2);

    const isHorizontal = p1.y === p2.y;
    const labelX = midX;
    const labelY = isHorizontal ? midY - 1 : midY;

    this._setText(labelX, labelY, wire.net);
  }

  // ============================================================
  // Symbol Rendering
  // ============================================================

  _renderSymbol(obj, options) {
    // Draw border (same as box)
    this._renderBox({
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      style: obj.style,
      shadow: obj.shadow,
      fill: obj.fill,
      text: obj.text,
      textJustify: obj.textJustify
    }, options);

    // Draw pins
    if (obj.pins && obj.pins.length > 0) {
      this._renderSymbolPins(obj);
    }

    // Draw designator
    if (obj.designator && obj.designator.visible) {
      const desig = obj.designator;
      const designatorText = `${desig.prefix}${desig.number}`;
      const desigX = obj.x + (desig.offset?.x || 0);
      const desigY = obj.y + (desig.offset?.y || -1);
      this._setText(desigX, desigY, designatorText);
    }

    // Draw parameters
    if (obj.parameters && obj.parameters.length > 0) {
      obj.parameters.forEach(param => {
        if (param.visible && param.value) {
          const paramX = obj.x + (param.offset?.x || 0);
          const paramY = obj.y + (param.offset?.y || obj.height);
          this._setText(paramX, paramY, param.value);
        }
      });
    }
  }

  _renderSymbolPins(obj) {
    const pinShapes = this._getPinChars();

    obj.pins.forEach(pin => {
      const pos = this._getPinPosition(obj, pin);
      const char = pinShapes[pin.shape] || pinShapes['circle-outline'];
      this._setCell(pos.x, pos.y, char);

      // Draw pin name
      if (pin.name) {
        this._renderPinName(obj, pin, pos);
      }
    });
  }

  _getPinPosition(symbol, pin) {
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
        return { x, y };
    }
  }

  _renderPinName(symbol, pin, pinPos) {
    const name = pin.name;
    if (!name) return;

    const { x, width } = symbol;

    switch (pin.edge) {
      case 'left':
        for (let i = 0; i < name.length; i++) {
          const nameX = pinPos.x + 1 + i;
          if (nameX < x + width - 1) {
            this._setCell(nameX, pinPos.y, name[i]);
          }
        }
        break;
      case 'right':
        const startX = pinPos.x - name.length;
        for (let i = 0; i < name.length; i++) {
          const nameX = startX + i;
          if (nameX > x) {
            this._setCell(nameX, pinPos.y, name[i]);
          }
        }
        break;
      case 'top':
        const topCenterX = pinPos.x - Math.floor(name.length / 2);
        for (let i = 0; i < name.length; i++) {
          this._setCell(topCenterX + i, pinPos.y + 1, name[i]);
        }
        break;
      case 'bottom':
        const bottomCenterX = pinPos.x - Math.floor(name.length / 2);
        for (let i = 0; i < name.length; i++) {
          this._setCell(bottomCenterX + i, pinPos.y - 1, name[i]);
        }
        break;
    }
  }

  // ============================================================
  // Junction Rendering
  // ============================================================

  _renderJunction(obj, options) {
    const chars = { single: '●', double: '■', thick: '█' };
    const char = chars[obj.style] || chars.single;
    this._setCell(obj.x, obj.y, char);
  }

  _renderWireJunction(obj, options) {
    const chars = { single: '●', double: '●', thick: '█' };
    const char = chars[obj.style] || chars.single;
    this._setCell(obj.x, obj.y, char);
  }

  _renderWireNoConnect(obj, options) {
    this._setCell(obj.x, obj.y, 'X');
  }

  // ============================================================
  // Character Sets
  // ============================================================

  _getBoxChars(style) {
    const sets = {
      single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
      double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
      thick: { tl: '█', tr: '█', bl: '█', br: '█', h: '█', v: '█' }
    };
    return sets[style] || sets.single;
  }

  _getLineChars(style) {
    // Try to get from LineStyles if available
    if (AsciiEditor.tools && AsciiEditor.tools.LineStyles) {
      const styleDef = AsciiEditor.tools.LineStyles.find(s => s.key === style);
      if (styleDef) {
        return styleDef.chars;
      }
    }
    // Fallback
    const sets = {
      single: { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' },
      double: { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝' },
      thick: { h: '█', v: '█', tl: '█', tr: '█', bl: '█', br: '█' }
    };
    return sets[style] || sets.single;
  }

  _getFillChar(fill) {
    const chars = {
      'none': null,
      'light': '░',
      'medium': '▒',
      'dark': '▓',
      'solid': '█',
      'dots': '·'
    };
    return chars[fill] || null;
  }

  _getPinChars() {
    return {
      'circle': '●',
      'circle-outline': '○',
      'square': '■',
      'square-outline': '□',
      'diamond': '◆',
      'diamond-outline': '◇',
      'triangle': '▶',
      'triangle-outline': '▷'
    };
  }

  _getCapChars() {
    return {
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
  }
};
