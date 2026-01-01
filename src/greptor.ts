import type {
	CreateSkillResult,
	GreptorAddInput,
	GreptorAddResult,
	GreptorOptions,
} from "./types.js";

import { log } from "node:console";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { createLlmClient } from "./llm/llm-factory.js";
import { generateMetadataSchema } from "./metadata-schema-generator.js";
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

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function initializeMetadataSchema(
	options: GreptorOptions,
	destinationFolder: string,
): Promise<string> {
	const { llmModel, metadataSchema, autoGenerateMetadataSchema, logger } =
		options;
	const schemaFileYaml = path.join(destinationFolder, "metadata-schema.yaml");

	if (metadataSchema) {
		const schemaYaml = YAML.stringify(metadataSchema);
		await mkdir(path.dirname(schemaFileYaml), { recursive: true });
		await writeFile(schemaFileYaml, schemaYaml, "utf8");
		logger?.debug?.("Metadata schema saved", { path: schemaFileYaml });
		return schemaYaml;
	}

	if (await fileExists(schemaFileYaml)) {
		logger?.debug?.("Loaded metadata schema from disk", {
			path: schemaFileYaml,
		});
		return await readFile(schemaFileYaml, "utf8");
	}

	if (!autoGenerateMetadataSchema) {
		throw new Error(
			"No metadata schema found. Provide `metadataSchema`, or set `autoGenerateMetadataSchema: true`.",
		);
	}

	logger?.info?.("Generating metadata schema", { topic: options.topic });
	const schema = await generateMetadataSchema(options.topic, llmModel);
	const schemaYaml = YAML.stringify(schema);
	await mkdir(path.dirname(schemaFileYaml), { recursive: true });
	await writeFile(schemaFileYaml, schemaYaml, "utf8");
	logger?.info?.("Metadata schema generated", {
		path: schemaFileYaml,
		fields: schema.length,
	});
	return schemaYaml;
}

export async function createGreptor(options: GreptorOptions): Promise<Greptor> {
	const { baseDir, logger } = options;
	const contentPath = path.join(baseDir, "content");
	const storage = createFileStorage(contentPath);

	logger?.debug?.("Initializing Greptor", { baseDir, topic: options.topic });

	// Load metadata schema
	const metadataSchema = await initializeMetadataSchema(
		options,
		storage.baseDir,
	);
	const llm = createLlmClient(options.llmModel);
	const queue = createProcessingQueue();

	const ctx = {
		domain: options.topic,
		metadataSchema,
		llm,
		storage,
		logger,
	};

	// Populate queue from disk first, then start background workers.
	const queuedCount = await enqueueUnprocessedDocuments({
		storage,
		queue,
		logger,
	});
	startBackgroundWorkers({ ctx, queue, concurrency: options.workers ?? 1 });

	logger?.info?.("Greptor initialized", {
		topic: options.topic,
		queued: queuedCount,
	});

	return {
		async eat(input: GreptorAddInput): Promise<GreptorAddResult> {
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
		},

		async createSkill(sources: string[]): Promise<CreateSkillResult> {
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
		},
	};
}
