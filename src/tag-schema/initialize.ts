import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LanguageModel } from "ai";
import YAML from "yaml";
import type { Logger } from "../types.js";
import type { TagSchema } from "../types.js";
import { fileExists } from "../utils/file.js";
import { generateTagSchema } from "./generate.js";

export const TAG_SCHEMA_FILENAME = "tag-schema.yaml";

async function persist(
	schemaFilePath: string,
	tagSchema: TagSchema,
	logger?: Logger,
): Promise<void> {
	const schemaYaml = YAML.stringify(tagSchema);
	await mkdir(path.dirname(schemaFilePath), { recursive: true });
	await writeFile(schemaFilePath, schemaYaml, "utf8");

	logger?.debug?.("Tag schema saved", { path: schemaFilePath });
}

export async function initializeTagSchema(
	baseDir: string,
	model: LanguageModel,
	topic: string,
	tagSchema?: TagSchema,
	logger?: Logger,
): Promise<TagSchema> {
	const schemaFilePath = path.join(baseDir, TAG_SCHEMA_FILENAME);

	// If a schema is provided, save it to disk and return it straight away
	if (tagSchema) {
		await persist(schemaFilePath, tagSchema, logger);
		return tagSchema;
	}

	// If schema file exists on disk, load and return it
	if (await fileExists(schemaFilePath)) {
		logger?.debug?.("Tag schema not provided, loading from file", {
			path: schemaFilePath,
		});

		return YAML.parse(await readFile(schemaFilePath, "utf8")) as TagSchema;
	}

	// Otherwise, generate a new schema using the LLM
	logger?.info?.("Generating tag schema", { topic });
	const schema = await generateTagSchema(topic, model);
	await persist(schemaFilePath, schema, logger);
	logger?.info?.("Tag schema generated", {
		path: schemaFilePath,
		fields: schema.length,
	});

	return schema;
}
