import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStorage } from "../storage/file-storage.js";
import type { TagSchemaItem } from "../types.js";
import { fileExists } from "../utils/file.js";

export interface SkillGeneratorOptions {
	domain: string;
	sources: string[];
	baseDir: string;
	tagSchema: TagSchemaItem[];
	overwrite: boolean;
}

/**
 * Generate ripgrep example patterns for a tag field
 */
function generateRgPattern(
	field: string,
	sampleValue: string,
	isArray: boolean,
): string {
	const valuePattern = isArray
		? `\\b${field}=[^\\n]*\\b${sampleValue}\\b`
		: `\\b${field}=${sampleValue}\\b`;
	return `rg -n -C 6 "${valuePattern}" processed`;
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

/**
 * Generate the skill content from a template
 */
function generateSkillContent(
	domain: string,
	sources: string[],
	tagSchema: TagSchemaItem[],
	fileStorage: FileStorage,
): string {
	const skillName = generateSkillName(sources);

	// Generate tag list from schema
	const tagList = tagSchema
		.map((field) => {
			const typeSuffix =
				field.type.startsWith("enum") && field.enumValues
					? ` (values: ${field.enumValues.join(", ")})`
					: "";
			return `- \`${field.name}\` - *${field.type}*${typeSuffix}`;
		})
		.join("\n");

	// Generate ripgrep examples for first 3-4 fields, showing both array and single-value patterns
	const exampleFields = tagSchema.slice(0, 4);
	const rgExamples = exampleFields
		.map((field) => {
			// Check if field type indicates an array (e.g., "string[]", "enum[]")
			const typeStr = String(field.type);
			const isArray = typeStr.includes("[]");
			const sampleValue = field.enumValues?.[0] ?? "VALUE";
			const example = generateRgPattern(field.name, sampleValue, isArray);
			return `# By ${field.name}\n${example}`;
		})
		.join("\n\n");

	const exampleSource = sanitizePathSegment(sources[0] ?? "source");

	return `---
name: ${skillName}
description: Guide for searching and analyzing indexed content from ${sources.join(", ")} in the '${domain}' domain. This skill should be used when you need information from ${sources.join(", ")} sources to answer questions or conduct research.
---

# Skill Overview

This skill provides guidance for efficient search over indexed content from ${sources.join(", ")} in the \`${domain}\` domain. It leverages grep-friendly tags and chunked content storage to enable precise filtering and retrieval.

## About the Content

Content from ${sources.join(", ")} has been fetched, chunked, enriched with searchable tags, and stored in the '${fileStorage.baseDir}' directory.

### Directory Structure

\`\`\`
${fileStorage.baseDir}/
├── processed/       # Cleaned, search-optimized content with tags
│   └── {source}/    # ${sources.join(", ")}, etc.
│       └── {publisher?}/
│           └── YYYY-MM/
│               └── YYYY-MM-DD-label.md
└── raw/             # Original raw content as ingested (mirrors processed/)
\`\`\`

### File Format

Each processed file contains YAML frontmatter with document level tags. 
The content part contains semantically chunked content with inline chunk tags.

\`\`\`yaml
---
title: "Document Title"
source: "Source Name"
publisher: "Publisher Name"
<other document tags>
---

## 01 First Chunk Title
field1=value
field2=value1,value2
<chunk content here>

## 02 Second Chunk Title
field1=value
field2=value3
<chunk content here>
\`\`\`

The tag lines serve as a compact, grep-friendly index for each chunk.
There are ${tagList.length}} total tag fields in general, but only half are present in any given chunk (the rest are omitted if are not applicable).

### Key Tag Fields

Below are tag fields with sample values:

${tagList}

## Recommended Search Strategy

0. **ALWAYS use rg (ripgrep)**:  
   Ripgrep is optimized for searching large codebases and text files quickly. It supports regex, file path patterns, and context capture.
   It MUST be your primary search tool for this content if installed.

1. **Constrain by time range first**  
   Use file path patterns (e.g., \`YYYY/MM/YYYY-MM-DD\`) to limit the search space before inspecting content.

2. **Apply tag filters**  
   Use \`ripgrep\` to match tag lines for chunk-level tags. Always include \`-C 6\` so the full tag block appears in context:
   - **Single values**: \`rg -n -C 6 "field=value"\`
   - **Arrays** (comma-separated): \`rg -n -C 6 "field=.*value"\`

   Refer to the Key Metadata Fields section below to understand which fields are arrays vs single values.

3. **Capture surrounding tag lines**
   Use the \`-C\` flag with \`ripgrep\` to capture lines before and after matches, ensuring you get full list of tags each chunk so that you can pipe multiple tag filters together.
	 You can assume there are up to 6 tag lines per chunk. But refer to tag schema to estimate count.

4. **Refine iteratively**  
   Adjust path patterns, tag filters, and query terms based on findings until no new relevant documents or chunks appear.

## Ripgrep Search Examples

\`\`\`bash
# Search only ${exampleSource} content
rg "search query" processed/${exampleSource}

# Search ${exampleSource} content from December 2025
rg "search query" processed/${exampleSource} --glob "**/2025-12/*.md"

# Combine multiple tag filters (pipe + context)
rg -n -C 6 "field1=value1" processed | rg "field2=value2"

# List unique values for a tag field
rg -n -C 6 "field_name=" processed | rg -o "field_name=[^\\n]+" | cut -d= -f2 | tr ',' '\n' | sort | uniq -c | sort -rn | head -20

${rgExamples}
\`\`\`

## Important Guidelines

- **Primary source**: Always use the \`processed/\` directory for searches; only fall back to \`raw/\` if necessary
- **Tags first**: Start with tag filtering before full-text content search
- **Context capture**: Use \`-B\` and \`-A\` flags to capture surrounding lines for context without reading entire chunks
- **Citation style**: When referencing content, cite by source name, publisher, and title—never expose internal structure like chunk IDs or file paths to the user
`;
}

/**
 * Generate a Claude Code skill file for searching indexed data
 */
export async function generateSkill(
	options: SkillGeneratorOptions,
	fileStorage: FileStorage,
): Promise<{ skillPath: string }> {
	const skillName = generateSkillName(options.sources, 30);
	const skillContent = generateSkillContent(
		options.domain,
		options.sources,
		options.tagSchema,
		fileStorage,
	);

	// Create skill directory
	const skillDir = path.join(options.baseDir, ".claude", "skills", skillName);
	await mkdir(skillDir, { recursive: true });

	// Write skill file
	const skillPath = path.join(skillDir, "SKILL.md");
	const skillExists = await fileExists(skillPath);

	if (!skillExists || options.overwrite) {
		await writeFile(skillPath, skillContent, "utf8");
	}

	return { skillPath };
}
