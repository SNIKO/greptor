# Greptor Architecture & Design

## 1. Architectural Overview
Single linear pipeline; ordered processors mutate a shared `ProcessingContext`. All processing stays in memory until the writer emits one grep-friendly markdown file.

## 2. Minimal Interfaces
```typescript
type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

interface ProcessingContext {
  id: string;
  jobId: string;
  input: { content: string | Buffer; mimeType: string; filename?: string; sourceUrl?: string; userMetadata?: Record<string, unknown> };
  clean?: { text: string; notes?: string[] };
  metadata?: { core: CoreMetadata; entities: Entity[]; topics: string[]; tags: string[]; sentiment?: Sentiment; summary?: string; metrics?: Record<string, string | number>; timeSpans?: string[] };
  chunks?: Chunk[];
  output?: { slug: string; processedPath: string; rawPath?: string; markdown?: string };
  config: { schema: UserSchema; chunkThreshold?: number; clock?: () => Date };
  log: StepLog[];
}

interface Processor { name: string; optional?: boolean; process(c: ProcessingContext): Promise<ProcessingContext>; }
interface PipelineRunner { run(c: ProcessingContext): Promise<ProcessingContext>; }
```

## 3. Default Pipeline (in-memory until write)
- Stage 1 — Clean: drop boilerplate/ads/nav, de-dupe intros/outros, normalize whitespace/headings/invisible chars, extract main body → `clean.text`.
- Stage 2 — Metadata: from `clean.text` + schema, fill core metadata, entities (typed/roles), topics, tags, sentiment, summary, optional metrics/time spans → `metadata`.
- Stage 3 — Chunking (optional): if long, split into semantic chunks (3–6 sentences), id them (`c01`, `c02`...), attach entities/topics/tags → `chunks`.
- Stage 4 — Write (only I/O): render YAML frontmatter + HTML comment block + CHUNKS section (+ optional full cleaned text); write to `data/processed/YYYY/MM/DD/{id}--{slug}.md` → `output`.

## 4. Extensibility & Flow Control
- Add/remove/reorder processors without touching others; keep state in `ProcessingContext`.
- Mark `optional` to continue past non-critical failures; runner policy decides halt/continue.
- Log each step for traceability; future hooks (`onStart/onEnd/onError`) feed metrics.

## 5. Guidelines
- Processors stay stateless; state lives in context.
- Async-first; avoid blocking.
- Only writer touches disk; earlier stages are pure transforms.
- Keep outputs grep-friendly (YAML + HTML comments + headings).
- Use `bun test`; lint/format with Biome; prefer Bun file APIs.
