export interface SkillTemplateField {
	name: string;
	value: string;
}

export interface SkillTemplateData {
	frontmatter: string;
	sourcesDisplay: string;
	domain: string;
	processedPath: string;
	rawPath: string;
	exampleSource: string;
	exampleFields: readonly SkillTemplateField[];
	tagReferenceList: string;
}

export function renderSkillTemplate(data: SkillTemplateData): string {
	const [field1, field2, field3, field4] = data.exampleFields;

	const fieldName1 = field1?.name ?? "field1";
	const fieldName2 = field2?.name ?? "field2";
	const fieldName3 = field3?.name ?? "field3";
	const fieldName4 = field4?.name ?? "field4";

	const val1 = field1?.value ?? "value1";
	const val2 = field2?.value ?? "value2";
	const val3 = field3?.value ?? "value3";
	const val4 = field4?.value ?? "value4";

	return `${data.frontmatter}

# Skill Overview

This skill enables efficient search across indexed content from **${data.sourcesDisplay}** in the \`${data.domain}\` domain.

The content is optimized for **ripgrep-based retrieval** using:

- Document-level metadata in YAML frontmatter
- Chunk-level inline tags for granular filtering
- Small, localized context windows for precise extraction

---

## Content Model

All content from ${data.sourcesDisplay} is processed through this pipeline:

1. **Ingested** — Raw content is captured and stored.
2. **Chunked** — Content is split into semantic chunks (paragraphs, sections).
3. **Enriched** — Each chunk is tagged with structured metadata.
4. **Stored** — Final output is written as grep-friendly Markdown files.

---

## Directory Structure

\`\`\`text
├── ${data.processedPath}/          # Search-optimized content with tags
│   └── {source}/                 # e.g., ${data.exampleSource}
│       └── {publisher}/          # Optional publisher subdirectory
│           └── YYYY-MM/
│               └── YYYY-MM-DD-label.md
└── ${data.rawPath}/                # Original content (mirrors ${data.processedPath}/)
\`\`\`

**Important:** Always search \`${data.processedPath}/\` first. Only consult \`${data.rawPath}/\` if you need the exact original wording or if processed content is insufficient.

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
source: "${data.exampleSource}"
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

${data.tagReferenceList}

---

## Search Strategy

### Step 0: Always Use ripgrep

\`rg\` is the **required** tool for searching this content. Avoid generic full-text scans unless tag-based filtering fails completely.

### Step 1: Constrain by Path

Narrow the search space using file paths before applying content filters:

\`\`\`bash
# Search within a specific source
rg "query" ${data.processedPath}/${data.exampleSource}/

# Search within a specific month
rg "query" ${data.processedPath}/ --glob "**/2025-12/*.md"

# Combine source and date constraints
rg "query" ${data.processedPath}/${data.exampleSource}/ --glob "**/2025-12/*.md"
\`\`\`

### Step 2: Filter by Tags

Search tag lines to locate relevant chunks. Always include context (\`-C 6\`) to capture the full tag block and surrounding content.

**Simple exact match:**

\`\`\`bash
rg -n -C 6 "${fieldName1}=${val1}" ${data.processedPath}/
\`\`\`

**Array field (partial match):**

\`\`\`bash
rg -n -C 6 "${fieldName1}=.*${val1}" ${data.processedPath}/
\`\`\`

### Step 3: Combine Filters

Use piped commands to intersect multiple criteria:

\`\`\`bash
# Find chunks matching two tags
rg -l "${fieldName1}=${val1}" ${data.processedPath}/ | xargs rg -n -C 6 "${fieldName2}=${val2}"

# Alternative: pipe grep output
rg -n -C 6 "${fieldName1}=${val1}" ${data.processedPath}/ | rg "${fieldName2}"
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
rg -n -C 6 "${fieldName1}=${val1}" ${data.processedPath}/

# Search for any value in a tag field
rg -n -C 6 "${fieldName2}=" ${data.processedPath}/

# Case-insensitive search
rg -i -n -C 6 "${val3}" ${data.processedPath}/

# Search within a specific source directory
rg -n -C 6 "${fieldName3}=${val3}" ${data.processedPath}/${data.exampleSource}/
\`\`\`

### Filtered by Date

\`\`\`bash
# Content from December 2025
rg -n -C 6 "${fieldName1}=${val1}" ${data.processedPath}/ --glob "**/2025-12/*.md"

# Content from Q4 2025
rg -n -C 6 "${fieldName2}=${val2}" ${data.processedPath}/ --glob "**/2025-1[0-2]/*.md"
\`\`\`

### Combined Tag Filters

\`\`\`bash
# Match chunks with two specific tags (using file list)
rg -l "${fieldName1}=${val1}" ${data.processedPath}/ | xargs rg -n -C 6 "${fieldName2}=${val2}"

# Pipeline filter for complex queries
rg -n -C 6 "${fieldName1}=${val1}" ${data.processedPath}/ | rg "${fieldName3}=.*${val3}"
\`\`\`

### Discovery and Exploration

\`\`\`bash
# List all unique values for a tag field
rg -o "${fieldName1}=[^\n]+" ${data.processedPath}/ | cut -d= -f2 | tr ',' '\n' | sort -u

# Count occurrences of each value
rg -o "${fieldName2}=[^\n]+" ${data.processedPath}/ | cut -d= -f2 | sort | uniq -c | sort -rn | head -20

# Find all files containing a specific tag
rg -l "${fieldName4}=${val4}" ${data.processedPath}/
\`\`\`

### Full-Text Search (Fallback)

\`\`\`bash
# Search body content when tags don't match
rg -n -C 3 "keyword phrase" ${data.processedPath}/

# Regex pattern search
rg -n -C 3 "\\b(term1|term2|term3)\\b" ${data.processedPath}/
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
