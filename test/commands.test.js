/**
 * Tests for Command classes (undo/redo functionality)
 */

// Helper to create a minimal test state
function createTestState() {
  return {
    project: {
      pages: [{
        id: 'page-1',
        name: 'Test Page',
        width: 80,
        height: 40,
        objects: []
      }]
    },
    activePageId: 'page-1',
    selection: { ids: [], handles: null }
  };
}

describe('CreateObjectCommand', () => {
  test('adds object to page', () => {
    const state = createTestState();
    const box = { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3 };
    const cmd = new AsciiEditor.core.CreateObjectCommand('page-1', box);

    const newState = cmd.execute(state);

    expect(newState.project.pages[0].objects).toHaveLength(1);
    expect(newState.project.pages[0].objects[0].id).toBe('box-1');
  });

  test('does not modify original state', () => {
    const state = createTestState();
    const box = { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3 };
    const cmd = new AsciiEditor.core.CreateObjectCommand('page-1', box);

    cmd.execute(state);

    expect(state.project.pages[0].objects).toHaveLength(0);
  });

  test('undo removes the object', () => {
    const state = createTestState();
    const box = { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3 };
    const cmd = new AsciiEditor.core.CreateObjectCommand('page-1', box);

    const afterCreate = cmd.execute(state);
    const afterUndo = cmd.undo(afterCreate);

    expect(afterUndo.project.pages[0].objects).toHaveLength(0);
  });

  test('handles non-existent page gracefully', () => {
    const state = createTestState();
    const box = { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3 };
    const cmd = new AsciiEditor.core.CreateObjectCommand('non-existent', box);

    const newState = cmd.execute(state);

    // Should not throw, original page unchanged
    expect(newState.project.pages[0].objects).toHaveLength(0);
  });
});

describe('DeleteObjectCommand', () => {
  test('removes object from page', () => {
    const state = createTestState();
    const box = { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3 };
    state.project.pages[0].objects.push(box);

    const cmd = new AsciiEditor.core.DeleteObjectCommand('page-1', box);
    const newState = cmd.execute(state);

    expect(newState.project.pages[0].objects).toHaveLength(0);
  });

  test('undo restores the object', () => {
    const state = createTestState();
    const box = { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3 };
    state.project.pages[0].objects.push({ ...box });

    const cmd = new AsciiEditor.core.DeleteObjectCommand('page-1', box);
    const afterDelete = cmd.execute(state);
    const afterUndo = cmd.undo(afterDelete);

    expect(afterUndo.project.pages[0].objects).toHaveLength(1);
    expect(afterUndo.project.pages[0].objects[0].id).toBe('box-1');
  });
});

describe('MoveObjectCommand', () => {
  test('moves object to new position', () => {
    const state = createTestState();
    const box = { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3 };
    state.project.pages[0].objects.push(box);

    const cmd = new AsciiEditor.core.MoveObjectCommand(
      'page-1', 'box-1',
      { x: 0, y: 0 },
      { x: 10, y: 5 }
    );
    const newState = cmd.execute(state);

    expect(newState.project.pages[0].objects[0].x).toBe(10);
    expect(newState.project.pages[0].objects[0].y).toBe(5);
  });

  test('undo restores original position', () => {
    const state = createTestState();
    const box = { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3 };
    state.project.pages[0].objects.push(box);

    const cmd = new AsciiEditor.core.MoveObjectCommand(
      'page-1', 'box-1',
      { x: 0, y: 0 },
      { x: 10, y: 5 }
    );
    const afterMove = cmd.execute(state);
    const afterUndo = cmd.undo(afterMove);

    expect(afterUndo.project.pages[0].objects[0].x).toBe(0);
    expect(afterUndo.project.pages[0].objects[0].y).toBe(0);
  });

  test('canMerge returns true for same object moves', () => {
    const cmd1 = new AsciiEditor.core.MoveObjectCommand('page-1', 'box-1', { x: 0, y: 0 }, { x: 5, y: 5 });
    const cmd2 = new AsciiEditor.core.MoveObjectCommand('page-1', 'box-1', { x: 5, y: 5 }, { x: 10, y: 10 });

    expect(cmd1.canMerge(cmd2)).toBe(true);
  });

  test('canMerge returns false for different objects', () => {
    const cmd1 = new AsciiEditor.core.MoveObjectCommand('page-1', 'box-1', { x: 0, y: 0 }, { x: 5, y: 5 });
    const cmd2 = new AsciiEditor.core.MoveObjectCommand('page-1', 'box-2', { x: 0, y: 0 }, { x: 5, y: 5 });

    expect(cmd1.canMerge(cmd2)).toBe(false);
  });

  test('merge combines moves correctly', () => {
    const cmd1 = new AsciiEditor.core.MoveObjectCommand('page-1', 'box-1', { x: 0, y: 0 }, { x: 5, y: 5 });
    const cmd2 = new AsciiEditor.core.MoveObjectCommand('page-1', 'box-1', { x: 5, y: 5 }, { x: 10, y: 10 });

    const merged = cmd1.merge(cmd2);

    expect(merged.fromPos).toEqual({ x: 0, y: 0 });
    expect(merged.toPos).toEqual({ x: 10, y: 10 });
  });
});

describe('ModifyObjectCommand', () => {
  test('modifies object properties', () => {
    const state = createTestState();
    const box = { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3, text: '' };
    state.project.pages[0].objects.push(box);

    const cmd = new AsciiEditor.core.ModifyObjectCommand(
      'page-1', 'box-1',
      { text: '' },
      { text: 'Hello' }
    );
    const newState = cmd.execute(state);

    expect(newState.project.pages[0].objects[0].text).toBe('Hello');
  });

  test('undo restores original properties', () => {
    const state = createTestState();
    const box = { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3, style: 'single' };
    state.project.pages[0].objects.push(box);

    const cmd = new AsciiEditor.core.ModifyObjectCommand(
      'page-1', 'box-1',
      { style: 'single' },
      { style: 'double' }
    );
    const afterModify = cmd.execute(state);
    const afterUndo = cmd.undo(afterModify);

    expect(afterUndo.project.pages[0].objects[0].style).toBe('single');
  });

  test('can modify multiple properties at once', () => {
    const state = createTestState();
    const box = { id: 'box-1', type: 'box', x: 0, y: 0, width: 5, height: 3, style: 'single', shadow: false };
    state.project.pages[0].objects.push(box);

    const cmd = new AsciiEditor.core.ModifyObjectCommand(
      'page-1', 'box-1',
      { style: 'single', shadow: false },
      { style: 'double', shadow: true }
    );
    const newState = cmd.execute(state);

    expect(newState.project.pages[0].objects[0].style).toBe('double');
    expect(newState.project.pages[0].objects[0].shadow).toBe(true);
  });
});
