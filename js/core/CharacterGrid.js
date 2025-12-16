/**
 * CharacterGrid - Handles pixel-to-character coordinate transforms
 * Implements: ARCH-30 to ARCH-33
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

AsciiEditor.core.CharacterGrid = class CharacterGrid {
  constructor(charWidth, charHeight) {
    this.charWidth = charWidth;
    this.charHeight = charHeight;
  }

  // Pixel to character coordinates
  pixelToChar(px, py) {
    return {
      col: Math.floor(px / this.charWidth),
      row: Math.floor(py / this.charHeight)
    };
  }

  // Character to pixel coordinates (top-left of cell)
  charToPixel(col, row) {
    return {
      x: col * this.charWidth,
      y: row * this.charHeight
    };
  }

  // Get pixel bounds for a character cell
  getCellBounds(col, row) {
    return {
      x: col * this.charWidth,
      y: row * this.charHeight,
      width: this.charWidth,
      height: this.charHeight
    };
  }

  // Snap pixel coordinates to grid
  snapToGrid(px, py) {
    const char = this.pixelToChar(px, py);
    return this.charToPixel(char.col, char.row);
  }
};
