/**
 * Tests for text box export functionality
 * Creates actual .txt files for Notepad inspection
 */

const fs = require('fs');
const path = require('path');

// Copy of renderBoxToBuffer from Editor.js
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

function exportProject(project) {
  const page = project.pages[0];
  const buffer = [];
  for (let r = 0; r < page.height; r++) {
    buffer.push(new Array(page.width).fill(' '));
  }

  page.objects.forEach(obj => {
    if (obj.type === 'box') {
      renderBoxToBuffer(buffer, obj);
    }
  });

  return buffer.map(row => row.join('')).join('\n');
}

function loadFixture(name) {
  const filePath = path.join(__dirname, 'fixtures', name);
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function writeOutput(name, content) {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  // Write with UTF-8 BOM and CRLF line endings for proper Notepad display
  const bom = '\ufeff';
  const windowsContent = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(path.join(outputDir, name), bom + windowsContent, 'utf8');
}

// Test suite
describe('Text Box Export - File Generation', () => {
  test('simple text box exports correctly', () => {
    const project = loadFixture('textbox-simple.json');
    const output = exportProject(project);
    writeOutput('textbox-simple.txt', output);

    // Verify the box structure
    const lines = output.split('\n');

    // Box should be at row 2, starting at col 2
    expect(lines[2].includes('┌')).toBe(true);
    expect(lines[2].includes('┐')).toBe(true);

    // Text "Hello World" should be inside
    expect(output.includes('Hello World')).toBe(true);

    // Bottom border
    expect(lines[6].includes('└')).toBe(true);
    expect(lines[6].includes('┘')).toBe(true);

    console.log('Simple box output:\n' + output);
  });

  test('multiline text box exports correctly', () => {
    const project = loadFixture('textbox-multiline.json');
    const output = exportProject(project);
    writeOutput('textbox-multiline.txt', output);

    // Verify all text content is present
    expect(output.includes('Line One')).toBe(true);
    expect(output.includes('Line Two')).toBe(true);
    expect(output.includes('Line Three')).toBe(true);
    expect(output.includes('Top Left')).toBe(true);
    expect(output.includes('With Shadow')).toBe(true);
    expect(output.includes('With Fill')).toBe(true);

    // Verify double border chars
    expect(output.includes('╔')).toBe(true);
    expect(output.includes('╗')).toBe(true);

    // Verify shadow char
    expect(output.includes('░')).toBe(true);

    console.log('Multiline output:\n' + output);
  });

  test('alignment test exports correctly', () => {
    const project = loadFixture('textbox-alignment.json');
    const output = exportProject(project);
    writeOutput('textbox-alignment.txt', output);

    // All alignment labels should be present
    expect(output.includes('TOP LEFT')).toBe(true);
    expect(output.includes('TOP CENTER')).toBe(true);
    expect(output.includes('TOP RIGHT')).toBe(true);
    expect(output.includes('CENTER LEFT')).toBe(true);
    expect(output.includes('CENTER')).toBe(true);
    expect(output.includes('CENTER RIGHT')).toBe(true);
    expect(output.includes('BOTTOM LEFT')).toBe(true);
    expect(output.includes('BOTTOM CTR')).toBe(true);
    expect(output.includes('BOTTOM RIGHT')).toBe(true);

    console.log('Alignment output:\n' + output);
  });
});

describe('Text Box Export - Line Width Consistency', () => {
  test('all lines in export have same width', () => {
    const project = loadFixture('textbox-simple.json');
    const output = exportProject(project);
    const lines = output.split('\n');

    // All lines should be same width (page width)
    const expectedWidth = project.pages[0].width;
    lines.forEach((line, i) => {
      expect(line.length).toBe(expectedWidth);
    });
  });

  test('multiline export has consistent line widths', () => {
    const project = loadFixture('textbox-multiline.json');
    const output = exportProject(project);
    const lines = output.split('\n');

    const expectedWidth = project.pages[0].width;
    lines.forEach((line, i) => {
      if (line.length !== expectedWidth) {
        console.log(`Line ${i} has length ${line.length}, expected ${expectedWidth}`);
        console.log(`Line content: "${line}"`);
      }
      expect(line.length).toBe(expectedWidth);
    });
  });
});

describe('Text Box Export - Character Position Verification', () => {
  test('box corners are at correct positions', () => {
    const project = loadFixture('textbox-simple.json');
    const output = exportProject(project);
    const lines = output.split('\n');

    const box = project.pages[0].objects[0];

    // Top-left corner at (x, y)
    expect(lines[box.y][box.x]).toBe('┌');

    // Top-right corner at (x + width - 1, y)
    expect(lines[box.y][box.x + box.width - 1]).toBe('┐');

    // Bottom-left corner at (x, y + height - 1)
    expect(lines[box.y + box.height - 1][box.x]).toBe('└');

    // Bottom-right corner at (x + width - 1, y + height - 1)
    expect(lines[box.y + box.height - 1][box.x + box.width - 1]).toBe('┘');
  });

  test('text is positioned correctly within box', () => {
    const project = loadFixture('textbox-simple.json');
    const output = exportProject(project);
    const lines = output.split('\n');

    const box = project.pages[0].objects[0];
    const text = box.text;
    const innerWidth = box.width - 2;
    const innerHeight = box.height - 2;

    // For center-center justification with "Hello World" (11 chars)
    // innerWidth = 15 - 2 = 13
    // textX = x + 1 + floor((13 - 11) / 2) = x + 1 + 1 = x + 2
    // But wait, floor((13-11)/2) = floor(1) = 1, so textX = 2 + 1 + 1 = 4

    // innerHeight = 5 - 2 = 3
    // startY = y + 1 + floor((3 - 1) / 2) = y + 1 + 1 = y + 2
    // So text should be at row y+2 = 4

    const textRow = box.y + 1 + Math.floor((innerHeight - 1) / 2);
    const textStartCol = box.x + 1 + Math.floor((innerWidth - text.length) / 2);

    // Check the text is there
    const rowContent = lines[textRow];
    expect(rowContent.includes(text)).toBe(true);

    // Verify exact position
    const textInRow = rowContent.substring(textStartCol, textStartCol + text.length);
    expect(textInRow).toBe(text);
  });
});

describe('Text Box Export - Edge Cases', () => {
  test('empty text box renders correctly', () => {
    const project = {
      pages: [{
        width: 20,
        height: 10,
        objects: [{
          type: 'box',
          x: 2, y: 2, width: 10, height: 5,
          style: 'single',
          shadow: false,
          fill: 'none',
          text: '',
          textJustify: 'center-center'
        }]
      }]
    };

    const output = exportProject(project);
    const lines = output.split('\n');

    // Box should still render without text
    expect(lines[2].includes('┌')).toBe(true);
    expect(lines[6].includes('└')).toBe(true);

    // Interior should be spaces
    expect(lines[4].substring(3, 11).trim()).toBe('');
  });

  test('very long text is truncated', () => {
    const project = {
      pages: [{
        width: 20,
        height: 10,
        objects: [{
          type: 'box',
          x: 2, y: 2, width: 10, height: 5,
          style: 'single',
          shadow: false,
          fill: 'none',
          text: 'This is a very long text that should be truncated',
          textJustify: 'center-center'
        }]
      }]
    };

    const output = exportProject(project);
    writeOutput('textbox-truncated.txt', output);

    // Full text should NOT appear (it's too long)
    expect(output.includes('This is a very long text')).toBe(false);

    // But partial text should appear (innerWidth = 8)
    expect(output.includes('This is ')).toBe(true);
  });
});
