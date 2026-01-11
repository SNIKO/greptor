import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LanguageModel } from "ai";
import YAML from "yaml";
import type { TagSchema } from "../types.js";
import { fileExists } from "../utils/file.js";
import { generateTagSchema } from "./generate.js";

export const TAG_SCHEMA_FILENAME = "tag-schema.yaml";

async function persist(
	schemaFilePath: string,
	tagSchema: TagSchema,
): Promise<void> {
	const schemaYaml = YAML.stringify(tagSchema);
	await mkdir(path.dirname(schemaFilePath), { recursive: true });
	await writeFile(schemaFilePath, schemaYaml, "utf8");
}

export async function initializeTagSchema(
	baseDir: string,
	model: LanguageModel,
	topic: string,
	tagSchema?: TagSchema,
): Promise<TagSchema> {
	const schemaFilePath = path.join(baseDir, TAG_SCHEMA_FILENAME);

	// If a schema is provided, save it to disk and return it straight away
	if (tagSchema) {
		await persist(schemaFilePath, tagSchema);
		return tagSchema;
	}

	// If schema file exists on disk, load and return it
	if (await fileExists(schemaFilePath)) {
		return YAML.parse(await readFile(schemaFilePath, "utf8")) as TagSchema;
	}

	// Otherwise, generate a new schema using the LLM
	const schema = await generateTagSchema(topic, model);
	await persist(schemaFilePath, schema);

	return schema;
}
