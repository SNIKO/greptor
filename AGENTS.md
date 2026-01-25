# Greptor (agent notes)

Greptor ingests unstructured **text** and stores it as grep-friendly Markdown, with lightweight enrichment (chunking + tags) so tools like `ripgrep` can search it efficiently.

## Core requirements (keep stable)
- **Runtime**: Bun (scripts/tooling run via `bun`).
- **Language**: modern, strict TypeScript.
- **Output format**: Markdown with YAML frontmatter.
- **Storage layout** (time-based): `content/{raw|processed}/{source}/{publisher?}/{YYYY-MM}/{YYYY-MM-DD-label}.md`
- **Layers**:
  - `content/raw/...`: write immediately on ingest
  - `content/processed/...`: background enrichment output (chunk headings + denormalized tags)
- **Main API**: `createGreptor(...)` facade with a simple `eat(input)` entry point; enrichment should not block ingestion.

## Coding standards
- **KISS / no overengineering**: prefer small functions and simple modules over complex abstractions.
- **Minimal processing**: preserve raw text; enrich only enough to improve grep-ability.
- **File system as source of truth** where practical (avoid hidden state).
- **Errors**: use typed errors when helpful; background workers must fail gracefully (no crashes).
- **Dependencies**: keep them minimal; prefer `node:*` APIs for portability.

## Dev commands
- `bun run typecheck`
- `bun run lint` / `bun run fix`
- `bun run demo`
- `bun run build`
- `bun run dev`

## Repo structure (high level)
```
src/
  index.ts            # library API surface
  cli/                # CLI app + commands
  lib/                # core library code
    greptor.ts        # main facade / factory
    config.ts         # config/env parsing
    processing/       # background enrichment
    storage/          # file I/O + DocumentRefs
    llm/              # provider/model abstraction
    utils/            # shared helpers
```

Last updated: 2026-01-25 (v0.6.0)
