import type {
	CreateSkillResult,
	GreptorAddInput,
	GreptorAddResult,
	GreptorOptions,
} from "./types.js";

import path from "node:path";
import { createLlmClient } from "./llm/llm-factory.js";
import { initializeMetadataSchema } from "./metadata-schema/initialize.js";
import {
	createProcessingQueue,
	enqueueUnprocessedDocuments,
	startBackgroundWorkers,
} from "./processing/processor.js";
import { generateSkill } from "./skills/skill-generator.js";
import { createFileStorage } from "./storage/file-storage.js";

export interface Greptor {
	eat: (input: GreptorAddInput) => Promise<GreptorAddResult>;
	createSkill: (sources: string[]) => Promise<CreateSkillResult>;
}

export async function createGreptor(options: GreptorOptions): Promise<Greptor> {
	const { baseDir, logger } = options;
	const contentPath = path.join(baseDir, "content");
	const storage = createFileStorage(contentPath);

	logger?.debug?.("Initializing Greptor", { baseDir, topic: options.topic });

	const metadataSchema = await initializeMetadataSchema(
		storage.baseDir,
		options.llmModel,
		options.topic,
		options.metadataSchema,
		logger,
	);

	const queue = createProcessingQueue();
	const queuedCount = await enqueueUnprocessedDocuments({
		storage,
		queue,
		logger,
	});

	const llm = createLlmClient(options.llmModel);
	const ctx = {
		domain: options.topic,
		metadataSchema,
		llm,
		storage,
		logger,
	};

	startBackgroundWorkers({ ctx, queue, concurrency: options.workers ?? 1 });

	logger?.info?.("Greptor initialized", {
		topic: options.topic,
		queued: queuedCount,
	});

	async function eat(input: GreptorAddInput): Promise<GreptorAddResult> {
		if (input.format !== "text") {
			logger?.warn?.("Unsupported format", { format: input.format });
			return {
				success: false,
				message: `Unsupported format: ${input.format}`,
			};
		}

		try {
			const ref = await storage.saveRawContent(input);
			queue.enqueue(ref);
			logger?.info?.("Document ingested", { ref, label: input.label });

			return {
				success: true,
				message: "Content added.",
				ref,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			logger?.error?.("Ingestion failed", { err: error, label: input.label });
			return {
				success: false,
				message: errorMessage,
			};
		}
	}

	async function createSkill(sources: string[]): Promise<CreateSkillResult> {
		try {
			logger?.info?.("Generating Claude Code skill", {
				domain: options.topic,
			});

			const { skillPath } = await generateSkill(
				{
					domain: options.topic,
					sources,
					baseDir: options.baseDir,
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
			logger?.error?.(`Skill generation failed:\n${errorMessage}`);
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
