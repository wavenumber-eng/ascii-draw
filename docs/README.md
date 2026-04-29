# Documentation

| Folder | Purpose | Start here |
|---|---|---|
| [`adrs/`](adrs/) | Architecture Decision Records — *how it's built* | [`adrs/00-overview.md`](adrs/00-overview.md) |
| [`requirements/`](requirements/) | Functional requirements — *what the product does* | [`requirements/00-index.md`](requirements/00-index.md) |
| [`plans/`](plans/) | Active implementation plans + status audit | [`plans/00-status-audit.md`](plans/00-status-audit.md) |
| [`research/`](research/) | Visual references, design inspiration | — |

## Conventions

- ADRs are numbered (`0001-…`, `0002-…`). Each captures one decision with **Context / Decision / Consequences**. The master overview (`00-overview.md`) is the entry point and the ADR index.
- Requirements files are numbered by section (`01-vision.md`, `02-philosophy.md`, …). Requirement IDs use prefixes like `OBJ-30`, `TOOL-25`, etc., and are referenced from code comments and ADRs.
- Plans are working documents — they describe what's *being* built, not what *is* built. The status audit is the authoritative reconciliation between the plans and the code.
