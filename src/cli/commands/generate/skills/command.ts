import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
	cancel,
	intro,
	isCancel,
	log,
	outro,
	select,
	spinner,
} from "@clack/prompts";
import { buildCommand } from "@stricli/core";
import YAML from "yaml";
import type { GreptorConfig } from "../../../../lib/config.js";
import { CONFIG_FILENAME } from "../../../../lib/config.js";
import { generateSkill } from "./generator.js";
import type { AgentType, GreptorPaths } from "./types.js";

import {
	PROCESSED_DIR_NAME,
	RAW_DIR_NAME,
} from "../../../../lib/storage/file-storage.js";

async function findGreptorPaths(workspacePath: string): Promise<GreptorPaths> {
	let rawPath: string | undefined;
	let processedPath: string | undefined;
	let configPath: string | undefined;

	const queue = [workspacePath];
	const visited = new Set<string>();

	while (queue.length > 0) {
		if (rawPath && processedPath && configPath) {
			break;
		}

		const current = queue.shift();
		if (!current || visited.has(current)) {
			continue;
		}

		visited.add(current);

		try {
			const entries = await readdir(current, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.isDirectory()) {
					const fullPath = path.join(current, entry.name);

					if (entry.name === RAW_DIR_NAME && !rawPath) {
						rawPath = fullPath;
					} else if (entry.name === PROCESSED_DIR_NAME && !processedPath) {
						processedPath = fullPath;
					} else {
						queue.push(fullPath);
					}
				} else if (entry.isFile()) {
					if (entry.name === CONFIG_FILENAME) {
						configPath = path.join(current, entry.name);
					}
				}
			}
		} catch {}
	}

	return {
		configPath: configPath,
		rawContentPath: rawPath,
		processedContentPath: processedPath,
	};
}

async function findSources(processedPath: string): Promise<string[]> {
	const entries = await readdir(processedPath, { withFileTypes: true });
	const sources: string[] = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			sources.push(entry.name);
		}
	}

	return sources;
}

async function generateSkillsCommand(): Promise<void> {
	console.clear();
	intro("greptor generate skills");

	const s = spinner();

	try {
		// Step 1: Find greptor content directories for the skill
		s.start("Scanning workspace for greptor paths...");
		const greptorPaths = await findGreptorPaths(".");
		s.stop();

		if (
			!greptorPaths.rawContentPath ||
			!greptorPaths.processedContentPath ||
			!greptorPaths.configPath
		) {
			cancel("The current directory doesn't contain greptor content.");
			return;
		}

		// Step 2: Select agent type
		const agent = await select<AgentType>({
			message: "Select agent type:",
			options: [
				{
					value: "claude-code",
					label: "Claude Code",
					hint: "Anthropic Claude Code agent",
				},
				{ value: "codex", label: "Codex", hint: "OpenAI Codex CLI agent" },
				{ value: "opencode", label: "OpenCode", hint: "OpenCode agent" },
			],
		});

		if (isCancel(agent)) {
			cancel("Cancelled");
			return;
		}

		// Step 4: Load config.yaml from workspace
		s.start("Loading config.yaml...");
		const config = YAML.parse(
			await readFile(greptorPaths.configPath, "utf-8"),
		) as GreptorConfig;
		if (!config.domain || !config.tagSchema || config.tagSchema.length === 0) {
			s.stop("Invalid config");
			cancel("Invalid configuration");
			return;
		}

		s.stop("Config loaded");

		// Step 5: Find content sources from the processed content
		s.start("Finding content sources for the skill...");
		const sources = await findSources(greptorPaths.processedContentPath);
		s.stop(`Found ${sources.length} sources`);

		// Step 6: Generate skills
		s.start("Generating skills...");

		const { skillPath } = await generateSkill({
			domain: config.domain,
			sources,
			basePath: ".",
			greptorPaths: greptorPaths,
			tagsSchema: config.tagSchema,
			agent,
		});

		const relativePath = path.relative(process.cwd(), skillPath);
		s.stop(`Skill file generated at ${relativePath}`);

		outro("Skill generation complete!");
	} catch (error) {
		s.stop("Error");
		const message = error instanceof Error ? error.message : String(error);
		log.error(`Failed to generate skill: ${message}`);
		cancel("Generation failed");
	}
}

export const skillsCommand = buildCommand({
	func: generateSkillsCommand,
	parameters: {
		flags: {},
		positional: { kind: "tuple", parameters: [] },
	},
	docs: {
		brief: "Generate skills file for AI coding agents",
	},
});
