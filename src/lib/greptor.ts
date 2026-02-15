import type {
	GreptorEatInput,
	GreptorEatResult,
	GreptorOptions,
	SourceCounts,
} from "./types.js";

import YAML from "yaml";
import { writeConfig } from "./config.js";
import { resolveModel } from "./llm/llm-factory.js";
import {
	type BackgroundWorkerHandle,
	createProcessingQueue,
	enqueue,
	enqueueUnprocessedDocuments,
	startBackgroundWorkers,
} from "./processing/processor.js";
import { createFileStorage } from "./storage/file-storage.js";

export interface Greptor {
	eat: (input: GreptorEatInput) => Promise<GreptorEatResult>;
	getDocumentCounts: () => Promise<SourceCounts>;
	/** Enqueue unprocessed documents and start background processing workers. */
	start: () => Promise<void>;
	/** Gracefully stop background workers. Workers finish their current item before exiting. */
	stop: () => Promise<void>;
}

export async function createGreptor(options: GreptorOptions): Promise<Greptor> {
	const { basePath, hooks } = options;
	const model = await resolveModel(options.model);
	const storage = await createFileStorage(basePath);

	if (!options.tagSchema || options.tagSchema.length === 0) {
		throw new Error(
			"Missing tag schema. Provide `tagSchema` in options. Generate one with `greptor generate tags`",
		);
	}

	const configData = {
		domain: options.topic,
		tagSchema: options.tagSchema,
		...(options.customProcessingPrompts && {
			customProcessingPrompts: options.customProcessingPrompts,
		}),
	};
	await writeConfig(basePath, configData);

	const queue = createProcessingQueue();
	await enqueueUnprocessedDocuments({
		storage,
		queue,
	});

	const ctx = {
		domain: options.topic,
		tagSchema: YAML.stringify(options.tagSchema),
		...(options.customProcessingPrompts && {
			customProcessingPrompts: options.customProcessingPrompts,
		}),
		model,
		storage,
		...(hooks ? { hooks } : {}),
	};

	let workerHandle: BackgroundWorkerHandle | undefined;

	async function start(): Promise<void> {
		if (workerHandle) {
			return;
		}

		workerHandle = startBackgroundWorkers({
			ctx,
			queue,
			concurrency: options.workers ?? 1,
		});
	}

	async function stop(): Promise<void> {
		if (!workerHandle) {
			return;
		}

		await workerHandle.stop();
		workerHandle = undefined;
	}

	async function eat(input: GreptorEatInput): Promise<GreptorEatResult> {
		if (input.format !== "text") {
			return {
				success: false,
				message: `Unsupported format: ${input.format}`,
			};
		}

		const res = await storage.saveRawContent(input);

		if (res.type === "duplicate") {
			return {
				success: false,
				message: "Document already exists.",
			};
		}

		if (res.type === "error") {
			return {
				success: false,
				message: res.message,
			};
		}

		enqueue(queue, res.ref);

		return {
			success: true,
			message: "Content added.",
			ref: res.ref,
		};
	}

	return {
		eat,
		getDocumentCounts: () => storage.getDocumentCounts(),
		start,
		stop,
	};
}
