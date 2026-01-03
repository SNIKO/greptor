# Greptor Library Design & Guidelines

## 1. Project Overview
**Greptor** (Grep + Raptor) is a high-performance content ingestion and indexing library designed to make unstructured **text** easily searchable via tools like `ripgrep`.

The core philosophy is **"Minimal Processing + Maximal grep-ability"**: ingest raw content, apply lightweight enrichment (chunking + metadata extraction), and denormalize everything into a grep-friendly format. No heavy preprocessing like clustering or precomputed indices. The LLM synthesizes answers at query time from clean, metadata-rich files.

## 2. Library Requirements

### Functional Requirements
-   **Text Ingestion**: Accept plain text input (current implementation).
-   **Standardized Output**: Store content as Markdown with YAML frontmatter.
-   **Time-based Organization**: Store files in a date-based directory structure:  
    `content/{raw|processed}/{source}/{author?}/{YYYY-MM}/{YYYY-MM-DD-label}.md`
-   **Lightweight Enrichment**: Use LLMs to chunk content and extract metadata based on a user-defined or auto-generated schema.
-   **Denormalized Storage**: Embed metadata directly in YAML frontmatter and include chunk headers in content to maximize grep-ability.
-   **"Eat" API**: A simple, unified entry point (`eat` method) for users to feed data into the system.
-   **Skill Generation**: Generate a Claude Code skill file for searching the processed data.

### Non-Functional Requirements
-   **Grep-Friendly**: The storage format must be optimized for command-line search tools (`ripgrep`, `grep`).
-   **Performance**: Ingestion should be fast; heavy processing (LLM tasks) should be offloaded to background threads/workers to avoid blocking the main application.
-   **Extensibility**: Users can define their own domains and metadata schemas.
-   **Simplicity**: Minimal configuration required to get started.

## 3. High-Level Design

### Architecture
The library operates on a simple, grep-optimized storage model:
1.  **Raw Layer**: Immediate storage of ingested content as Markdown in `content/raw/...`.
2.  **Enrichment Layer**: Background processing that reads raw files, enriches them, and writes to `content/processed/...`.

### Key Components
-   **`Greptor` Factory**: The main facade returned by `createGreptor`.
    -   `eat(input)`: Accepts content, writes to the Raw Layer, and queues for enrichment.
    -   `createSkill(sources, overwrite)`: Generates a skill file for search guidance.
-   **`FileStorage`**: Handles file I/O using opaque `DocumentRef`s, ensuring separation between `raw` and `processed` layers.
-   **Background Processor**: In-memory worker queue that processes pending documents.
-   **Metadata Schema**: Persisted in `content/metadata-schema.yaml` and generated with LLMs if not provided.
-   **LLM Client**: Provider/model abstraction for OpenAI-compatible APIs (OpenAI, Azure OpenAI, Ollama).

### Data Flow
1.  **User** calls `greptor.eat({ content, format: "text", label, source, ... })`.
2.  **Greptor** delegates to `FileStorage` to save raw content.
3.  **FileStorage** writes to `content/raw/...` and returns a `DocumentRef`.
4.  **Greptor** enqueues the `DocumentRef` into the in-memory processing queue.
5.  **Background Processor** picks up items (and also scans disk for unprocessed files on startup).
6.  **LLM** chunks content and extracts per-chunk metadata based on the schema.
7.  **Processor** writes the enriched content to `content/processed/...`, embedding metadata in YAML frontmatter and leaving chunked content in the body.

## 4. Coding Conventions & Best Practices

### Core Principles
-   **Runtime**: **Bun** is the required runtime for scripts and tooling.
-   **Language**: **TypeScript** (Modern, Strict).
-   **KISS (Keep It Simple, Stupid)**:
    -   Prefer simple functions over complex class hierarchies.
    -   Avoid over-engineering; solve the immediate problem.
    -   File system is the source of truth where possible.
-   **SOLID**: Adhere to SOLID principles, especially Single Responsibility (e.g., separate Ingestion from Processing).

### Development Standards
-   **Tooling**:
    -   Linting/Formatting: **Biome** (`biome.json`).
    -   Typecheck: `bun run typecheck`.
    -   Demo Script: `bun run scripts/test.ts`.
-   **Readability**:
    -   Code should be self-documenting.
    -   Use descriptive variable names.
    -   Comments should explain *why*, not *what*.
-   **Async/Await**: Use modern async patterns; avoid callback hell.
-   **Error Handling**: Use typed errors where possible; fail gracefully in background processes without crashing the main app.
-   **Dependencies**: Keep dependencies minimal. Node-compatible APIs (`node:fs/promises`) are used for portability; prefer simple abstractions.

### Directory Structure
```
src/
├── index.ts                  # Library exports
├── greptor.ts                # Main entry point (factory)
├── types.ts                  # Shared interfaces
├── metadata-schema/
│   ├── initialize.ts
│   ├── generate.ts
│   └── types.ts
├── llm/
│   └── llm-factory.ts
├── processing/
│   ├── processor.ts
│   ├── chunk.ts
│   └── extract-metadata.ts
├── storage/
│   ├── file-storage.ts
│   ├── types.ts
│   └── index.ts
├── skills/
│   └── skill-generator.ts
└── utils/
    ├── file.ts
    └── hash.ts
```

**Version**: 0.1.0 | **Ratified**: 2026-01-02 | **Last Amended**: 2026-01-02
