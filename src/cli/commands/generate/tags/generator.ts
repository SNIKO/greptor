import { type LanguageModel, generateText } from "ai";

const PROMPT_TEMPLATE = (topic: string) => `
# OBJECTIVES

You are an expert information architect designing tag schemas that improve text search, discovery, and retrieval within a specific knowledge topic.
Your goal is to produce a list of 5-10 **tag fields** that are:
1. **Search-relevant** — users or AI agents are likely to query or filter text by these fields. 
2. **Domain-relevant** — reflect concepts, entities, and descriptors naturally present in this domain. 
3. **Extractable** — values can be identified directly from text (no scoring or inferred metrics like confidence, relevance, etc.). 
4. **Reusable** — should support both keyword search (grep/ripgrep) and structured filtering.

## TOPIC 

${topic}

## OUTPUT

You must output a YAML object containing a "tags" list. Each item in the list must adhere to this schema:

- **name** (string): The tag field name in snake_case.
- **type** (string): One of the following values: "string", "string[]", "number", "number[]", "boolean", "enum", "enum[]", "date".
- **description** (string): Purpose and usage of this tag field.
- **enumValues** (string[] | null): Full list of allowed values if type is "enum" or "enum[]"; otherwise null.

### Format

Return ONLY valid YAML in the following format:

\`\`\`yaml
tags:
  - name: example_field
    type: string
    description: An example field
    enumValues: null
\`\`\`
`;

export async function generateTagSchema(
	topic: string,
	model: LanguageModel,
): Promise<string> {
	const { text } = await generateText({
		model,
		prompt: PROMPT_TEMPLATE(topic),
	});

	return text ?? "";
}
