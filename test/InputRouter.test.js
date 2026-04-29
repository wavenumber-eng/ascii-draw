/**
 * @jest-environment jsdom
 *
 * InputRouter tests — verifies mode detection, canvas-mode precedence,
 * and Space-hold semantics. See ADR 0013.
 */

require('./setup');

function makeRouter(overrides = {}) {
  const calls = {
    toolKeyDown: [], toolKeyUp: [],
    hotkey: [],
    spaceStart: 0, spaceEnd: 0,
    afterDispatch: []
  };
  const router = new AsciiEditor.input.InputRouter({
    toolManager: {
      onKeyDown: (e) => { calls.toolKeyDown.push(e.key); return overrides.toolClaims === true; },
      onKeyUp:   (e) => { calls.toolKeyUp.push(e.key);   return overrides.toolClaimsUp === true; }
    },
    hotkeyManager: {
      handleKeyDown: (e) => { calls.hotkey.push(e.key); return overrides.hotkeyClaims === true; }
    },
    getEditingState: overrides.getEditingState || (() => ({})),
    onSpaceHoldStart: () => { calls.spaceStart++; },
    onSpaceHoldEnd:   () => { calls.spaceEnd++; },
    onAfterDispatch:  (kind) => { calls.afterDispatch.push(kind); }
  });
  return { router, calls };
}

function ev(key, code = key) {
  let prevented = false;
  return {
    key, code,
    preventDefault: () => { prevented = true; },
    get _prevented() { return prevented; }
  };
}

describe('InputRouter', () => {
  beforeEach(() => {
    // jsdom sets activeElement to body by default, which is the 'canvas' fallback case.
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  });

  describe('getMode()', () => {
    test("returns 'inline-edit' when editingObjectId is set", () => {
      const { router } = makeRouter({
        getEditingState: () => ({ editingObjectId: 'obj-1' })
      });
      expect(router.getMode()).toBe('inline-edit');
    });

    test("returns 'inline-edit' when editingLabelSymbolId is set", () => {
      const { router } = makeRouter({
        getEditingState: () => ({ editingLabelSymbolId: 'sym-1' })
      });
      expect(router.getMode()).toBe('inline-edit');
    });

    test("returns 'inline-edit' when editingPinSymbolId is set", () => {
      const { router } = makeRouter({
        getEditingState: () => ({ editingPinSymbolId: 'sym-2' })
      });
      expect(router.getMode()).toBe('inline-edit');
    });

    test("returns 'form' when focus is in <input>", () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      const { router } = makeRouter();
      expect(router.getMode()).toBe('form');
      input.remove();
    });

    test("returns 'form' when focus is in <textarea>", () => {
      const ta = document.createElement('textarea');
      document.body.appendChild(ta);
      ta.focus();
      const { router } = makeRouter();
      expect(router.getMode()).toBe('form');
      ta.remove();
    });

    test("returns 'form' when focus is in <select>", () => {
      const sel = document.createElement('select');
      document.body.appendChild(sel);
      sel.focus();
      const { router } = makeRouter();
      expect(router.getMode()).toBe('form');
      sel.remove();
    });

    test("returns 'form' for contentEditable elements", () => {
      // jsdom doesn't move document.activeElement on div.focus() reliably,
      // so spy on the property to simulate focused contentEditable.
      const fakeEditable = { tagName: 'DIV', isContentEditable: true };
      const spy = jest.spyOn(document, 'activeElement', 'get').mockReturnValue(fakeEditable);
      const { router } = makeRouter();
      expect(router.getMode()).toBe('form');
      spy.mockRestore();
    });

    test("returns 'canvas' when nothing focused and no editing state", () => {
      const { router } = makeRouter();
      expect(router.getMode()).toBe('canvas');
    });
  });

  describe('canvas-mode precedence', () => {
    test('tool claim short-circuits hotkey and reflex', () => {
      const { router, calls } = makeRouter({ toolClaims: true });
      router.dispatchKeyDown(ev('b', 'KeyB'));
      expect(calls.toolKeyDown).toEqual(['b']);
      expect(calls.hotkey).toEqual([]);
      expect(calls.afterDispatch).toEqual(['tool']);
    });

    test('tool falls through to hotkey when not claimed', () => {
      const { router, calls } = makeRouter({ toolClaims: false, hotkeyClaims: true });
      router.dispatchKeyDown(ev('b', 'KeyB'));
      expect(calls.toolKeyDown).toEqual(['b']);
      expect(calls.hotkey).toEqual(['b']);
      expect(calls.afterDispatch).toEqual(['hotkey']);
    });

    test('reflex (Space-hold) only when no tool / hotkey claim', () => {
      const { router, calls } = makeRouter({ toolClaims: false, hotkeyClaims: false });
      const e = ev(' ', 'Space');
      router.dispatchKeyDown(e);
      expect(calls.spaceStart).toBe(1);
      expect(router.isSpaceHeld()).toBe(true);
      expect(e._prevented).toBe(true);
    });

    test('tool claiming Space prevents pan reflex from firing', () => {
      // LineTool while drawing claims Space to toggle posture — pan must NOT activate.
      const { router, calls } = makeRouter({ toolClaims: true });
      router.dispatchKeyDown(ev(' ', 'Space'));
      expect(calls.spaceStart).toBe(0);
      expect(router.isSpaceHeld()).toBe(false);
    });
  });

  describe('Space-hold semantics', () => {
    test('repeated keydown only fires onSpaceHoldStart once', () => {
      const { router, calls } = makeRouter();
      router.dispatchKeyDown(ev(' ', 'Space'));
      router.dispatchKeyDown(ev(' ', 'Space'));
      router.dispatchKeyDown(ev(' ', 'Space'));
      expect(calls.spaceStart).toBe(1);
      expect(router.isSpaceHeld()).toBe(true);
    });

    test('keyup releases the hold and fires onSpaceHoldEnd', () => {
      const { router, calls } = makeRouter();
      router.dispatchKeyDown(ev(' ', 'Space'));
      router.dispatchKeyUp(ev(' ', 'Space'));
      expect(calls.spaceEnd).toBe(1);
      expect(router.isSpaceHeld()).toBe(false);
    });

    test('keyup without prior keydown is a no-op', () => {
      const { router, calls } = makeRouter();
      router.dispatchKeyUp(ev(' ', 'Space'));
      expect(calls.spaceEnd).toBe(0);
    });
  });

  describe('non-canvas modes are inert', () => {
    test('form mode: no tool, no hotkey, no reflex', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      const { router, calls } = makeRouter({ toolClaims: true, hotkeyClaims: true });
      router.dispatchKeyDown(ev('b', 'KeyB'));
      router.dispatchKeyDown(ev(' ', 'Space'));
      expect(calls.toolKeyDown).toEqual([]);
      expect(calls.hotkey).toEqual([]);
      expect(calls.spaceStart).toBe(0);
      input.remove();
    });

    test('inline-edit mode: no tool, no hotkey, no reflex', () => {
      const { router, calls } = makeRouter({
        toolClaims: true,
        hotkeyClaims: true,
        getEditingState: () => ({ editingObjectId: 'obj-1' })
      });
      router.dispatchKeyDown(ev('Escape', 'Escape'));
      expect(calls.toolKeyDown).toEqual([]);
      expect(calls.hotkey).toEqual([]);
    });
  });
});
