/**
 * Tests for lineUtils - pure functions for line/wire manipulation
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Set up minimal DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;

// Load the lineUtils module
const lineUtilsCode = fs.readFileSync(
  path.join(__dirname, '../js/core/lineUtils.js'),
  'utf8'
);
eval(lineUtilsCode);

const lineUtils = AsciiEditor.core.lineUtils;

describe('lineUtils.getPreviewPath', () => {
  test('returns empty array for null inputs', () => {
    expect(lineUtils.getPreviewPath(null, { x: 5, y: 5 })).toEqual([]);
    expect(lineUtils.getPreviewPath({ x: 0, y: 0 }, null)).toEqual([]);
  });

  test('straight horizontal line (same Y)', () => {
    const result = lineUtils.getPreviewPath({ x: 0, y: 5 }, { x: 10, y: 5 });
    expect(result).toEqual([{ x: 0, y: 5 }, { x: 10, y: 5 }]);
  });

  test('straight vertical line (same X)', () => {
    const result = lineUtils.getPreviewPath({ x: 5, y: 0 }, { x: 5, y: 10 });
    expect(result).toEqual([{ x: 5, y: 0 }, { x: 5, y: 10 }]);
  });

  test('diagonal with hFirst=true creates horizontal-then-vertical path', () => {
    const result = lineUtils.getPreviewPath({ x: 0, y: 0 }, { x: 10, y: 5 }, true);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },  // intermediate: horizontal first
      { x: 10, y: 5 }
    ]);
  });

  test('diagonal with hFirst=false creates vertical-then-horizontal path', () => {
    const result = lineUtils.getPreviewPath({ x: 0, y: 0 }, { x: 10, y: 5 }, false);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 5 },   // intermediate: vertical first
      { x: 10, y: 5 }
    ]);
  });

  test('negative diagonal direction works', () => {
    const result = lineUtils.getPreviewPath({ x: 10, y: 10 }, { x: 0, y: 0 }, true);
    expect(result).toEqual([
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 }
    ]);
  });
});

describe('lineUtils.simplifyPoints', () => {
  test('returns same array for less than 3 points', () => {
    expect(lineUtils.simplifyPoints([])).toEqual([]);
    expect(lineUtils.simplifyPoints([{ x: 0, y: 0 }])).toEqual([{ x: 0, y: 0 }]);
    expect(lineUtils.simplifyPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }]))
      .toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  test('removes collinear horizontal points', () => {
    const points = [
      { x: 0, y: 5 },
      { x: 5, y: 5 },  // collinear - should be removed
      { x: 10, y: 5 }
    ];
    expect(lineUtils.simplifyPoints(points)).toEqual([
      { x: 0, y: 5 },
      { x: 10, y: 5 }
    ]);
  });

  test('removes collinear vertical points', () => {
    const points = [
      { x: 5, y: 0 },
      { x: 5, y: 5 },  // collinear - should be removed
      { x: 5, y: 10 }
    ];
    expect(lineUtils.simplifyPoints(points)).toEqual([
      { x: 5, y: 0 },
      { x: 5, y: 10 }
    ]);
  });

  test('keeps corner points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },  // corner - should be kept
      { x: 10, y: 10 }
    ];
    expect(lineUtils.simplifyPoints(points)).toEqual(points);
  });

  test('simplifies L-shaped path with extra points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },   // collinear
      { x: 10, y: 0 },  // corner
      { x: 10, y: 5 },  // collinear
      { x: 10, y: 10 }
    ];
    expect(lineUtils.simplifyPoints(points)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ]);
  });
});

describe('lineUtils.getDirection', () => {
  test('returns right for positive X', () => {
    expect(lineUtils.getDirection({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe('right');
  });

  test('returns left for negative X', () => {
    expect(lineUtils.getDirection({ x: 5, y: 0 }, { x: 0, y: 0 })).toBe('left');
  });

  test('returns down for positive Y', () => {
    expect(lineUtils.getDirection({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe('down');
  });

  test('returns up for negative Y', () => {
    expect(lineUtils.getDirection({ x: 0, y: 5 }, { x: 0, y: 0 })).toBe('up');
  });

  test('returns none for same point', () => {
    expect(lineUtils.getDirection({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe('none');
  });

  test('X takes priority over Y for diagonal (returns horizontal direction)', () => {
    // This tests the actual behavior - X is checked first
    expect(lineUtils.getDirection({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe('right');
  });
});

describe('lineUtils.getCornerChar', () => {
  const chars = { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' };

  test('right-down corner returns tr', () => {
    const prev = { x: 0, y: 5 };
    const curr = { x: 5, y: 5 };
    const next = { x: 5, y: 10 };
    expect(lineUtils.getCornerChar(prev, curr, next, chars)).toBe('┐');
  });

  test('right-up corner returns br', () => {
    const prev = { x: 0, y: 5 };
    const curr = { x: 5, y: 5 };
    const next = { x: 5, y: 0 };
    expect(lineUtils.getCornerChar(prev, curr, next, chars)).toBe('┘');
  });

  test('down-right corner returns bl', () => {
    const prev = { x: 5, y: 0 };
    const curr = { x: 5, y: 5 };
    const next = { x: 10, y: 5 };
    expect(lineUtils.getCornerChar(prev, curr, next, chars)).toBe('└');
  });

  test('down-left corner returns br', () => {
    const prev = { x: 5, y: 0 };
    const curr = { x: 5, y: 5 };
    const next = { x: 0, y: 5 };
    expect(lineUtils.getCornerChar(prev, curr, next, chars)).toBe('┘');
  });
});

describe('lineUtils.pointOnSegment', () => {
  test('point on horizontal segment returns true', () => {
    expect(lineUtils.pointOnSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true);
  });

  test('point at start of horizontal segment returns true', () => {
    expect(lineUtils.pointOnSegment({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true);
  });

  test('point at end of horizontal segment returns true', () => {
    expect(lineUtils.pointOnSegment({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true);
  });

  test('point off horizontal segment returns false', () => {
    expect(lineUtils.pointOnSegment({ x: 5, y: 1 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(false);
  });

  test('point on vertical segment returns true', () => {
    expect(lineUtils.pointOnSegment({ x: 0, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toBe(true);
  });

  test('point off vertical segment returns false', () => {
    expect(lineUtils.pointOnSegment({ x: 1, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toBe(false);
  });

  test('point outside segment range returns false', () => {
    expect(lineUtils.pointOnSegment({ x: 15, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(false);
  });
});

describe('lineUtils.findPointOnLine', () => {
  const line = {
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ]
  };

  test('returns null for invalid line', () => {
    expect(lineUtils.findPointOnLine({ x: 0, y: 0 }, {})).toBeNull();
    expect(lineUtils.findPointOnLine({ x: 0, y: 0 }, { points: [] })).toBeNull();
    expect(lineUtils.findPointOnLine({ x: 0, y: 0 }, { points: [{ x: 0, y: 0 }] })).toBeNull();
  });

  test('finds vertex at start', () => {
    const result = lineUtils.findPointOnLine({ x: 0, y: 0 }, line);
    expect(result).toEqual({ segmentIndex: 0, isVertex: true, vertexIndex: 0 });
  });

  test('finds vertex at corner', () => {
    const result = lineUtils.findPointOnLine({ x: 10, y: 0 }, line);
    expect(result).toEqual({ segmentIndex: 0, isVertex: true, vertexIndex: 1 });
  });

  test('finds vertex at end', () => {
    const result = lineUtils.findPointOnLine({ x: 10, y: 10 }, line);
    expect(result).toEqual({ segmentIndex: 1, isVertex: true, vertexIndex: 2 });
  });

  test('finds point on first segment', () => {
    const result = lineUtils.findPointOnLine({ x: 5, y: 0 }, line);
    expect(result).toEqual({ segmentIndex: 0, isVertex: false, vertexIndex: null });
  });

  test('finds point on second segment', () => {
    const result = lineUtils.findPointOnLine({ x: 10, y: 5 }, line);
    expect(result).toEqual({ segmentIndex: 1, isVertex: false, vertexIndex: null });
  });

  test('returns null for point not on line', () => {
    expect(lineUtils.findPointOnLine({ x: 5, y: 5 }, line)).toBeNull();
  });
});

describe('lineUtils.getSegmentMidpoint', () => {
  test('calculates midpoint of horizontal segment', () => {
    expect(lineUtils.getSegmentMidpoint({ x: 0, y: 5 }, { x: 10, y: 5 }))
      .toEqual({ x: 5, y: 5 });
  });

  test('calculates midpoint of vertical segment', () => {
    expect(lineUtils.getSegmentMidpoint({ x: 5, y: 0 }, { x: 5, y: 10 }))
      .toEqual({ x: 5, y: 5 });
  });

  test('rounds midpoint for odd lengths', () => {
    expect(lineUtils.getSegmentMidpoint({ x: 0, y: 0 }, { x: 5, y: 0 }))
      .toEqual({ x: 3, y: 0 });  // 2.5 rounds to 3
  });
});

describe('lineUtils.segmentIntersection', () => {
  test('finds intersection of perpendicular segments', () => {
    const result = lineUtils.segmentIntersection(
      { x: 0, y: 5 }, { x: 10, y: 5 },  // horizontal
      { x: 5, y: 0 }, { x: 5, y: 10 }   // vertical
    );
    expect(result).toEqual({ x: 5, y: 5 });
  });

  test('returns null for parallel horizontal segments', () => {
    const result = lineUtils.segmentIntersection(
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 0, y: 5 }, { x: 10, y: 5 }
    );
    expect(result).toBeNull();
  });

  test('returns null for parallel vertical segments', () => {
    const result = lineUtils.segmentIntersection(
      { x: 0, y: 0 }, { x: 0, y: 10 },
      { x: 5, y: 0 }, { x: 5, y: 10 }
    );
    expect(result).toBeNull();
  });

  test('returns null for non-intersecting perpendicular segments', () => {
    const result = lineUtils.segmentIntersection(
      { x: 0, y: 0 }, { x: 5, y: 0 },   // horizontal, ends at x=5
      { x: 10, y: 0 }, { x: 10, y: 10 } // vertical at x=10
    );
    expect(result).toBeNull();
  });

  test('finds intersection at segment endpoints', () => {
    const result = lineUtils.segmentIntersection(
      { x: 0, y: 5 }, { x: 5, y: 5 },   // horizontal ending at (5,5)
      { x: 5, y: 0 }, { x: 5, y: 10 }   // vertical through x=5
    );
    expect(result).toEqual({ x: 5, y: 5 });
  });
});
