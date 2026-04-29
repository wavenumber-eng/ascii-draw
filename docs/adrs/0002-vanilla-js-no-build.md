# ADR 0002: Vanilla JavaScript, No Build Step

**Status:** Accepted

## Context

This is a single-page web app. The natural defaults today would be a build pipeline (Webpack/Vite/esbuild) and a framework (React/Vue/Svelte). But this app's deployment story is "open `index.html` and use it" — including from `file://` — and we want to keep the source approachable without dependency churn.

## Decision

Use plain ES6+ JavaScript with `<script>` tags loaded in dependency order. **No transpilation, no bundler, no framework.**

- `index.html` lists scripts in dependency order: core → domain → interfaces → implementations → tools → rendering → Editor → main.
- ES6 classes, arrow functions, template strings, destructuring — anything supported by current evergreen browsers is fair game.
- Three.js loads from CDN as the one runtime dependency, used only for the optional 3D viewport.
- DOM manipulation is direct: `document.getElementById`, `addEventListener`, `canvas.getContext('2d')`. No virtual DOM.

For tests, `npm` and Jest are required, but only as **dev tooling**. The app itself never imports anything from `node_modules`.

## Consequences

**Positive:**
- **Portability:** works under `file://`, no server needed, no CORS issues.
- **Longevity:** no framework deprecations, no monthly dep updates, no lockfile rot.
- **Approachability:** anyone can read the source without learning a framework.
- **Deployment:** if a single-file build is ever needed, simple concatenation works (see [ADR 0003](0003-namespace-pattern.md)).
- **Performance:** no framework reconciliation overhead, no hydration.

**Negative:**
- No JSX, no `import`/`export` — must use the namespace pattern instead (see [ADR 0003](0003-namespace-pattern.md)).
- Script load order in `index.html` is manually maintained. Adding a file means editing the HTML.
- No tree-shaking; the whole codebase loads on every page open. Acceptable at current size (~17k LOC), worth revisiting at 100k+.
- IDE tooling for cross-file refactors is weaker than with ES modules (no static `import` graph).
