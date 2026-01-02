import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { Logger } from "../types.js";
import type { MetadataSchema } from "../types.js";
import { fileExists } from "../utils/file.js";
import { generateMetadataSchema } from "./generate.js";

export const METADATA_SCHEMA_FILENAME = "metadata-schema.yaml";

async function persist(
	schemaFilePath: string,
	metadataSchema: MetadataSchema,
	logger?: Logger,
): Promise<void> {
	const schemaYaml = YAML.stringify(metadataSchema);
	await mkdir(path.dirname(schemaFilePath), { recursive: true });
	await writeFile(schemaFilePath, schemaYaml, "utf8");

	logger?.debug?.("Metadata schema saved", { path: schemaFilePath });
}

export async function initializeMetadataSchema(
	baseDir: string,
	llmModel: string,
	topic: string,
	metadataSchema?: MetadataSchema,
	logger?: Logger,
): Promise<MetadataSchema> {
	const schemaFilePath = path.join(baseDir, METADATA_SCHEMA_FILENAME);

	// If a schema is provided, save it to disk and return it straight away
	if (metadataSchema) {
		await persist(schemaFilePath, metadataSchema, logger);
		return metadataSchema;
	}

	// If schema file exists on disk, load and return it
	if (await fileExists(schemaFilePath)) {
		logger?.debug?.("Metadata schema not provided, loading from file", {
			path: schemaFilePath,
		});

		return YAML.parse(await readFile(schemaFilePath, "utf8")) as MetadataSchema;
	}

	// Otherwise, generate a new schema using the LLM
	logger?.info?.("Generating metadata schema", { topic });
	const schema = await generateMetadataSchema(topic, llmModel);
	await persist(schemaFilePath, schema, logger);
	logger?.info?.("Metadata schema generated", {
		path: schemaFilePath,
		fields: schema.length,
	});

	return schema;
}
