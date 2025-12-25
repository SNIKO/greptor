import YAML from "yaml";
import type { LlmClient } from "../llm/llm-factory.js";
import type { FileStorage } from "../storage/file-storage.js";
import type { DocumentRef, Logger, Metadata } from "../types.js";
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
	chunkMetadata: unknown[],
	chunks: string,
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

	const rendereedMetadata = doc.toString({ lineWidth: 200 });

	return ["---", rendereedMetadata.trimEnd(), "---", "", chunks.trim()].join(
		"\n",
	);
}

async function processDocument(
	ref: DocumentRef,
	ctx: ProcessorContext,
): Promise<void> {
	// 1. Read raw content
	const { metadata, content } = await ctx.storage.readRawContent(ref);
	const contentLength = content.length;

	// 2. Chunk content with LLM
	ctx.logger?.debug?.({ ref, step: "chunk" }, "Chunking document");
	const chunks = await chunkDocument(content, ctx.domain, ctx.llm);

	// 3. Extract metadata with LLM
	ctx.logger?.debug?.({ ref, step: "metadata" }, "Extracting metadata");
	const chunksMetadata = await extractMetadata(
		chunks,
		ctx.domain,
		ctx.metadataSchema,
		ctx.llm,
	);

	// 4. Parse chunk metadata and render final content
	const rendered = renderProcessedDocument(metadata, chunksMetadata, chunks);

	// 5. Save processed content
	await ctx.storage.saveProcessedContent(ref, rendered);

	ctx.logger?.info?.(
		{ ref, chunks: chunksMetadata.length, bytes: contentLength },
		"Document processed",
	);
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

			ctx.logger?.debug?.(
				{ worker: workerIndex, ref: docRef },
				"Processing started",
			);
			try {
				await processDocument(docRef, ctx);
			} catch (error) {
				ctx.logger?.error?.(
					{ err: error, ref: docRef, worker: workerIndex },
					"Processing failed",
				);
			}
		}
	}

	for (let i = 0; i < concurrency; i++) {
		workerLoop(i + 1);
	}

	ctx.logger?.debug?.({ concurrency }, "Background workers started");
}

export async function enqueueUnprocessedDocuments(args: {
	storage: FileStorage;
	queue: ProcessingQueue;
	logger?: Logger;
}): Promise<number> {
	const refs = await args.storage.getUnprocessedContents();

	for (const ref of refs) {
		args.logger?.debug?.({ ref }, "Queued unprocessed document");
		args.queue.enqueue(ref);
	}

	if (refs.length > 0) {
		args.logger?.debug?.({ count: refs.length }, "Found unprocessed documents");
	}

	return refs.length;
}
