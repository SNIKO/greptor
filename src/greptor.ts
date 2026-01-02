import type {
	CreateSkillResult,
	GreptorAddInput,
	GreptorAddResult,
	GreptorOptions,
} from "./types.js";

import path from "node:path";
import YAML from "yaml";
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
	createSkill: (
		sources: string[],
		overwrite: boolean,
	) => Promise<CreateSkillResult>;
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
		metadataSchema: YAML.stringify(metadataSchema),
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

		const res = await storage.saveRawContent(input);

		if (res.type === "duplicate") {
			logger?.warn?.("Attempt to add duplicate document", {
				ref: res.ref,
				label: input.label,
			});
		}

		if (res.type === "error" || !res.ref) {
			return {
				success: false,
				message: res.message || "Unknown error saving content.",
			};
		}

		queue.enqueue(res.ref);
		logger?.info?.("Document ingested", { ref: res.ref, label: input.label });

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
			logger?.info?.("Generating Claude Code skill", {
				domain: options.topic,
			});

			const { skillPath } = await generateSkill(
				{
					domain: options.topic,
					sources,
					baseDir: options.baseDir,
					metadataSchema,
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
