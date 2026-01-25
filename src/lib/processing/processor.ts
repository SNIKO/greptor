import { type LanguageModel, type LanguageModelUsage, generateText } from "ai";
import YAML from "yaml";
import type { DocumentRef, FileStorage } from "../storage/index.js";
import type { GreptorHooks, Tags } from "../types.js";

const DEFAULT_IDLE_SLEEP_MS = 750;

export interface ProcessorContext {
	domain: string;
	tagSchema: string;
	customProcessingPrompts?: Record<string, string>;
	model: LanguageModel;
	storage: FileStorage;
	hooks?: GreptorHooks | undefined;
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
	customProcessingPrompt?: string,
): string {
	if (customProcessingPrompt) {
		return customProcessingPrompt.replaceAll("{CONTENT}", rawContent);
	}

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

## 01 Short descriptive title for chunk 1
field_1=value_1,value_4
field_2=value_2
field_3=value_3
<cleaned, condensed content>

## 02 Short descriptive title for chunk 2
field_1=value_1
field_4=value_4
field_5=value_5,value_6
<cleaned, condensed content>

## Tagging Rules
- Use ONLY fields defined in the SCHEMA (field names must exactly match schema).
- Do not invent new fields.
- Omit fields with no value.
- One tag field per line.
- DO NOT duplicate fields. For arrays, use comma-separated values.
- For enums, use only allowed enum values from the schema.
- Use ISO-8601 for dates (YYYY-MM-DD).
- Keep tag values grep-friendly: snake_case where appropriate, tickers/codes/symbols in UPPERCASE.
- Maintain tag order as per schema.

## Content Rules
- Output MUST be plain text or Markdown with simple formatting (headings, lists, bold/italic).
- Rewrite content to be token-efficient and grep-efficient without altering meaning.
- Split content into short paragraphs separated by blank lines.
- Each paragraph MUST be 1-3 sentences.
- Each sentence MUST be declarative and information-dense.
- Keep entities, tickers, and terms explicit; avoid pronouns.
- Normalize numbers (e.g., "1,000,000.00", "24%").
- Preserve uncertainty, ranges, and conditional statements exactly.
- Do not add interpretation, synthesis, or analysis.
- Preserve emotional tone and intent where relevant.
- Use scores and reaction metrics (likes, dislikes, upvotes, downvotes) to infer which posts or comments carry higher importance, agreement, disagreement, or emotional weight. Incorporate these signals when summarizing content and when determining how to break it into semantic chunks.

# TAG SCHEMA:
${tagSchema}

# RAW CONTENT:
${rawContent}
`;
}

async function processDocument(
	ref: DocumentRef,
	ctx: ProcessorContext,
	raw?: { tags: Tags; content: string },
	source?: string,
): Promise<LanguageModelUsage> {
	// 1. Read raw content
	const { tags, content } = raw ?? (await ctx.storage.readRawContent(ref));

	// 2. Resolve custom prompt using explicit source
	const customPrompt = source
		? ctx.customProcessingPrompts?.[source]
		: undefined;

	// 3. Clean + chunk + tag with a single LLM call
	const prompt = createProcessingPrompt(
		content,
		ctx.domain,
		ctx.tagSchema,
		customPrompt,
	);

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
	return usage;
}

function resolveDocumentMetadata(
	ref: DocumentRef,
	tags?: Tags,
): { source: string; publisher?: string | undefined; label: string } {
	const refParts = ref.split("/");
	const filename = refParts[refParts.length - 1] ?? "";
	let source = refParts[0] ?? "";
	let publisher = refParts.length > 3 ? refParts[1] : undefined;
	let label = filename.replace(/\.md$/, "");

	const tagSource = tags?.source;
	const tagPublisher = tags?.publisher;
	const tagTitle = tags?.title;

	if (typeof tagSource === "string" && tagSource.trim()) {
		source = tagSource;
	}
	if (typeof tagPublisher === "string" && tagPublisher.trim()) {
		publisher = tagPublisher;
	}
	if (typeof tagTitle === "string" && tagTitle.trim()) {
		label = tagTitle;
	}

	return { source, publisher, label };
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

	// Shared run state across workers
	let runActive = false;
	let runStartTime = 0;
	let runSuccessCount = 0;
	let runFailureCount = 0;
	let runInFlightCount = 0;

	function getQueueTotals() {
		const processed = runActive ? runSuccessCount + runFailureCount : 0;
		const pending = queue.size();
		const total = processed + pending + runInFlightCount;
		return { processed, pending, total };
	}

	function startRun(totalDocs: number): void {
		runActive = true;
		runStartTime = Date.now();
		runSuccessCount = 0;
		runFailureCount = 0;

		ctx.hooks?.onProcessingRunStarted?.({
			documentsToProcess: totalDocs,
			totalDocuments: totalDocs,
		});
	}

	function endRun(): void {
		if (!runActive) return;
		runActive = false;

		ctx.hooks?.onProcessingRunCompleted?.({
			successful: runSuccessCount,
			failed: runFailureCount,
			elapsedMs: Date.now() - runStartTime,
		});
	}

	function tryEndRun(): void {
		if (!runActive) return;
		if (queue.size() === 0 && runInFlightCount === 0) {
			endRun();
		}
	}

	async function workerLoop(): Promise<void> {
		while (true) {
			const { total } = getQueueTotals();

			// Start a new run if there are items and no run is active
			if (total > 0 && !runActive) {
				startRun(total);
			}

			const docRef = queue.dequeue();
			if (!docRef) {
				// Only end when no docs are in-flight across workers
				tryEndRun();
				await sleep(idleSleepMs);
				continue;
			}

			runInFlightCount++;

			let raw: { tags: Tags; content: string } | undefined;
			let readError: Error | undefined;

			try {
				raw = await ctx.storage.readRawContent(docRef);
			} catch (error) {
				readError = error instanceof Error ? error : new Error(String(error));
			}

			const { source, publisher, label } = resolveDocumentMetadata(
				docRef,
				raw?.tags,
			);

			const docStartTime = Date.now();
			const { total: startTotal } = getQueueTotals();

			ctx.hooks?.onDocumentProcessingStarted?.({
				source,
				publisher,
				label,
				successful: runSuccessCount,
				failed: runFailureCount,
				queueSize: startTotal,
			});

			let usage: LanguageModelUsage | undefined;
			let success = false;

			try {
				if (readError) {
					throw readError;
				}
				usage = await processDocument(docRef, ctx, raw, source);
				runSuccessCount++;
				success = true;
			} catch (error) {
				runFailureCount++;
				ctx.hooks?.onError?.({
					error: error instanceof Error ? error : new Error(String(error)),
					context: { source, publisher, label, ref: docRef },
				});
			} finally {
				runInFlightCount--;
			}

			const { total: endTotal } = getQueueTotals();
			ctx.hooks?.onDocumentProcessingCompleted?.({
				success,
				source,
				publisher,
				label,
				successful: runSuccessCount,
				failed: runFailureCount,
				queueSize: endTotal,
				elapsedMs: Date.now() - docStartTime,
				inputTokens: usage?.inputTokens ?? 0,
				outputTokens: usage?.outputTokens ?? 0,
				totalTokens: usage?.totalTokens ?? 0,
			});

			tryEndRun();
		}
	}

	for (let i = 0; i < concurrency; i++) {
		workerLoop();
	}
}

export async function enqueueUnprocessedDocuments(args: {
	storage: FileStorage;
	queue: ProcessingQueue;
}): Promise<number> {
	const refs = await args.storage.getUnprocessedContents();

	for (const ref of refs) {
		args.queue.enqueue(ref);
	}

	return refs.length;
}
