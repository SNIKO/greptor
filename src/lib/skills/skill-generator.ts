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

	// Take first N enum fields, fill remainder with non-enum fields
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
 * Generate the skill content from a template.
 */
function generateSkillContent(
	domain: string,
	sources: string[],
	tagSchema: TagSchemaItem[],
	fileStorage: FileStorage,
): string {
	const skillName = generateSkillName(sources);
	const sourcesDisplay = sources.join(", ");
	const exampleSource = sanitizePathSegment(sources[0] ?? "source");

	// Calculate relative paths from current directory
	const relativeBaseDir =
		path.relative(process.cwd(), fileStorage.baseDir) || ".";
	const processedPath = path.relative(
		process.cwd(),
		fileStorage.processedContentPath,
	);
	const rawPath = path.relative(process.cwd(), fileStorage.rawContentPath);

	// Infer subdirectory names (last segment of the path)
	const processedDirName = path.basename(fileStorage.processedContentPath);
	const rawDirName = path.basename(fileStorage.rawContentPath);

	// Select example fields for dynamic examples
	const exampleFields = selectExampleFields(tagSchema, 4);
	const field1 = exampleFields[0];
	const field2 = exampleFields[1];
	const field3 = exampleFields[2];
	const field4 = exampleFields[3];

	// Generate sample values
	const val1 = field1 ? getSampleValue(field1, 0) : "value1";
	const val2 = field2 ? getSampleValue(field2, 0) : "value2";
	const val3 = field3 ? getSampleValue(field3, 0) : "value3";
	const val4 = field4 ? getSampleValue(field4, 0) : "value4";

	const fieldName1 = field1?.name ?? "field1";
	const fieldName2 = field2?.name ?? "field2";
	const fieldName3 = field3?.name ?? "field3";
	const fieldName4 = field4?.name ?? "field4";

	// Generate tag reference list from schema
	const tagReferenceList = tagSchema
		.map((field) => {
			const typeDisplay = field.type;
			const enumSuffix =
				field.enumValues && field.enumValues.length > 0
					? ` — values: \`${field.enumValues.join("`, `")}\``
					: "";
			return `- \`${field.name}\` (*${typeDisplay}*)${enumSuffix}`;
		})
		.join("\n");

	return `---
name: ${skillName}
description: Search and analyze indexed content from ${sourcesDisplay} in the "${domain}" domain. Use this skill when you need information from ${sourcesDisplay} sources to answer questions or conduct research.
---

# Skill Overview

This skill enables efficient search across indexed content from **${sourcesDisplay}** in the \`${domain}\` domain.

The content is optimized for **ripgrep-based retrieval** using:

- Document-level metadata in YAML frontmatter
- Chunk-level inline tags for granular filtering
- Small, localized context windows for precise extraction

---

## Content Model

All content from ${sourcesDisplay} is processed through this pipeline:

1. **Ingested** — Raw content is captured and stored.
2. **Chunked** — Content is split into semantic chunks (paragraphs, sections).
3. **Enriched** — Each chunk is tagged with structured metadata.
4. **Stored** — Final output is written as grep-friendly Markdown files.

---

## Directory Structure

\`\`\`text
${relativeBaseDir}/
├── ${processedDirName}/          # Search-optimized content with tags
│   └── {source}/                 # e.g., ${exampleSource}
│       └── {publisher}/          # Optional publisher subdirectory
│           └── YYYY-MM/
│               └── YYYY-MM-DD-label.md
└── ${rawDirName}/                # Original content (mirrors ${processedDirName}/)
\`\`\`

**Important:** Always search \`${processedPath}/\` first. Only consult \`${rawPath}/\` if you need the exact original wording or if processed content is insufficient.

---

## File Format

Each processed file consists of:

1. **YAML frontmatter** — Document-level metadata (title, source, publisher, date).
2. **Chunked content** — Each chunk has:
   - A numbered heading (e.g., \`## 01 Chunk Title\`)
   - Inline tag lines (key=value format)
   - Paragraph content

**Example structure:**

\`\`\`markdown
---
title: "Example Document Title"
source: "${exampleSource}"
publisher: "Publisher Name"
created_at: 2025-12-15T10:00:00Z
---

## 01 First Chunk Title
${fieldName1}=${val1}
${fieldName2}=${val2}

This is the content of the first chunk. It contains the relevant
information extracted from the source material.

## 02 Second Chunk Title
${fieldName3}=${val3}
${fieldName4}=${val4}

Content of the second chunk continues here with additional details.
\`\`\`

---

## Tag Format

- **Location:** Tag lines appear directly below each chunk heading.
- **Syntax:** \`field_name=value\` (no spaces around \`=\`).
- **Arrays:** Comma-separated with no spaces: \`field=val1,val2,val3\`.
- **Coverage:** Each chunk contains only the tags relevant to its content; expect approximately half of all possible tags per chunk.

---

## Available Tag Fields

Use only the following tag fields. Do not invent new tag names.

${tagReferenceList}

---

## Search Strategy

### Step 0: Always Use ripgrep

\`rg\` is the **required** tool for searching this content. Avoid generic full-text scans unless tag-based filtering fails completely.

### Step 1: Constrain by Path

Narrow the search space using file paths before applying content filters:

\`\`\`bash
# Search within a specific source
rg "query" ${processedPath}/${exampleSource}/

# Search within a specific month
rg "query" ${processedPath}/ --glob "**/2025-12/*.md"

# Combine source and date constraints
rg "query" ${processedPath}/${exampleSource}/ --glob "**/2025-12/*.md"
\`\`\`

### Step 2: Filter by Tags

Search tag lines to locate relevant chunks. Always include context (\`-C 6\`) to capture the full tag block and surrounding content.

**Simple exact match:**

\`\`\`bash
rg -n -C 6 "${fieldName1}=${val1}" ${processedPath}/
\`\`\`

**Array field (partial match):**

\`\`\`bash
rg -n -C 6 "${fieldName1}=.*${val1}" ${processedPath}/
\`\`\`

### Step 3: Combine Filters

Use piped commands to intersect multiple criteria:

\`\`\`bash
# Find chunks matching two tags
rg -l "${fieldName1}=${val1}" ${processedPath}/ | xargs rg -n -C 6 "${fieldName2}=${val2}"

# Alternative: pipe grep output
rg -n -C 6 "${fieldName1}=${val1}" ${processedPath}/ | rg "${fieldName2}"
\`\`\`

### Step 4: Inspect Matched Chunks

Once you identify a relevant chunk:

1. Read the chunk content (paragraphs below the tags).
2. Read the file's YAML frontmatter (first ~10 lines) for document-level context.
3. Avoid reading entire files or jumping between chunks without justification.

---

## Ripgrep Examples

### Basic Examples

\`\`\`bash
# Simple tag search with context
rg -n -C 6 "${fieldName1}=${val1}" ${processedPath}/

# Search for any value in a tag field
rg -n -C 6 "${fieldName2}=" ${processedPath}/

# Case-insensitive search
rg -i -n -C 6 "${val3}" ${processedPath}/

# Search within a specific source directory
rg -n -C 6 "${fieldName3}=${val3}" ${processedPath}/${exampleSource}/
\`\`\`

### Filtered by Date

\`\`\`bash
# Content from December 2025
rg -n -C 6 "${fieldName1}=${val1}" ${processedPath}/ --glob "**/2025-12/*.md"

# Content from Q4 2025
rg -n -C 6 "${fieldName2}=${val2}" ${processedPath}/ --glob "**/2025-1[0-2]/*.md"
\`\`\`

### Combined Tag Filters

\`\`\`bash
# Match chunks with two specific tags (using file list)
rg -l "${fieldName1}=${val1}" ${processedPath}/ | xargs rg -n -C 6 "${fieldName2}=${val2}"

# Pipeline filter for complex queries
rg -n -C 6 "${fieldName1}=${val1}" ${processedPath}/ | rg "${fieldName3}=.*${val3}"
\`\`\`

### Discovery and Exploration

\`\`\`bash
# List all unique values for a tag field
rg -o "${fieldName1}=[^\n]+" ${processedPath}/ | cut -d= -f2 | tr ',' '\n' | sort -u

# Count occurrences of each value
rg -o "${fieldName2}=[^\n]+" ${processedPath}/ | cut -d= -f2 | sort | uniq -c | sort -rn | head -20

# Find all files containing a specific tag
rg -l "${fieldName4}=${val4}" ${processedPath}/
\`\`\`

### Full-Text Search (Fallback)

\`\`\`bash
# Search body content when tags don't match
rg -n -C 3 "keyword phrase" ${processedPath}/

# Regex pattern search
rg -n -C 3 "\\b(term1|term2|term3)\\b" ${processedPath}/
\`\`\`

---

## Handling No Results

Not all tags are present or accurate in every chunk. If no matches are found:

1. **Widen the time range** — Remove or expand date glob patterns.
2. **Try alternative values** — Use different spellings, synonyms, or related terms.
3. **Check for partial matches** — Use \`=.*value\` pattern for array fields.
4. **Fall back to full-text search** — Search body content directly.
5. **Explore available values** — Use the discovery commands above to see what tags exist.

---

## Output Guidelines

When presenting information to users:

- **Cite sources** by document title, source, and publisher.
- **Summarize faithfully** — Do not extrapolate beyond the evidence.
- **Never expose** internal file paths, IDs, or implementation details.
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
