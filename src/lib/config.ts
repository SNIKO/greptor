import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { fileExists } from "./utils/file.js";

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
	return path.join(baseDir, ".greptor", "config.yaml");
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
	configPathOrBaseDir: string,
): Promise<GreptorConfig | null> {
	const configPath = configPathOrBaseDir.endsWith(".yaml")
		? configPathOrBaseDir
		: getConfigPath(configPathOrBaseDir);

	if (!(await fileExists(configPath))) {
		return null;
	}

	return YAML.parse(await readFile(configPath, "utf8")) as GreptorConfig;
}

export async function findConfigFile(
	baseDir: string,
): Promise<string | undefined> {
	const queue = [baseDir];
	const visited = new Set<string>();

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current || visited.has(current)) {
			continue;
		}

		visited.add(current);

		try {
			const entries = await readdir(current, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(current, entry.name);
				if (entry.isDirectory()) {
					if (entry.name === ".greptor") {
						const configFilePath = path.join(fullPath, "config.yaml");
						return configFilePath;
					}
					queue.push(fullPath);
				}
			}
		} catch {}
	}

	return undefined;
}
