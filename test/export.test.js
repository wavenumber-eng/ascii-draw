/**
 * Tests for ASCII export functionality
 * This tests the renderBoxToBuffer logic to catch rendering bugs
 */

// Copy of renderBoxToBuffer for testing (same as Editor.js)
function renderBoxToBuffer(buffer, obj) {
  const { x, y, width, height, style, text, shadow } = obj;

  const chars = {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    thick: { tl: '█', tr: '█', bl: '█', br: '█', h: '█', v: '█' }
  };

  const c = chars[style] || chars.single;
  const hasBorder = style && style !== 'none';

  const setChar = (col, row, char) => {
    if (row >= 0 && row < buffer.length && col >= 0 && col < buffer[0].length) {
      buffer[row][col] = char;
    }
  };

  // Draw shadow first (if enabled and has border)
  if (shadow && hasBorder) {
    for (let row = 1; row <= height; row++) {
      setChar(x + width, y + row, '░');
    }
    for (let col = 1; col < width; col++) {
      setChar(x + col, y + height, '░');
    }
    setChar(x + width, y + height, '░');
  }

  // Draw border (if not style: none)
  if (hasBorder) {
    // Top border
    setChar(x, y, c.tl);
    for (let col = 1; col < width - 1; col++) {
      setChar(x + col, y, c.h);
    }
    setChar(x + width - 1, y, c.tr);

    // Sides
    for (let row = 1; row < height - 1; row++) {
      setChar(x, y + row, c.v);
      setChar(x + width - 1, y + row, c.v);
    }

    // Bottom border
    setChar(x, y + height - 1, c.bl);
    for (let col = 1; col < width - 1; col++) {
      setChar(x + col, y + height - 1, c.h);
    }
    setChar(x + width - 1, y + height - 1, c.br);
  }

  // Fill interior
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
        setChar(x + col, y + row, fillChar);
      }
    }
  }

  // Text
  if (text) {
    const innerWidth = width - 2;
    const innerHeight = height - 2;
    const lines = text.split('\n');
    const maxLines = innerHeight;
    const displayLines = lines.slice(0, maxLines);

    const justify = obj.textJustify || 'center-center';
    const [vAlign, hAlign] = justify.split('-');

    let startY;
    if (vAlign === 'top') {
      startY = y + 1;
    } else if (vAlign === 'bottom') {
      startY = y + height - 1 - displayLines.length;
    } else {
      startY = y + 1 + Math.floor((innerHeight - displayLines.length) / 2);
    }

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

      for (let j = 0; j < displayLine.length; j++) {
        setChar(textX + j, startY + i, displayLine[j]);
      }
    });
  }
}

function createBuffer(width, height) {
  const buffer = [];
  for (let r = 0; r < height; r++) {
    buffer.push(new Array(width).fill(' '));
  }
  return buffer;
}

function bufferToString(buffer) {
  return buffer.map(row => row.join('')).join('\n');
}

function exportBox(box, pageWidth, pageHeight) {
  const buffer = createBuffer(pageWidth, pageHeight);
  renderBoxToBuffer(buffer, box);
  return bufferToString(buffer);
}

describe('Box Export - Basic Shapes', () => {
  test('5x3 single border box', () => {
    const result = exportBox({
      x: 0, y: 0, width: 5, height: 3,
      style: 'single', shadow: false, textJustify: 'center-center'
    }, 5, 3);

    expect(result).toBe(
      '┌───┐\n' +
      '│   │\n' +
      '└───┘'
    );
  });

  test('3x3 minimum size box', () => {
    const result = exportBox({
      x: 0, y: 0, width: 3, height: 3,
      style: 'single', shadow: false, textJustify: 'center-center'
    }, 3, 3);

    expect(result).toBe(
      '┌─┐\n' +
      '│ │\n' +
      '└─┘'
    );
  });

  test('10x3 wide box', () => {
    const result = exportBox({
      x: 0, y: 0, width: 10, height: 3,
      style: 'single', shadow: false, textJustify: 'center-center'
    }, 10, 3);

    expect(result).toBe(
      '┌────────┐\n' +
      '│        │\n' +
      '└────────┘'
    );
  });

  test('4x6 tall box', () => {
    const result = exportBox({
      x: 0, y: 0, width: 4, height: 6,
      style: 'single', shadow: false, textJustify: 'center-center'
    }, 4, 6);

    expect(result).toBe(
      '┌──┐\n' +
      '│  │\n' +
      '│  │\n' +
      '│  │\n' +
      '│  │\n' +
      '└──┘'
    );
  });
});

describe('Box Export - Border Styles', () => {
  test('double border', () => {
    const result = exportBox({
      x: 0, y: 0, width: 5, height: 3,
      style: 'double', shadow: false, textJustify: 'center-center'
    }, 5, 3);

    expect(result).toBe(
      '╔═══╗\n' +
      '║   ║\n' +
      '╚═══╝'
    );
  });

  test('thick border', () => {
    const result = exportBox({
      x: 0, y: 0, width: 5, height: 3,
      style: 'thick', shadow: false, textJustify: 'center-center'
    }, 5, 3);

    expect(result).toBe(
      '█████\n' +
      '█   █\n' +
      '█████'
    );
  });

  test('no border (style: none)', () => {
    const result = exportBox({
      x: 0, y: 0, width: 5, height: 3,
      style: 'none', shadow: false, textJustify: 'center-center'
    }, 5, 3);

    // Should be all spaces - no border drawn
    expect(result).toBe(
      '     \n' +
      '     \n' +
      '     '
    );
  });
});

describe('Box Export - Shadow', () => {
  test('box with shadow', () => {
    const result = exportBox({
      x: 0, y: 0, width: 5, height: 3,
      style: 'single', shadow: true, textJustify: 'center-center'
    }, 6, 4);

    expect(result).toBe(
      '┌───┐ \n' +
      '│   │░\n' +
      '└───┘░\n' +
      ' ░░░░░'
    );
  });

  test('shadow with style:none should not render shadow', () => {
    const result = exportBox({
      x: 0, y: 0, width: 5, height: 3,
      style: 'none', shadow: true, textJustify: 'center-center'
    }, 6, 4);

    // No border = no shadow
    expect(result).toBe(
      '      \n' +
      '      \n' +
      '      \n' +
      '      '
    );
  });
});

describe('Box Export - Fill', () => {
  test('light fill', () => {
    const result = exportBox({
      x: 0, y: 0, width: 5, height: 4,
      style: 'single', shadow: false, fill: 'light', textJustify: 'center-center'
    }, 5, 4);

    expect(result).toBe(
      '┌───┐\n' +
      '│░░░│\n' +
      '│░░░│\n' +
      '└───┘'
    );
  });

  test('medium fill', () => {
    const result = exportBox({
      x: 0, y: 0, width: 5, height: 4,
      style: 'single', shadow: false, fill: 'medium', textJustify: 'center-center'
    }, 5, 4);

    expect(result).toBe(
      '┌───┐\n' +
      '│▒▒▒│\n' +
      '│▒▒▒│\n' +
      '└───┘'
    );
  });

  test('dots fill', () => {
    const result = exportBox({
      x: 0, y: 0, width: 5, height: 4,
      style: 'single', shadow: false, fill: 'dots', textJustify: 'center-center'
    }, 5, 4);

    expect(result).toBe(
      '┌───┐\n' +
      '│···│\n' +
      '│···│\n' +
      '└───┘'
    );
  });
});

describe('Box Export - Text', () => {
  test('centered text', () => {
    const result = exportBox({
      x: 0, y: 0, width: 7, height: 5,
      style: 'single', shadow: false, text: 'Hi', textJustify: 'center-center'
    }, 7, 5);

    expect(result).toBe(
      '┌─────┐\n' +
      '│     │\n' +
      '│ Hi  │\n' +
      '│     │\n' +
      '└─────┘'
    );
  });

  test('top-left text', () => {
    const result = exportBox({
      x: 0, y: 0, width: 7, height: 5,
      style: 'single', shadow: false, text: 'Hi', textJustify: 'top-left'
    }, 7, 5);

    expect(result).toBe(
      '┌─────┐\n' +
      '│Hi   │\n' +
      '│     │\n' +
      '│     │\n' +
      '└─────┘'
    );
  });

  test('bottom-right text', () => {
    const result = exportBox({
      x: 0, y: 0, width: 7, height: 5,
      style: 'single', shadow: false, text: 'Hi', textJustify: 'bottom-right'
    }, 7, 5);

    expect(result).toBe(
      '┌─────┐\n' +
      '│     │\n' +
      '│     │\n' +
      '│   Hi│\n' +
      '└─────┘'
    );
  });

  test('multi-line text', () => {
    const result = exportBox({
      x: 0, y: 0, width: 8, height: 6,
      style: 'single', shadow: false, text: 'Line1\nLine2', textJustify: 'center-center'
    }, 8, 6);

    expect(result).toBe(
      '┌──────┐\n' +
      '│      │\n' +
      '│Line1 │\n' +
      '│Line2 │\n' +
      '│      │\n' +
      '└──────┘'
    );
  });

  test('text with fill (text overwrites fill)', () => {
    const result = exportBox({
      x: 0, y: 0, width: 7, height: 5,
      style: 'single', shadow: false, fill: 'light', text: 'Hi', textJustify: 'center-center'
    }, 7, 5);

    expect(result).toBe(
      '┌─────┐\n' +
      '│░░░░░│\n' +
      '│░Hi░░│\n' +
      '│░░░░░│\n' +
      '└─────┘'
    );
  });
});

describe('Box Export - Position Offset', () => {
  test('box at offset position', () => {
    const result = exportBox({
      x: 2, y: 1, width: 5, height: 3,
      style: 'single', shadow: false, textJustify: 'center-center'
    }, 10, 5);

    expect(result).toBe(
      '          \n' +
      '  ┌───┐   \n' +
      '  │   │   \n' +
      '  └───┘   \n' +
      '          '
    );
  });

  test('box at bottom-right corner', () => {
    const result = exportBox({
      x: 5, y: 2, width: 5, height: 3,
      style: 'single', shadow: false, textJustify: 'center-center'
    }, 10, 5);

    expect(result).toBe(
      '          \n' +
      '          \n' +
      '     ┌───┐\n' +
      '     │   │\n' +
      '     └───┘'
    );
  });
});

describe('Box Export - Edge Cases', () => {
  test('box extending beyond buffer is clipped', () => {
    // Box at position that would extend beyond buffer
    const result = exportBox({
      x: 3, y: 0, width: 5, height: 3,
      style: 'single', shadow: false, textJustify: 'center-center'
    }, 5, 3);

    // Only partial box visible
    expect(result).toBe(
      '   ┌─\n' +
      '   │ \n' +
      '   └─'
    );
  });

  test('very long text is truncated', () => {
    const result = exportBox({
      x: 0, y: 0, width: 6, height: 3,
      style: 'single', shadow: false, text: 'VeryLongText', textJustify: 'center-center'
    }, 6, 3);

    // Inner width is 4, text truncated to 4 chars
    expect(result).toBe(
      '┌────┐\n' +
      '│Very│\n' +
      '└────┘'
    );
  });
});

// Additional tests to help debug the specific bug
describe('Box Export - Width Verification', () => {
  test('top border has correct character count', () => {
    const buffer = createBuffer(10, 3);
    renderBoxToBuffer(buffer, {
      x: 0, y: 0, width: 10, height: 3,
      style: 'single', shadow: false, textJustify: 'center-center'
    });

    // Count non-space chars in row 0
    const topRow = buffer[0];
    const charCount = topRow.filter(c => c !== ' ').length;

    expect(charCount).toBe(10); // Should be exactly 10 chars
    expect(topRow[0]).toBe('┌');
    expect(topRow[9]).toBe('┐');
  });

  test('bottom border has correct character count', () => {
    const buffer = createBuffer(10, 3);
    renderBoxToBuffer(buffer, {
      x: 0, y: 0, width: 10, height: 3,
      style: 'single', shadow: false, textJustify: 'center-center'
    });

    const bottomRow = buffer[2];
    const charCount = bottomRow.filter(c => c !== ' ').length;

    expect(charCount).toBe(10);
    expect(bottomRow[0]).toBe('└');
    expect(bottomRow[9]).toBe('┘');
  });

  test('horizontal chars count equals width minus corners', () => {
    const width = 8;
    const buffer = createBuffer(width, 3);
    renderBoxToBuffer(buffer, {
      x: 0, y: 0, width, height: 3,
      style: 'single', shadow: false, textJustify: 'center-center'
    });

    const topRow = buffer[0];
    const hChars = topRow.filter(c => c === '─').length;

    // Horizontal chars = width - 2 (for corners)
    expect(hChars).toBe(width - 2);
  });
});
