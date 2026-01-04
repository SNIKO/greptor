import { type LanguageModel, generateText } from "ai";
import YAML from "yaml";
import type { DocumentRef, FileStorage } from "../storage/index.js";
import type { Logger, Tags } from "../types.js";

const DEFAULT_IDLE_SLEEP_MS = 750;

export interface ProcessorContext {
	domain: string;
	tagSchema: string;
	model: LanguageModel;
	storage: FileStorage;
	logger?: Logger;
}

export interface ProcessingQueue {
	enqueue: (ref: DocumentRef) => void;
	dequeue: () => DocumentRef | undefined;
	size: () => number;
}

export function createProcessingQueue(): ProcessingQueue {
	const items: DocumentRef[] = [];

	return {
		enqueue(ref) {
			items.push(ref);
		},

		size() {
			return items.length;
		},

		dequeue() {
			return items.shift();
		},
	};
}

function renderProcessedDocument(tags: Tags, chunkContent: string): string {
	const doc = new YAML.Document(tags);

	YAML.visit(doc, {
		Seq(_, node) {
			const allScalars = node.items.every((item) => YAML.isScalar(item));
			if (allScalars) {
				node.flow = true;
			}
		},
	});

	const renderedTags = doc.toString({ lineWidth: 200 });

	return ["---", renderedTags.trimEnd(), "---", "", chunkContent.trim()].join(
		"\n",
	);
}

function createProcessingPrompt(
	rawContent: string,
	domain: string,
	tagSchema: string,
): string {
	return `
# INSTRUCTIONS
Clean, chunk, and tag the raw content for **grep-based search** in the domain: ${domain}.

## Core Principle
Optimize for **single-pass grep scanning**: a single grep hit should reveal what a chunk is about without reading other chunks.

## Objectives
- Remove noise and boilerplate: ads, sponsors, intros/outros, CTAs, repetitions, contact or social links, and sign-offs.
- Preserve **all meaning and factual detail exactly** (facts, names, dates, numbers, ranges, uncertainty, conditions, and meaningful URLs).
- Use **minimal wording** while keeping all information.
- Chunk the content into **semantic sections** (prefer fewer, richer chunks when possible; do not pad content to reach size targets).

## Output Format (Markdown only)

\`\`\`md
## 01 Short descriptive title for chunk 1
field_1=value_1,value_4
field_2=value_2,
field_3=value_3,
<cleaned, condensed content>

## 02 Short descriptive title for chunk 2
field_1=value_1
field_4=value_4
field_5=value_5,value_6
<cleaned, condensed content>
\`\`\`

## Tagging Rules
- Use ONLY fields defined in the SCHEMA (field names must exactly match schema).
- Do not invent new fields.
- Omit fields with no value.
- One tag field per line.
- DO NOT duplicate fields. For arrays, use comma-separated values.
- For enums, use only allowed enum values from the schema.
- Use ISO-8601 for dates (YYYY-MM-DD).
- Keep tag values grep-friendly:
	- snake_case where appropriate
	- tickers, codes, and symbols in UPPERCASE
- Maintain a tag order as per schema.

## Content Rules
- Output MUST be plain text or Markdown with simple formatting (headings, lists, bold/italic).
- Rewrite content to be token-efficient and grep-efficient without altering meaning.
- Content MUST be split into short paragraphs separated by blank lines.
- Each paragraph MUST be 1-3 sentences.
- Each sentence MUST be declarative and information-dense.
- Keep entities, tickers, and terms explicit; avoid pronouns.
- Normalize numbers (e.g. "1,000,000.00", "24%").
- Preserve uncertainty, ranges, and conditional statements exactly.
- Do not add interpretation, synthesis, or analysis.

# TAG SCHEMA:
${tagSchema}

# RAW CONTENT:
${rawContent}
`;
}

async function processDocument(
	ref: DocumentRef,
	ctx: ProcessorContext,
): Promise<void> {
	// 1. Read raw content
	const { tags, content } = await ctx.storage.readRawContent(ref);

	// 2. Clean + chunk + tag with a single LLM call
	ctx.logger?.debug?.("Processing document", { ref, step: "single-pass" });
	const prompt = createProcessingPrompt(content, ctx.domain, ctx.tagSchema);

	const { text, usage } = await generateText({
		model: ctx.model,
		prompt,
	});

	if (!text) {
		throw new Error("Failed to process content: empty LLM response");
	}

	// 3. Render final content with document-level YAML only
	const rendered = renderProcessedDocument(tags, text);

	// 4. Save processed content
	await ctx.storage.saveProcessedContent(ref, rendered);

	ctx.logger?.info?.("Document processed", {
		ref,
		inputCacheReadTokens: usage?.inputTokenDetails.cacheReadTokens,
		inputCacheWriteTokens: usage?.inputTokenDetails.cacheWriteTokens,
		inputTokens: usage?.inputTokens,
		outputTokens: usage?.outputTokens,
		totalTokens: usage?.totalTokens,
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		const t = setTimeout(resolve, ms);
		// If nothing else is keeping the process alive, don't block exit.
		(t as unknown as { unref?: () => void }).unref?.();
	});
}

export function startBackgroundWorkers(args: {
	ctx: ProcessorContext;
	queue: ProcessingQueue;
	concurrency?: number;
	idleSleepMs?: number;
}): void {
	const concurrency = Math.max(1, args.concurrency ?? 1);
	const idleSleepMs = Math.max(50, args.idleSleepMs ?? DEFAULT_IDLE_SLEEP_MS);
	const { ctx, queue } = args;

	async function workerLoop(workerIndex: number): Promise<void> {
		while (true) {
			const docRef = queue.dequeue();
			if (!docRef) {
				await sleep(idleSleepMs);
				continue;
			}

			ctx.logger?.debug?.("Processing started", {
				worker: workerIndex,
				ref: docRef,
			});
			try {
				await processDocument(docRef, ctx);
			} catch (error) {
				ctx.logger?.error?.("Processing failed", {
					err: error,
					ref: docRef,
					worker: workerIndex,
				});
			}
		}
	}

	for (let i = 0; i < concurrency; i++) {
		workerLoop(i + 1);
	}

	ctx.logger?.debug?.("Background workers started", { concurrency });
}

export async function enqueueUnprocessedDocuments(args: {
	storage: FileStorage;
	queue: ProcessingQueue;
	logger?: Logger;
}): Promise<number> {
	const refs = await args.storage.getUnprocessedContents();

	for (const ref of refs) {
		args.logger?.debug?.("Queued unprocessed document", { ref });
		args.queue.enqueue(ref);
	}

	if (refs.length > 0) {
		args.logger?.debug?.("Found unprocessed documents", { count: refs.length });
	}

	return refs.length;
}
