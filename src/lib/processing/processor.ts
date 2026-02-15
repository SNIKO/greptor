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
	hooks?: GreptorHooks;
}

export type ProcessingQueue = DocumentRef[];

export function createProcessingQueue(): ProcessingQueue {
	return [];
}

export function enqueue(queue: ProcessingQueue, ref: DocumentRef): void {
	queue.push(ref);
}

export function dequeue(queue: ProcessingQueue): DocumentRef | undefined {
	return queue.shift();
}

export function queueSize(queue: ProcessingQueue): number {
	return queue.length;
}

function asNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
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

const PROCESSING_TEMPLATE = `# INSTRUCTIONS
Clean, chunk, and tag the raw content for **grep-based search** in the domain: {DOMAIN}.

## Core Principle
Optimize for **single-pass grep scanning**: a single grep hit should reveal what a chunk is about without reading other chunks.

## Objectives
- Remove noise and boilerplate: ads, sponsors, intros/outros, CTAs, repetitions, contact or social links, and sign-offs.
- Preserve **all meaning and factual detail exactly** (facts, names, dates, numbers, ranges, uncertainty, conditions, and meaningful URLs).
- Use **minimal wording** while keeping all information.
- Chunk the content into **semantic sections** (prefer fewer, richer chunks when possible; do not pad content to reach size targets).

## Output Format (Markdown only)

\`\`\`markdown
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
\`\`\`

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
{TAG_SCHEMA}

# RAW CONTENT:
{CONTENT}`;

function createProcessingPrompt(
	rawContent: string,
	domain: string,
	tagSchema: string,
	customProcessingPrompt?: string,
): string {
	if (customProcessingPrompt) {
		return customProcessingPrompt.replaceAll("{CONTENT}", rawContent);
	}

	return PROCESSING_TEMPLATE.replaceAll("{DOMAIN}", domain)
		.replaceAll("{TAG_SCHEMA}", tagSchema)
		.replaceAll("{CONTENT}", rawContent);
}

async function processDocument(
	ref: DocumentRef,
	ctx: ProcessorContext,
	raw?: { tags: Tags; content: string },
	source?: string,
): Promise<LanguageModelUsage> {
	const { tags, content } = raw ?? (await ctx.storage.readRawContent(ref));

	const customPrompt = source
		? ctx.customProcessingPrompts?.[source]
		: undefined;

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

	const rendered = renderProcessedDocument(tags, text);

	await ctx.storage.saveProcessedContent(ref, rendered);
	return usage;
}

function resolveDocumentMetadata(
	ref: DocumentRef,
	tags?: Tags,
): { source: string; publisher?: string; label: string } {
	const parts = ref.split("/");
	const filename = parts.at(-1) ?? "";
	const labelFromPath = filename.replace(/\.md$/, "");
	const sourceFromPath = parts[0] ?? "unknown";
	const publisherFromPath = parts.length > 3 ? parts[1] : undefined;

	const publisher = asNonEmptyString(tags?.publisher) ?? publisherFromPath;

	return {
		source: asNonEmptyString(tags?.source) ?? sourceFromPath,
		label: asNonEmptyString(tags?.title) ?? labelFromPath,
		...(publisher ? { publisher } : {}),
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		const t = setTimeout(resolve, ms);
		(t as unknown as { unref?: () => void }).unref?.();
	});
}

export interface BackgroundWorkerHandle {
	/** Signal workers to finish their current item and exit. Resolves when all workers have stopped. */
	stop: () => Promise<void>;
}

export function startBackgroundWorkers(args: {
	ctx: ProcessorContext;
	queue: ProcessingQueue;
	concurrency?: number;
	idleSleepMs?: number;
}): BackgroundWorkerHandle {
	const concurrency = Math.max(1, args.concurrency ?? 1);
	const idleSleepMs = Math.max(50, args.idleSleepMs ?? DEFAULT_IDLE_SLEEP_MS);
	const { ctx, queue } = args;
	const hooks = ctx.hooks;
	let stopping = false;
	let activeWorkers = 0;
	const workerPromises: Promise<void>[] = [];

	function safeHookCall(call: () => void): void {
		try {
			call();
		} catch {
			// Never let user hooks crash background workers.
		}
	}

	async function workerLoop(): Promise<void> {
		while (!stopping) {
			const docRef = dequeue(queue);
			if (!docRef) {
				await sleep(idleSleepMs);
				continue;
			}

			const wasIdle = activeWorkers === 0;
			activeWorkers++;

			if (wasIdle) {
				const counts = await ctx.storage.getDocumentCounts();
				safeHookCall(() => {
					hooks?.onProcessingStarted?.({
						concurrency,
						documentsCount: counts,
					});
				});
			}

			let raw: { tags: Tags; content: string } | undefined;
			let readError: Error | undefined;

			try {
				raw = await ctx.storage.readRawContent(docRef);
			} catch (error) {
				readError = toError(error);
			}

			const { source, publisher, label } = resolveDocumentMetadata(
				docRef,
				raw?.tags,
			);

			const docStartTime = Date.now();

			const documentsCount = await ctx.storage.getDocumentCounts();
			safeHookCall(() => {
				hooks?.onDocumentProcessingStarted?.({
					source,
					publisher,
					label,
					documentsCount,
				});
			});

			try {
				if (readError) {
					throw readError;
				}

				const usage = await processDocument(docRef, ctx, raw, source);
				const completedDocumentsCount = await ctx.storage.getDocumentCounts();
				safeHookCall(() => {
					hooks?.onDocumentProcessingCompleted?.({
						success: true,
						source,
						publisher,
						label,
						documentsCount: completedDocumentsCount,
						elapsedMs: Date.now() - docStartTime,
						inputTokens: usage?.inputTokens ?? 0,
						outputTokens: usage?.outputTokens ?? 0,
						totalTokens: usage?.totalTokens ?? 0,
					});
				});
			} catch (error) {
				safeHookCall(() => {
					hooks?.onDocumentProcessingCompleted?.({
						success: false,
						source,
						publisher,
						label,
						error: toError(error).message,
					});
				});
			}

			activeWorkers--;

			if (activeWorkers === 0 && queueSize(queue) === 0) {
				const counts = await ctx.storage.getDocumentCounts();
				safeHookCall(() => {
					hooks?.onProcessingCompleted?.({ documentsCount: counts });
				});
			}
		}
	}

	for (let i = 0; i < concurrency; i++) {
		workerPromises.push(workerLoop());
	}

	return {
		stop: async () => {
			stopping = true;
			await Promise.all(workerPromises);
		},
	};
}

export async function enqueueUnprocessedDocuments(args: {
	storage: FileStorage;
	queue: ProcessingQueue;
}): Promise<number> {
	const refs = await args.storage.getUnprocessedContents();

	for (const ref of refs) {
		enqueue(args.queue, ref);
	}

	return refs.length;
}
