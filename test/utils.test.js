/**
 * Tests for core utility functions
 */

describe('AsciiEditor.core.generateId', () => {
  test('generates unique IDs', () => {
    const id1 = AsciiEditor.core.generateId();
    const id2 = AsciiEditor.core.generateId();

    expect(id1).not.toBe(id2);
  });

  test('generates IDs with correct prefix', () => {
    const id = AsciiEditor.core.generateId();

    expect(id.startsWith('id-')).toBe(true);
  });

  test('generates IDs of consistent length', () => {
    const id = AsciiEditor.core.generateId();

    // 'id-' + 9 chars = 12 total
    expect(id.length).toBe(12);
  });
});

describe('AsciiEditor.core.clamp', () => {
  test('returns value when within range', () => {
    expect(AsciiEditor.core.clamp(5, 0, 10)).toBe(5);
  });

  test('returns min when value is below range', () => {
    expect(AsciiEditor.core.clamp(-5, 0, 10)).toBe(0);
  });

  test('returns max when value is above range', () => {
    expect(AsciiEditor.core.clamp(15, 0, 10)).toBe(10);
  });

  test('handles edge cases at boundaries', () => {
    expect(AsciiEditor.core.clamp(0, 0, 10)).toBe(0);
    expect(AsciiEditor.core.clamp(10, 0, 10)).toBe(10);
  });

  test('works with negative ranges', () => {
    expect(AsciiEditor.core.clamp(0, -10, -5)).toBe(-5);
    expect(AsciiEditor.core.clamp(-7, -10, -5)).toBe(-7);
  });
});

describe('AsciiEditor.core.deepClone', () => {
  test('clones simple objects', () => {
    const original = { a: 1, b: 'test' };
    const clone = AsciiEditor.core.deepClone(original);

    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
  });

  test('clones nested objects', () => {
    const original = { a: { b: { c: 1 } } };
    const clone = AsciiEditor.core.deepClone(original);

    expect(clone).toEqual(original);
    expect(clone.a).not.toBe(original.a);
    expect(clone.a.b).not.toBe(original.a.b);
  });

  test('clones arrays', () => {
    const original = { items: [1, 2, 3] };
    const clone = AsciiEditor.core.deepClone(original);

    expect(clone.items).toEqual(original.items);
    expect(clone.items).not.toBe(original.items);
  });

  test('modifications to clone do not affect original', () => {
    const original = { a: 1, nested: { b: 2 } };
    const clone = AsciiEditor.core.deepClone(original);

    clone.a = 999;
    clone.nested.b = 888;

    expect(original.a).toBe(1);
    expect(original.nested.b).toBe(2);
  });
});
