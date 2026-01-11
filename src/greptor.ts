import type {
	CreateSkillResult,
	GreptorEatInput,
	GreptorEatResult,
	GreptorOptions,
} from "./types.js";

import path from "node:path";
import YAML from "yaml";
import {
	createProcessingQueue,
	enqueueUnprocessedDocuments,
	startBackgroundWorkers,
} from "./processing/processor.js";
import { generateSkill } from "./skills/skill-generator.js";
import { createFileStorage } from "./storage/file-storage.js";
import { initializeTagSchema } from "./tag-schema/initialize.js";

export interface Greptor {
	eat: (input: GreptorEatInput) => Promise<GreptorEatResult>;
	createSkill: (
		sources: string[],
		overwrite: boolean,
	) => Promise<CreateSkillResult>;
}

export async function createGreptor(options: GreptorOptions): Promise<Greptor> {
	const { baseDir, model, hooks } = options;
	const contentPath = path.join(baseDir, "content");
	const storage = createFileStorage(contentPath);

	const tagSchema = await initializeTagSchema(
		storage.baseDir,
		model,
		options.topic,
		options.tagSchema,
	);

	const queue = createProcessingQueue();
	const queuedCount = await enqueueUnprocessedDocuments({
		storage,
		queue,
	});

	const ctx = {
		domain: options.topic,
		tagSchema: YAML.stringify(tagSchema),
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

	async function createSkill(
		sources: string[],
		overwrite = false,
	): Promise<CreateSkillResult> {
		try {
			const { skillPath } = await generateSkill(
				{
					domain: options.topic,
					sources,
					baseDir: options.baseDir,
					tagSchema,
					overwrite,
				},
				storage,
			);

			return {
				success: true,
				message: `Skill created at ${skillPath}`,
				skillPath,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			hooks?.onError?.({
				error: error instanceof Error ? error : new Error(errorMessage),
			});
			return {
				success: false,
				message: errorMessage,
			};
		}
	}

	return {
		eat,
		createSkill,
	};
}
