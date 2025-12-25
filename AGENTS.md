# Greptor Library Design & Guidelines

## 1. Project Overview
**Greptor** (Grep + Raptor) is a high-performance content ingestion and indexing library designed to make unstructured data (text, PDF, DOCX, Excel) easily searchable via tools like `ripgrep` and blob search.

The core philosophy is **"Minimal Processing + Maximal grep-ability"**: ingest raw content, apply lightweight enrichment (metadata extraction, normalization), and denormalize everything into a grep-friendly format. No heavy preprocessing like clustering, entity dossiers, or precomputed indices. The LLM synthesizes answers at query time from clean, metadata-rich files.

## 2. Library Requirements

### Functional Requirements
-   **Multi-format Ingestion**: Accept input in various formats:
    -   Plain Text
    -   PDF (Binary)
    -   DOCX (Binary)
    -   Excel (Binary)
-   **Standardized Output**: Convert all inputs into Markdown files with YAML frontmatter for metadata.
-   **Time-based Organization**: Organize files in a simple date-based directory structure (e.g., `data/raw/YYYY/YYYY-MM-DD-label.md`).
-   **Lightweight Enrichment**: Extract metadata (entities, topics, sentiment, keywords) using LLMs based on a user-defined or auto-generated schema. Add short summaries for context.
-   **Denormalized Storage**: Embed all metadata directly in files via YAML frontmatter, HTML comments, and headings to maximize grep-ability.
-   **"Eat" API**: A simple, unified entry point (`eat` method) for users to feed data into the system.

### Non-Functional Requirements
-   **Grep-Friendly**: The storage format must be optimized for command-line search tools (`ripgrep`, `grep`).
-   **Performance**: Ingestion should be fast; heavy processing (LLM tasks) should be offloaded to background threads/workers to avoid blocking the main application.
-   **Extensibility**: Users can define their own domains and metadata schemas.
-   **Simplicity**: Minimal configuration required to get started.

## 3. High-Level Design

### Architecture
The library operates on a simple, grep-optimized storage model:
1.  **Raw Layer**: Immediate storage of ingested content as Markdown in a time-based folder structure (e.g., `data/raw/YYYY/MM/YYYY-MM-DD-label.md`).
2.  **Enrichment Layer**: Lightweight background processing that reads raw files, enriches them, and writes to a parallel `processed` directory structure (e.g., `data/processed/YYYY/MM/YYYY-MM-DD-label.md`).

### Key Components
-   **`Greptor` Class**: The main facade.
    -   `eat(input)`: Accepts content, writes to the Raw Layer, and queues for enrichment.
-   **`FileStorage`**: Handles file I/O using opaque `DocumentRef`s, ensuring separation between `raw` and `processed` layers.
-   **Background Processor**: In-memory worker that processes the queue and hydrates from the file system on startup.
-   **`MetadataSchemaGenerator`**: Dynamic schema generation using LLMs if the user doesn't provide one.

### Data Flow
1.  **User** calls `greptor.eat({ content, label, metadata })`.
2.  **Greptor** delegates to `FileStorage` to save raw content.
3.  **FileStorage** writes to `data/raw/...` and returns a `DocumentRef`.
4.  **Greptor** enqueues the `DocumentRef` into the in-memory processing queue.
5.  **Background Processor** picks up items (or finds unprocessed files on disk at startup).
6.  **LLM** chunks content and extracts metadata (entities, topics, sentiment) based on the schema.
7.  **Processor** writes the enriched content to the `processed` layer, embedding metadata in YAML frontmatter.

## 4. Coding Conventions & Best Practices

### Core Principles
-   **Runtime**: **Bun** is the required runtime. Use `bun` for scripts, tests, and package management.
-   **Language**: **TypeScript** (Modern, Strict).
-   **KISS (Keep It Simple, Stupid)**:
    -   Prefer simple functions over complex class hierarchies.
    -   Avoid over-engineering; solve the immediate problem.
    -   File system is the source of truth where possible.
-   **SOLID**: Adhere to SOLID principles, especially Single Responsibility (e.g., separate Ingestion from Processing).

### Development Standards
-   **Tooling**:
    -   Linting/Formatting: **Biome** (`biome.json`).
    -   Testing: `bun test`.
-   **Readability**:
    -   Code should be self-documenting.
    -   Use descriptive variable names.
    -   Comments should explain *why*, not *what*.
-   **Async/Await**: Use modern async patterns; avoid callback hell.
-   **Error Handling**: Use typed errors where possible; fail gracefully in background processes without crashing the main app.
-   **Dependencies**: Keep dependencies minimal. Use native Bun APIs (e.g., `Bun.file`, `Bun.write`) instead of Node.js `fs` where appropriate, but maintain compatibility if necessary.

### Directory Structure
```
src/
├── greptor.ts          # Main entry point
├── types.ts            # Shared interfaces
├── metadata-schema-generator.ts
├── llm/                # LLM integration logic
├── processing/         # Background workers and pipeline steps
├── storage/            # File system abstraction (FileStorage)
└── utils/              # Helper functions
```

**Version**: 3.0.0 | **Ratified**: 2025-12-06 | **Last Amended**: 2025-12-06