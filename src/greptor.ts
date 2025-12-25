import type {
	GreptorAddInput,
	GreptorAddResult,
	GreptorOptions,
} from "./types.js";

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
import { createFileStorage } from "./storage/file-storage.js";

export interface Greptor {
	eat: (input: GreptorAddInput) => Promise<GreptorAddResult>;
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
): Promise<string> {
	const { llmModel, metadataSchema, autoGenerateMetadataSchema, logger } =
		options;
	const schemaFileYaml = path.join(options.baseDir, "metadata-schema.yaml");

	if (metadataSchema) {
		const schemaYaml = YAML.stringify(metadataSchema);
		await mkdir(path.dirname(schemaFileYaml), { recursive: true });
		await writeFile(schemaFileYaml, schemaYaml, "utf8");
		logger?.debug?.({ path: schemaFileYaml }, "Metadata schema saved");
		return schemaYaml;
	}

	if (await fileExists(schemaFileYaml)) {
		logger?.debug?.(
			{ path: schemaFileYaml },
			"Loaded metadata schema from disk",
		);
		return await readFile(schemaFileYaml, "utf8");
	}

	if (!autoGenerateMetadataSchema) {
		throw new Error(
			"No metadata schema found. Provide `metadataSchema`, or set `autoGenerateMetadataSchema: true`.",
		);
	}

	logger?.info?.({ topic: options.topic }, "Generating metadata schema");
	const schema = await generateMetadataSchema(options.topic, llmModel);
	const schemaYaml = YAML.stringify(schema);
	await mkdir(path.dirname(schemaFileYaml), { recursive: true });
	await writeFile(schemaFileYaml, schemaYaml, "utf8");
	logger?.info?.(
		{ path: schemaFileYaml, fields: schema.length },
		"Metadata schema generated",
	);
	return schemaYaml;
}

export async function createGreptor(options: GreptorOptions): Promise<Greptor> {
	const { baseDir, logger } = options;
	const storage = createFileStorage(baseDir);

	logger?.debug?.({ baseDir, topic: options.topic }, "Initializing Greptor");

	// Load metadata schema
	const metadataSchema = await initializeMetadataSchema(options);
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

	logger?.info?.(
		{ topic: options.topic, queued: queuedCount },
		"Greptor initialized",
	);

	return {
		async eat(input: GreptorAddInput): Promise<GreptorAddResult> {
			if (input.format !== "text") {
				logger?.warn?.({ format: input.format }, "Unsupported format");
				return {
					success: false,
					message: `Unsupported format: ${input.format}`,
				};
			}

			try {
				const ref = await storage.saveRawContent(input);
				queue.enqueue(ref);
				logger?.info?.({ ref, label: input.label }, "Document ingested");

				return {
					success: true,
					message: "Content added.",
					ref,
				};
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				logger?.error?.({ err: error, label: input.label }, "Ingestion failed");
				return {
					success: false,
					message: errorMessage,
				};
			}
		},
	};
}
