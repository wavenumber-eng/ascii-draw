# ADR 0012: Testing Strategy — Jest + jsdom + Namespace Setup

**Status:** Accepted

## Context

The application doesn't use ES modules ([ADR 0003](0003-namespace-pattern.md)), so Jest's standard `require` workflow doesn't load source files cleanly — the namespace pattern (`var AsciiEditor = AsciiEditor || {}`) re-creates the global on each load and tests would clobber each other.

We also have a mix of pure logic (domain modules), DOM-touching code (viewport, overlay), and rendering output that's worth verifying as text.

## Decision

Use **Jest with jest-environment-jsdom** for unit tests. Drive the namespace setup explicitly through `test/setup.js`, which loads source files via `eval` into a global `AsciiEditor` object.

### Setup script

`test/setup.js` is registered via Jest config and runs before every test suite:

```javascript
if (!global.AsciiEditor || !global.AsciiEditor._initialized) {
  global.AsciiEditor = {
    _initialized: true,
    core: {}, domain: {}, tools: {}, rendering: {},
    viewport: {}, backends: {}, overlays: {}, export: {}
  };

  function loadScript(relativePath) {
    const code = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
    // Strip namespace-init lines (`var AsciiEditor = AsciiEditor || {}`)
    // and `eval` the rest with the global namespace as a parameter.
    const fn = new Function('AsciiEditor', stripped);
    fn(global.AsciiEditor);
  }

  // Load in dependency order
  loadScript('../js/core/utils.js');
  loadScript('../js/core/CharacterGrid.js');
  loadScript('../js/core/Command.js');
  // ... (matches index.html order, minus tools and Editor)
}
```

Tools and the Editor itself need DOM/canvas; tests that need them load them explicitly.

### Categories of tests

| Type | Where | Strategy |
|---|---|---|
| **Pure utilities** | `test/utils.test.js`, `test/lineUtils.test.js` | Direct input/output assertions |
| **Domain logic** | `test/domain/*.test.js` | Pure-function tests, no DOM |
| **Commands** | `test/commands.test.js` | `execute()`/`undo()` round-trip |
| **Derived state** | `test/DerivedStateComputer.test.js` | State in → render list out |
| **Interface contracts** | `test/IViewport.test.js`, `test/IRenderBackend.test.js`, etc. | Contract suites that any implementation must pass |
| **Export output** | `test/export.test.js`, `test/export-textbox.test.js` | Compare ASCII output to fixture strings |
| **Browser/visual** | `test/test-export.html` | Manual interactive verification |

### Fixtures

`test/fixtures/` holds JSON inputs (e.g., `textbox-alignment.json`).
`test/output/` holds expected ASCII output (e.g., `textbox-alignment.txt`).

### Coverage requirements

- All **utility functions** must have unit tests.
- All **Command classes** must have execute/undo tests.
- All **export functions** must have output-verification tests.
- New **logic functions** require corresponding unit tests before merge.

### Running tests

```bash
npm install          # First time only
npm test             # Run all tests
npm test -- --watch  # Watch mode
npm test -- --coverage
npm test -- export   # Run a single file
```

## Consequences

**Positive:**
- Domain modules and pure utilities are tested fast (~107 domain tests).
- Interface contract tests catch regressions when adding new viewport or backend implementations.
- Export verification is unambiguous — snapshot-style comparison against expected text.
- The same source files that load in `index.html` load in tests; no separate test build.

**Negative:**
- The `eval`-based loader is non-standard. New contributors expect `require` to work and have to learn the setup pattern.
- Adding a new file means editing both `index.html` *and* `test/setup.js`. Easy to forget.
- DOM/canvas-dependent code (most of `Editor.js`, the inline editor, mouse handlers) has thin coverage. We rely on the browser-based test page (`test/test-export.html`) for visual verification.
- jsdom doesn't fully implement Canvas2D — some tests have to mock context methods. ThreeJS tests are essentially impossible without a real WebGL context, which is why the 3D viewport has minimal automated coverage.
