import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
	cancel,
	intro,
	isCancel,
	outro,
	select,
	spinner,
	text,
} from "@clack/prompts";
import { buildCommand } from "@stricli/core";
import YAML from "yaml";
import { CONFIG_FILENAME } from "../../../../lib/config.js";
import { resolveModel } from "../../../../lib/llm/llm-factory.js";
import type { ModelConfig } from "../../../../lib/types.js";
import { readAuthStore } from "../../../utils/auth.js";
import { generateTagSchema } from "./generator.js";

async function findGreptorConfigPath(
	workspacePath: string,
): Promise<string | undefined> {
	const queue = [workspacePath];
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
						const configFilePath = path.join(fullPath, CONFIG_FILENAME);
						return configFilePath;
					}
					queue.push(fullPath);
				}
			}
		} catch {}
	}

	return undefined;
}

async function loadDefaultDomain(): Promise<string> {
	const configPath = await findGreptorConfigPath(".");

	if (!configPath) {
		return "";
	}

	try {
		const parsed = YAML.parse(await readFile(configPath, "utf-8")) as {
			domain?: unknown;
		};

		return typeof parsed.domain === "string" ? parsed.domain : "";
	} catch {
		return "";
	}
}

async function generateTagsCommand(): Promise<void> {
	intro("Generate Tags Schema");

	const defaultDomain = await loadDefaultDomain();
	const domain = await text({
		message: "Domain to generate tag schema for:",
		initialValue: defaultDomain,
		placeholder: "e.g., Investing, stock market, financial, and macroeconomics",
		validate: (v) => (!v?.trim() ? "Domain is required" : undefined),
	});

	if (isCancel(domain)) {
		cancel("Cancelled");
		return;
	}

	const s = spinner();

	try {
		s.start("Loading auth profiles...");
		const authStore = await readAuthStore();
		const authIds = Object.keys(authStore).sort();
		if (authIds.length === 0) {
			s.stop("No auth profile found");
			cancel("No auth profile found. Run: greptor login");
			return;
		}

		const firstAuthId = authIds[0];
		if (!firstAuthId) {
			s.stop("No auth profile found");
			cancel("No auth profile found. Run: greptor login");
			return;
		}

		let authId = firstAuthId;
		if (authIds.length > 1) {
			s.stop(`Found ${authIds.length} auth profiles`);

			const selected = await select<string>({
				message: "Select an auth profile:",
				options: authIds.map((id) => {
					const auth = authStore[id];
					return {
						value: id,
						label: id,
						hint: auth ? `${auth.provider} / ${auth.model}` : "",
					};
				}),
			});

			if (isCancel(selected)) {
				cancel("Cancelled");
				return;
			}

			authId = selected;
			s.start("Using selected auth profile...");
		}

		const auth = authStore[authId];
		if (!auth) {
			s.stop("No auth profile found");
			cancel("No auth profile found. Run: greptor login");
			return;
		}
		s.stop(`Using auth profile: ${authId} (${auth.provider} / ${auth.model})`);

		const options: Record<string, unknown> = { apiKey: auth.apiKey };
		if (auth.baseUrl?.trim()) {
			options.baseURL = auth.baseUrl;
			options.baseUrl = auth.baseUrl;
		}

		const modelConfig: ModelConfig = {
			provider: auth.provider,
			model: auth.model,
			options,
		};

		s.start("Resolving model...");
		const model = await resolveModel(modelConfig);
		s.stop("Model ready");

		s.start("Generating tag schema...");
		const tagSchema = await generateTagSchema(domain.trim(), model);
		s.stop("Generated");

		outro("Generated tag schema YAML:");
		// Keep YAML output at the bottom for easy copy/paste.
		console.log(YAML.stringify(tagSchema).trimEnd());
	} catch (error) {
		s.stop("Error");
		cancel(error instanceof Error ? error.message : String(error));
	}
}

export const tagsCommand = buildCommand({
	func: generateTagsCommand,
	parameters: {
		flags: {},
		positional: { kind: "tuple", parameters: [] },
	},
	docs: {
		brief: "Generate a tag schema for a domain (YAML output)",
	},
});
