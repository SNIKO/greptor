import YAML from "yaml";
import type { LlmClient } from "../llm/llm-factory.js";
import type { DocumentRef, FileStorage } from "../storage/index.js";
import type { Logger, Metadata } from "../types.js";
import { chunk as chunkDocument } from "./chunk.js";
import { extractMetadata } from "./extract-metadata.js";

const DEFAULT_IDLE_SLEEP_MS = 750;

export interface ProcessorContext {
	domain: string;
	metadataSchema: string;
	llm: LlmClient;
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

function renderProcessedDocument(
	metadata: Metadata,
	chunkMetadata: Metadata[],
	chunkContent: string,
): string {
	const combinedMetadata = {
		...metadata,
		chunks: chunkMetadata,
	};

	const doc = new YAML.Document(combinedMetadata);

	YAML.visit(doc, {
		Seq(_, node) {
			const allScalars = node.items.every((item) => YAML.isScalar(item));
			if (allScalars) {
				node.flow = true;
			}
		},
	});

	const renderedMetadata = doc.toString({ lineWidth: 200 });

	return [
		"---",
		renderedMetadata.trimEnd(),
		"---",
		"",
		chunkContent.trim(),
	].join("\n");
}

async function processDocument(
	ref: DocumentRef,
	ctx: ProcessorContext,
): Promise<void> {
	// 1. Read raw content
	const { metadata, content } = await ctx.storage.readRawContent(ref);
	const contentLength = content.length;

	// 2. Chunk content with LLM
	ctx.logger?.debug?.("Chunking document", { ref, step: "chunk" });
	const chunkContent = await chunkDocument(content, ctx.domain, ctx.llm);

	// 3. Extract metadata with LLM
	ctx.logger?.debug?.("Extracting metadata", { ref, step: "metadata" });
	const chunkMetadata = await extractMetadata(
		chunkContent,
		ctx.domain,
		ctx.metadataSchema,
		ctx.llm,
	);

	// 4. Parse chunk metadata and render final content
	const rendered = renderProcessedDocument(
		metadata,
		chunkMetadata,
		chunkContent,
	);

	// 5. Save processed content
	await ctx.storage.saveProcessedContent(ref, rendered);

	ctx.logger?.info?.("Document processed", {
		ref,
		chunks: chunkMetadata.length,
		bytes: contentLength,
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
