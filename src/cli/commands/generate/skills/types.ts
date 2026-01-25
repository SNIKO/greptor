import type { TagSchema } from "../../../../lib/config.js";

export type AgentType = "claude-code" | "codex" | "opencode";

export interface GreptorPaths {
	readonly configPath: string | undefined;
	readonly rawContentPath: string | undefined;
	readonly processedContentPath: string | undefined;
}

export interface SkillGeneratorOptions {
	domain: string;
	sources: string[];
	tagsSchema: TagSchema;
	basePath: string;
	greptorPaths: GreptorPaths;
	agent: AgentType;
}
