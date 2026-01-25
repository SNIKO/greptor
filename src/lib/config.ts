import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { fileExists } from "./utils/file.js";

export const CONFIG_FILENAME = "greptor-config.yaml";

import type { TagSchema } from "./types.js";
export { TagFieldSchema, type TagSchemaItem, type TagSchema } from "./types.js";

export interface GreptorConfig {
	domain: string;
	tagSchema: TagSchema;
}

export function getConfigPath(baseDir: string): string {
	return path.join(baseDir, CONFIG_FILENAME);
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
