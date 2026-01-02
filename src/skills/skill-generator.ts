import type { Dirent } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { FileStorage } from "../storage/file-storage.js";

export interface SkillGeneratorOptions {
	domain: string;
	sources: string[];
	baseDir: string;
}

interface ChunkMetadata {
	id: string;
	[key: string]: unknown;
}

interface YamlMetadata {
	chunks?: ChunkMetadata[];
	[key: string]: unknown;
}

interface MetadataStats {
	field: string;
	count: number;
	sampleValues: string[];
}

/**
 * Walk a directory tree and collect all .md files
 */
async function collectMarkdownFiles(
	fileStorage: FileStorage,
): Promise<string[]> {
	const results: string[] = [];

	const walk = async (currentDir: string): Promise<void> => {
		let entries: Dirent[];
		try {
			entries = await readdir(currentDir, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				results.push(fullPath);
			}
		}
	};

	await walk(fileStorage.processedContentPath);
	return results;
}

/**
 * Parse YAML frontmatter from a markdown file
 */
function parseYamlFrontmatter(content: string): YamlMetadata | null {
	if (!content.startsWith("---\n")) {
		return null;
	}

	const endIndex = content.indexOf("\n---", 4);
	if (endIndex === -1) {
		return null;
	}

	const yamlContent = content.slice(4, endIndex);
	try {
		return YAML.parse(yamlContent) as YamlMetadata;
	} catch {
		return null;
	}
}

async function getTopMetadataFields(
	fileStorage: FileStorage,
	topN = 20,
	topValuesPerField = 10,
): Promise<MetadataStats[]> {
	const files = await collectMarkdownFiles(fileStorage);
	const fieldCounts = new Map<
		string,
		{ count: number; values: Map<string, number> }
	>();

	// Reserved/structural fields to exclude from top metadata
	const reservedFields = new Set([
		"title",
		"label",
		"created_at",
		"chunks",
		"id",
	]);

	for (const filePath of files) {
		try {
			const content = await readFile(filePath, "utf8");
			const metadata = parseYamlFrontmatter(content);

			if (!metadata) {
				continue;
			}

			if (metadata.chunks && Array.isArray(metadata.chunks)) {
				for (const chunk of metadata.chunks) {
					for (const [key, value] of Object.entries(chunk)) {
						if (reservedFields.has(key)) {
							continue;
						}

						let stats = fieldCounts.get(key);
						if (!stats) {
							stats = { count: 0, values: new Map<string, number>() };
							fieldCounts.set(key, stats);
						}

						stats.count++;

						const values = Array.isArray(value) ? value : [String(value)];

						for (const val of values) {
							const currentCount = stats.values.get(val) || 0;
							stats.values.set(val, currentCount + 1);
						}
					}
				}
			}
		} catch {
			// Skip files that can't be read
		}
	}

	const topMetadataFields: MetadataStats[] = Array.from(fieldCounts.entries())
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, topN)
		.map(([field, data]) => ({
			field,
			count: data.count,
			sampleValues: Array.from(data.values.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, topValuesPerField)
				.map(([val]) => val),
		}));

	return topMetadataFields;
}

/**
 * Generate ripgrep example patterns for a metadata field
 */
function generateRgPattern(field: string, sampleValue?: string): string {
	const value = sampleValue || "VALUE";
	// Handle array-style fields
	if (sampleValue?.includes(",") || field.endsWith("s")) {
		return `rg "${field}:\\s*\\[.*${value.split(",")[0].trim()}.*\\]" processed`;
	}
	return `rg "${field}:\\s*${value}" processed`;
}

function generateSkillName(sources: string[], maxLength = 20): string {
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
 * Generate the skill content from a template
 */
function generateSkillContent(
	domain: string,
	sources: string[],
	metadata: MetadataStats[],
	fileStorage: FileStorage,
): string {
	const skillName = generateSkillName(sources);
	const metadataList = metadata
		.map((m) => {
			const values = `${m.sampleValues.join(", ")}`;
			return `- \`${m.field}\` (${values}, ...)`;
		})
		.join("\n");

	// Generate ripgrep examples for top 3 fields (concise)
	const rgExamples = metadata
		.slice(0, 3)
		.map((m) => {
			const example = generateRgPattern(m.field, m.sampleValues[0]);
			return `# By ${m.field}\n${example}`;
		})
		.join("\n\n");

	return `---
name: ${skillName}
description: Search and analyze ${sources.join(", ")} indexed content in the '${domain}' domain. Use this skill when the user's query requires context and knowledge from ${sources.join(", ")} sources within the \`${domain}\` domain for answering questions or conducting research.
---

# Content Overview

Content from ${sources.join(", ")} sources has been fetched, chunked, enriched with grep-friendly metadata, and stored in the '${fileStorage.baseDir}' directory.

## Directory Structure

Original raw content:
\`\`\`
${fileStorage.rawContentPath}/YYYY/MM/YYYY-MM-DD-label-id.md
\`\`\`

Processed chunked content optimized for grep search:
\`\`\`
${fileStorage.processedContentPath}/YYYY/MM/YYYY-MM-DD-label-id.md
\`\`\`

## File Format

Each processed file contains YAML frontmatter with general metadata and a \`chunks\` array. Each chunk includes:
- \`id\`: Unique chunk identifier (e.g., c01, c02)
- \`title\`: Chunk title
- Domain-specific metadata fields

The chunked content follows the frontmatter, with chunk IDs for reference.

\`\`\`yaml
---
title: "Document Title"
source: "Source Name"
chunks:
  - id: c01
    title: "First Chunk Title"
    # Domain-specific metadata fields
  - id: c02
    title: "Second Chunk Title"
    # Domain-specific metadata fields
---

CHUNK c01: "First Chunk Title"
<chunk content here>

CHUNK c02: "Second Chunk Title"
<chunk content here>
\`\`\`

## Key Metadata Fields

Below are the most common metadata fields with sample values. Additional metadata fields and values may exist beyond those listed here.

${metadataList}

## Recommended Search Strategy

1. **Filter by time frame**: Use file path patterns to match date ranges (e.g., \`processed/YYYY/MM/\`)
2. **Filter by metadata**: Use ripgrep to search for specific metadata field values
3. **Identify relevant chunks**: Note chunk IDs from search results
4. **Read targeted content**: Use chunk IDs to read only relevant sections
5. **Iterate as needed**: Refine searches based on initial results

## Ripgrep Search Examples

\`\`\`bash
${rgExamples}

# Find specific chunk content (with context)
rg "CHUNK c01:" -A 20 processed

# Combine multiple metadata filters
rg -l "field1:.*value1" processed | xargs rg "field2:.*value2"

# Time-scoped content search
rg "search query" processed/2025/12/

# List unique values for a metadata field
rg "field_name:" processed | sort | uniq -c | sort -rn | head -20
\`\`\`

## Important Guidelines

- **Primary source**: Use the \`processed/\` layer for searches; fall back to \`raw/\` only if necessary
- **Metadata first**: Start with metadata filtering; fall back to full-text content search if needed
- **Context capture**: When filtering by metadata, use \`-B\` and \`-A\` flags to capture surrounding lines for better understanding without reading entire chunks
- **File structure**: Each file may contain up to 10 chunks with 10+ metadata entries each, resulting in YAML frontmatter up to 100 lines
- **Citation style**: When referencing content, cite by source name, author, title, and other content metadata—never expose internal structure like chunk IDs or file paths to the user
`;
}

/**
 * Generate a Claude Code skill file for searching indexed data
 */
export async function generateSkill(
	options: SkillGeneratorOptions,
	fileStorage: FileStorage,
): Promise<{ skillPath: string }> {
	const metadata = await getTopMetadataFields(fileStorage);

	const skillName = generateSkillName(options.sources, 10);
	const skillContent = generateSkillContent(
		options.domain,
		options.sources,
		metadata,
		fileStorage,
	);

	// Create skill directory
	const skillDir = path.join(options.baseDir, ".claude", "skills", skillName);
	await mkdir(skillDir, { recursive: true });

	// Write skill file
	const skillPath = path.join(skillDir, "SKILL.md");
	await writeFile(skillPath, skillContent, "utf8");

	return { skillPath };
}
