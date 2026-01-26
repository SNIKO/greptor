import type {
	GreptorEatInput,
	GreptorEatResult,
	GreptorOptions,
} from "./types.js";

import YAML from "yaml";
import { writeConfig } from "./config.js";
import { resolveModel } from "./llm/llm-factory.js";
import {
	createProcessingQueue,
	enqueueUnprocessedDocuments,
	startBackgroundWorkers,
} from "./processing/processor.js";
import { createFileStorage } from "./storage/file-storage.js";

export interface Greptor {
	eat: (input: GreptorEatInput) => Promise<GreptorEatResult>;
}

export async function createGreptor(options: GreptorOptions): Promise<Greptor> {
	const { basePath, hooks } = options;
	const model = await resolveModel(options.model);
	const storage = createFileStorage(basePath);

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
	const queuedCount = await enqueueUnprocessedDocuments({
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
		hooks,
	};

	startBackgroundWorkers({ ctx, queue, concurrency: options.workers ?? 1 });

	async function eat(input: GreptorEatInput): Promise<GreptorEatResult> {
		if (input.format !== "text") {
			hooks?.onError?.({
				error: new Error(`Unsupported format: ${input.format}`),
				context: {
					source: input.source,
					publisher: input.publisher,
					label: input.label,
				},
			});
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
			hooks?.onError?.({
				error: new Error(res.message),
				context: {
					source: input.source,
					publisher: input.publisher,
					label: input.label,
				},
			});
			return {
				success: false,
				message: res.message,
			};
		}

		queue.enqueue(res.ref);

		return {
			success: true,
			message: "Content added.",
			ref: res.ref,
		};
	}

	return {
		eat,
	};
}
