import type { Dirent } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { FileStorage } from "../storage/file-storage.js";
import type { MetadataSchemaItem } from "../types.js";
import { fileExists } from "../utils/file.js";

export interface SkillGeneratorOptions {
	domain: string;
	sources: string[];
	baseDir: string;
	metadataSchema: MetadataSchemaItem[];
	overwrite: boolean;
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
	topN = 10,
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
function generateRgPattern(
	field: string,
	sampleValue: string,
	isArray: boolean,
): string {
	if (isArray) {
		// For array fields, search within YAML array syntax
		return `rg "${field}:\\s*\\[.*${sampleValue}.*\\]" processed`;
	}
	// For single-value fields, search for exact value
	return `rg "${field}:\\s*${sampleValue}" processed`;
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
	metadataSchema: MetadataSchemaItem[],
	fileStorage: FileStorage,
): string {
	const skillName = generateSkillName(sources);

	// Generate metadata list from schema
	const metadataList = metadataSchema
		.map((field) => {
			const typeSuffix =
				field.type.startsWith("enum") && field.enumValues
					? ` (values: ${field.enumValues.join(", ")})`
					: "";
			return `- \`${field.name}\` - *${field.type}*${typeSuffix}`;
		})
		.join("\n");

	// Generate ripgrep examples for first 3-4 fields, showing both array and single-value patterns
	const exampleFields = metadataSchema.slice(0, 4);
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

This skill provides guidance for efficient search over indexed content from ${sources.join(", ")} in the \`${domain}\` domain. It leverages grep-friendly metadata and chunked content storage to enable precise filtering and retrieval.

## About the Content

Content from ${sources.join(", ")} has been fetched, chunked, enriched with searchable metadata, and stored in the '${fileStorage.baseDir}' directory.

### Directory Structure

\`\`\`
${fileStorage.baseDir}/
├── processed/       # Cleaned, search-optimized content with metadata
│   └── {source}/    # ${sources.join(", ")}, etc.
│       └── {author?}/
│           └── YYYY-MM/
│               └── YYYY-MM-DD-label.md
└── raw/             # Original raw content as ingested (mirrors processed/)
\`\`\`

### File Format

Each processed file contains YAML frontmatter with document metadata and a \`chunks\` array. Each chunk includes:
- \`id\`: Unique chunk identifier (e.g., c01, c02)
- \`title\`: Chunk title
- Domain-specific metadata fields

Chunked content follows the frontmatter, with chunk IDs as section headers.

\`\`\`yaml
---
title: "Document Title"
source: "Source Name"
author: "Author Name"
<other metadata fields>
chunks:
  - id: c01
    title: "First Chunk Title"
    # Domain-specific metadata fields related to this chunk
  - id: c02
    title: "Second Chunk Title"
    # Domain-specific metadata fields related to this chunk
---

CHUNK c01: "First Chunk Title"
<chunk content here>

CHUNK c02: "Second Chunk Title"
<chunk content here>
\`\`\`

The YAML frontmatter serves as an index for the entire document.

### Key Metadata Fields

Below are the most common metadata fields with sample values. Additional metadata fields and values may exist beyond those listed here.

${metadataList}

## Recommended Search Strategy

0. **ALWAYS use rg (ripgrep)**:  
   Ripgrep is optimized for searching large codebases and text files quickly. It supports regex, file path patterns, and context capture.
   It MUST be your primary search tool for this content if installed.

1. **Constrain by time range first**  
   Use file path patterns (e.g., \`YYYY/MM/YYYY-MM-DD\`) to limit the search space before inspecting content.

2. **Apply metadata filters**  
   Use \`ripgrep\` to match specific YAML frontmatter fields. Note that metadata fields can be either:
   - **Single values**: Match with \`field: value\` (e.g., \`date: 2025-01-15\`)
   - **Arrays**: Match with \`field: [ value1, value2 ]\` or search within arrays using \`field:\\s*\\[.*value.*\\]\`
   
   Refer to the Key Metadata Fields section below to understand which fields are arrays vs single values.

3. **Leverage YAML frontmatter as a document index**  
   Treat frontmatter as a document summary. Read it first to understand:
   - Which chunks exist
   - What each chunk covers  
   This avoids unnecessary full-content reads.

4. **Identify relevant chunks**  
   From search results and frontmatter, collect IDs of chunks likely to contain relevant information.

5. **Enumerate candidate documents**  
   Before reading chunk content, broaden queries slightly (alternative wording, synonyms, metadata variations) to ensure all relevant documents and chunk IDs are discovered.

6. **Refine iteratively**  
   Adjust path patterns, metadata filters, and query terms based on findings until no new relevant documents or chunks appear.

7. **Read targeted content only**  
   Use collected chunk IDs to read only the necessary sections of each document.

## Ripgrep Search Examples

\`\`\`bash
# Find specific chunk content with context
rg "CHUNK c01:" -A 20 processed

# Search only ${exampleSource} content
rg "search query" processed/${exampleSource}

# Search ${exampleSource} content from December 2025
rg "search query" processed/${exampleSource} --glob "**/2025-12/*.md"

# Combine multiple metadata filters
rg -l "field1:.*value1" processed | xargs rg "field2:.*value2"

# List unique values for a metadata field
rg "field_name:" processed | sort | uniq -c | sort -rn | head -20

${rgExamples}
\`\`\`

## Important Guidelines

- **Primary source**: Always use the \`processed/\` directory for searches; only fall back to \`raw/\` if necessary
- **Metadata first**: Start with metadata filtering before full-text content search
- **Context capture**: Use \`-B\` and \`-A\` flags to capture surrounding lines for context without reading entire chunks
- **Citation style**: When referencing content, cite by source name, author, and title—never expose internal structure like chunk IDs or file paths to the user
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
		options.metadataSchema,
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
