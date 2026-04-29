# ADR 0003: `AsciiEditor.*` Namespace Over ES6 Modules

**Status:** Accepted

## Context

We're not using a build step ([ADR 0002](0002-vanilla-js-no-build.md)). That rules out ES6 `import`/`export` for two reasons:

1. ES modules require a server (CORS blocks them under `file://`).
2. Module loading happens asynchronously, which complicates initialization order for things like font measurement before viewport setup.

We still need a way to organize code across many files without polluting the global scope.

## Decision

All code lives under the `AsciiEditor` global namespace. Each file extends the namespace defensively:

```javascript
// At the top of every file:
var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

// Then declare:
AsciiEditor.core.CharacterGrid = class CharacterGrid {
  // ...
};
```

Sub-namespaces match directory structure:

| Directory | Namespace |
|---|---|
| `js/core/` | `AsciiEditor.core.*` |
| `js/domain/` | `AsciiEditor.domain.*` |
| `js/viewport/` | `AsciiEditor.viewport.*` |
| `js/backends/` | `AsciiEditor.backends.*` |
| `js/overlays/` | `AsciiEditor.overlays.*` |
| `js/export/` | `AsciiEditor.export.*` |
| `js/tools/` | `AsciiEditor.tools.*` |
| `js/rendering/` | `AsciiEditor.rendering.*` |

Script load order in `index.html` is grouped by dependency:

```html
<!-- Core (no dependencies) -->
<script src="js/core/utils.js"></script>
<script src="js/core/CharacterGrid.js"></script>
<script src="js/core/Command.js"></script>
<!-- ... -->

<!-- Domain (pure functions, no UI) -->
<script src="js/domain/Line.js"></script>
<!-- ... -->

<!-- Interfaces, then implementations -->
<!-- Tools, then Renderer, then Editor, then main -->
```

For Jest tests, `test/setup.js` loads each file via `eval` into a global `AsciiEditor` object, stripping the defensive `var AsciiEditor = AsciiEditor || {}` lines.

## Consequences

**Positive:**
- Works under `file://` with no server.
- Script ordering is explicit and visible in `index.html`.
- Trivial to bundle: `cat js/**/*.js > bundle.js` produces a working single file because every namespace declaration is idempotent.
- No tooling required for the runtime.

**Negative:**
- One global is added to `window` (`AsciiEditor`). Acceptable.
- Cyclic dependencies between files surface as `undefined` at runtime, not at parse time. Mitigated by load-order discipline and the layered architecture.
- Jest setup is non-standard — it `eval`s files instead of `require`-ing them. See [ADR 0012](0012-testing-strategy.md).
- IDE refactors (rename across files) require ripgrep rather than a language-server symbol table.
- New files must be added to `index.html` AND to `test/setup.js` if they're tested.
