/**
 * Unit tests for domain/Line.js
 * Tests pure geometric functions for lines and polylines.
 */

describe('domain.Line', () => {
  let Line;

  beforeAll(() => {
    Line = AsciiEditor.domain.Line;
  });

  describe('pointsEqual', () => {
    test('returns true for identical points', () => {
      expect(Line.pointsEqual({ x: 5, y: 10 }, { x: 5, y: 10 })).toBe(true);
    });

    test('returns false for different points', () => {
      expect(Line.pointsEqual({ x: 5, y: 10 }, { x: 5, y: 11 })).toBe(false);
      expect(Line.pointsEqual({ x: 5, y: 10 }, { x: 6, y: 10 })).toBe(false);
    });
  });

  describe('clonePoint', () => {
    test('creates a new object with same coordinates', () => {
      const original = { x: 3, y: 7 };
      const cloned = Line.clonePoint(original);
      expect(cloned).toEqual({ x: 3, y: 7 });
      expect(cloned).not.toBe(original);
    });
  });

  describe('getDirection', () => {
    test('returns "right" for positive x delta', () => {
      expect(Line.getDirection({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe('right');
    });

    test('returns "left" for negative x delta', () => {
      expect(Line.getDirection({ x: 5, y: 0 }, { x: 0, y: 0 })).toBe('left');
    });

    test('returns "down" for positive y delta', () => {
      expect(Line.getDirection({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe('down');
    });

    test('returns "up" for negative y delta', () => {
      expect(Line.getDirection({ x: 0, y: 5 }, { x: 0, y: 0 })).toBe('up');
    });

    test('returns "none" for same point', () => {
      expect(Line.getDirection({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe('none');
    });
  });

  describe('oppositeDirection', () => {
    test('returns correct opposites', () => {
      expect(Line.oppositeDirection('right')).toBe('left');
      expect(Line.oppositeDirection('left')).toBe('right');
      expect(Line.oppositeDirection('up')).toBe('down');
      expect(Line.oppositeDirection('down')).toBe('up');
      expect(Line.oppositeDirection('none')).toBe('none');
    });
  });

  describe('pointOnSegment', () => {
    test('returns true for point on horizontal segment', () => {
      expect(Line.pointOnSegment({ x: 5, y: 3 }, { x: 2, y: 3 }, { x: 8, y: 3 })).toBe(true);
    });

    test('returns true for point on vertical segment', () => {
      expect(Line.pointOnSegment({ x: 3, y: 5 }, { x: 3, y: 2 }, { x: 3, y: 8 })).toBe(true);
    });

    test('returns true for point at segment endpoint', () => {
      expect(Line.pointOnSegment({ x: 2, y: 3 }, { x: 2, y: 3 }, { x: 8, y: 3 })).toBe(true);
      expect(Line.pointOnSegment({ x: 8, y: 3 }, { x: 2, y: 3 }, { x: 8, y: 3 })).toBe(true);
    });

    test('returns false for point outside segment', () => {
      expect(Line.pointOnSegment({ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 8, y: 3 })).toBe(false);
      expect(Line.pointOnSegment({ x: 5, y: 4 }, { x: 2, y: 3 }, { x: 8, y: 3 })).toBe(false);
    });
  });

  describe('pointInsideSegment', () => {
    test('returns true for point strictly inside', () => {
      expect(Line.pointInsideSegment({ x: 5, y: 3 }, { x: 2, y: 3 }, { x: 8, y: 3 })).toBe(true);
    });

    test('returns false for point at endpoint', () => {
      expect(Line.pointInsideSegment({ x: 2, y: 3 }, { x: 2, y: 3 }, { x: 8, y: 3 })).toBe(false);
      expect(Line.pointInsideSegment({ x: 8, y: 3 }, { x: 2, y: 3 }, { x: 8, y: 3 })).toBe(false);
    });
  });

  describe('getSegments', () => {
    test('returns segments for polyline', () => {
      const lineObj = {
        points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]
      };
      const segments = Line.getSegments(lineObj);
      expect(segments).toHaveLength(2);
      expect(segments[0].start).toEqual({ x: 0, y: 0 });
      expect(segments[0].end).toEqual({ x: 5, y: 0 });
      expect(segments[1].start).toEqual({ x: 5, y: 0 });
      expect(segments[1].end).toEqual({ x: 5, y: 5 });
    });

    test('returns empty array for single point', () => {
      const lineObj = { points: [{ x: 0, y: 0 }] };
      expect(Line.getSegments(lineObj)).toHaveLength(0);
    });
  });

  describe('simplifyPoints', () => {
    test('removes collinear points on horizontal line', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 }
      ];
      const simplified = Line.simplifyPoints(points);
      expect(simplified).toHaveLength(2);
      expect(simplified[0]).toEqual({ x: 0, y: 0 });
      expect(simplified[1]).toEqual({ x: 10, y: 0 });
    });

    test('preserves corner points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 }
      ];
      const simplified = Line.simplifyPoints(points);
      expect(simplified).toHaveLength(3);
    });

    test('handles two points unchanged', () => {
      const points = [{ x: 0, y: 0 }, { x: 5, y: 5 }];
      const simplified = Line.simplifyPoints(points);
      expect(simplified).toHaveLength(2);
    });
  });

  describe('getPreviewPath', () => {
    test('returns straight line for axis-aligned points', () => {
      const path = Line.getPreviewPath({ x: 0, y: 0 }, { x: 5, y: 0 }, true);
      expect(path).toHaveLength(2);
      expect(path[0]).toEqual({ x: 0, y: 0 });
      expect(path[1]).toEqual({ x: 5, y: 0 });
    });

    test('returns L-shape for diagonal with hFirst=true', () => {
      const path = Line.getPreviewPath({ x: 0, y: 0 }, { x: 5, y: 3 }, true);
      expect(path).toHaveLength(3);
      expect(path[0]).toEqual({ x: 0, y: 0 });
      expect(path[1]).toEqual({ x: 5, y: 0 }); // horizontal first
      expect(path[2]).toEqual({ x: 5, y: 3 });
    });

    test('returns L-shape for diagonal with hFirst=false', () => {
      const path = Line.getPreviewPath({ x: 0, y: 0 }, { x: 5, y: 3 }, false);
      expect(path).toHaveLength(3);
      expect(path[0]).toEqual({ x: 0, y: 0 });
      expect(path[1]).toEqual({ x: 0, y: 3 }); // vertical first
      expect(path[2]).toEqual({ x: 5, y: 3 });
    });
  });

  describe('findPointOnLine', () => {
    const lineObj = {
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 }
      ]
    };

    test('returns vertex info for point at vertex', () => {
      const result = Line.findPointOnLine({ x: 5, y: 0 }, lineObj);
      expect(result).not.toBeNull();
      expect(result.isVertex).toBe(true);
      expect(result.vertexIndex).toBe(1);
    });

    test('returns segment info for point on segment', () => {
      const result = Line.findPointOnLine({ x: 3, y: 0 }, lineObj);
      expect(result).not.toBeNull();
      expect(result.isVertex).toBe(false);
      expect(result.segmentIndex).toBe(0);
    });

    test('returns null for point not on line', () => {
      const result = Line.findPointOnLine({ x: 3, y: 3 }, lineObj);
      expect(result).toBeNull();
    });
  });

  describe('segmentIntersection', () => {
    test('finds intersection of perpendicular segments', () => {
      const result = Line.segmentIntersection(
        { x: 0, y: 5 }, { x: 10, y: 5 },  // horizontal
        { x: 5, y: 0 }, { x: 5, y: 10 }   // vertical
      );
      expect(result).toEqual({ x: 5, y: 5 });
    });

    test('returns null for parallel segments', () => {
      const result = Line.segmentIntersection(
        { x: 0, y: 0 }, { x: 10, y: 0 },
        { x: 0, y: 5 }, { x: 10, y: 5 }
      );
      expect(result).toBeNull();
    });

    test('returns null for non-overlapping perpendicular segments', () => {
      const result = Line.segmentIntersection(
        { x: 0, y: 5 }, { x: 3, y: 5 },   // doesn't reach x=5
        { x: 5, y: 0 }, { x: 5, y: 10 }
      );
      expect(result).toBeNull();
    });
  });
});
