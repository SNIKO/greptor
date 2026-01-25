import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { fileExists } from "./utils/file.js";

export const CONFIG_FILENAME = "config.yaml";

export const TagFieldSchema = z.object({
	name: z.string().describe("Tag field name in snake_case"),
	type: z
		.enum([
			"string",
			"string[]",
			"number",
			"number[]",
			"boolean",
			"enum",
			"enum[]",
			"date",
		])
		.describe("Field data type"),
	description: z.string().describe("Purpose and usage of this tag field"),
	enumValues: z
		.array(z.string())
		.nullable()
		.describe("Full list of enum values for enum types."),
});

export type TagSchemaItem = z.infer<typeof TagFieldSchema>;
export type TagSchema = TagSchemaItem[];

export interface GreptorConfig {
	domain: string;
	tagSchema: TagSchema;
}

export function getConfigPath(baseDir: string): string {
	return path.join(baseDir, ".greptor", CONFIG_FILENAME);
}

export async function writeConfig(
	baseDir: string,
	config: GreptorConfig,
): Promise<void> {
	const configPath = getConfigPath(baseDir);
	await mkdir(path.dirname(configPath), { recursive: true });
	await writeFile(configPath, YAML.stringify(config), "utf8");
}

export async function readConfig(
	baseDir: string,
): Promise<GreptorConfig | null> {
	const configPath = getConfigPath(baseDir);
	if (!(await fileExists(configPath))) {
		return null;
	}

	return YAML.parse(await readFile(configPath, "utf8")) as GreptorConfig;
}
