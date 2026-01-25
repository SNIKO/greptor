import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TagSchemaItem } from "../../../../lib/config.js";
import {
	type SkillTemplateField,
	renderSkillTemplate,
} from "./prompt-template.js";
import type { AgentType } from "./types.js";
import type { SkillGeneratorOptions } from "./types.js";

/**
 * Generate agent-specific frontmatter for the skill file.
 */
function generateFrontmatter(options: SkillGeneratorOptions): string {
	const skillName = generateSkillName(options.sources, 30);
	const description = `Search and analyze indexed content from ${options.sources.join(", ")} in the "${options.domain}" domain. Use this skill when you need information from ${options.sources.join(", ")} sources to answer questions or conduct research.`;

	switch (options.agent) {
		case "claude-code":
			return `---
name: ${skillName}
description: ${description}
---`;
		case "codex":
			// Codex uses a simpler format
			return `# ${skillName}

> ${description}`;
		case "opencode":
			// OpenCode uses TOML-style frontmatter
			return `+++
name = "${skillName}"
description = "${description}"
+++`;
		default:
			return `---
name: ${skillName}
description: ${description}
---`;
	}
}

/**
 * Select example fields from the tag schema, prioritizing fields with enum values.
 */
function selectExampleFields(
	tagSchema: TagSchemaItem[],
	count: number,
): TagSchemaItem[] {
	const enumFields = tagSchema.filter(
		(f) => f.enumValues && f.enumValues.length > 0,
	);
	const nonEnumFields = tagSchema.filter(
		(f) => !f.enumValues || f.enumValues.length === 0,
	);

	const selected: TagSchemaItem[] = [];
	selected.push(...enumFields.slice(0, count));
	if (selected.length < count) {
		selected.push(...nonEnumFields.slice(0, count - selected.length));
	}

	return selected;
}

/**
 * Get a sample value from a tag field.
 */
function getSampleValue(field: TagSchemaItem, index: number): string {
	if (field.enumValues && field.enumValues.length > 0) {
		return field.enumValues[0] ?? `${field.name}_val_${index}`;
	}
	return `${field.name}_val_${index}`;
}

function sanitizePathSegment(name: string, maxLength = 50): string {
	let sanitized = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-");
	sanitized = sanitized.replace(/^-+/, "").replace(/-+$/, "");
	sanitized = sanitized.replace(/-+/g, "-");

	if (sanitized.length > maxLength) {
		sanitized = sanitized.slice(0, maxLength);
	}

	return sanitized || "unknown";
}

function resolveContentPath(
	basePath: string,
	contentPath: string | undefined,
	fallback: string,
): string {
	return contentPath ? path.relative(basePath, contentPath) : fallback;
}

function buildTagReferenceList(tagSchema: TagSchemaItem[]): string {
	return tagSchema
		.map((field) => {
			const typeDisplay = field.type;
			const enumSuffix =
				field.enumValues && field.enumValues.length > 0
					? ` — values: \`${field.enumValues.join("`, `")}\``
					: "";
			return `- \`${field.name}\` (*${typeDisplay}*)${enumSuffix}`;
		})
		.join("\n");
}

function buildExampleFields(
	tagSchema: TagSchemaItem[],
	count: number,
): SkillTemplateField[] {
	const selected = selectExampleFields(tagSchema, count);

	return Array.from({ length: count }, (_, index) => {
		const field = selected[index];
		if (!field) {
			return { name: `field${index + 1}`, value: `value${index + 1}` };
		}

		return {
			name: field.name,
			value: getSampleValue(field, 0),
		};
	});
}

async function generateSkillContent(
	options: SkillGeneratorOptions,
): Promise<string> {
	const { sources, greptorPaths, tagsSchema } = options;
	const sourcesDisplay = sources.join(", ");
	const exampleSource = sanitizePathSegment(sources[0] ?? "source");

	const processedPath = resolveContentPath(
		options.basePath,
		greptorPaths.processedContentPath,
		"data/processed",
	);
	const rawPath = resolveContentPath(
		options.basePath,
		greptorPaths.rawContentPath,
		"data/raw",
	);

	return renderSkillTemplate({
		frontmatter: generateFrontmatter(options),
		sourcesDisplay,
		domain: options.domain,
		processedPath,
		rawPath,
		exampleSource,
		exampleFields: buildExampleFields(tagsSchema, 4),
		tagReferenceList: buildTagReferenceList(tagsSchema),
	});
}

/**
 * Get the skill file path based on agent type.
 */
function getSkillPath(
	agent: AgentType,
	baseDir: string,
	skillName: string,
): string {
	switch (agent) {
		case "claude-code":
			return path.join(baseDir, ".claude", "skills", skillName, "SKILL.md");
		case "codex":
			return path.join(baseDir, ".codex", "skills", `${skillName}.md`);
		case "opencode":
			return path.join(baseDir, ".opencode", "skills", `${skillName}.md`);
		default:
			return path.join(baseDir, ".claude", "skills", skillName, "SKILL.md");
	}
}

function generateSkillName(sources: string[], maxLength = 30): string {
	let sourcesStr = sources.join("-");
	sourcesStr = sourcesStr.trim();
	sourcesStr = sourcesStr.toLowerCase().replace(/[^a-z0-9]+/g, "-");
	sourcesStr = sourcesStr.replace(/^-+/, "").replace(/-+$/, "");
	sourcesStr = sourcesStr.replace(/-+/g, "-");

	let skillName = `search-${sourcesStr}`;
	if (skillName.length > maxLength) {
		skillName = skillName.slice(0, maxLength);
	}

	return skillName;
}

/**
 * Generate a skill file for the give options and agent type.
 */
export async function generateSkill(
	options: SkillGeneratorOptions,
): Promise<{ skillPath: string }> {
	const skillName = generateSkillName(options.sources, 30);
	const skillContent = await generateSkillContent(options);

	const skillPath = getSkillPath(options.agent, options.basePath, skillName);
	const skillDir = path.dirname(skillPath);

	await mkdir(skillDir, { recursive: true });
	await writeFile(skillPath, skillContent, "utf8");

	return { skillPath };
}
