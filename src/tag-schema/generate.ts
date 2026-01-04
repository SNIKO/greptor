import { type LanguageModel, Output, generateText } from "ai";
import type { TagSchema, TagSchemaItem } from "../types.js";
import { ResponseSchema } from "./types.js";

const PROMPT_TEMPLATE = (topic: string) => `
You are an expert information architect designing tag schemas that improve text search, discovery, and retrieval within a specific knowledge topic.
Your goal is to produce a list of 5-10 **tag fields** that are:
1. **Search-relevant** — users or AI agents are likely to query or filter text by these fields. 
2. **Domain-relevant** — reflect concepts, entities, and descriptors naturally present in this domain. 
3. **Extractable** — values can be identified directly from text (no scoring or inferred metrics like confidence, relevance, etc.). 
4. **Reusable** — should support both keyword search (grep/ripgrep) and structured filtering.

Allowed field types: string, string[], number, number[], boolean, enum, enum[], date.
Use array types when multiple values are expected per chunk.

**TOPIC**: ${topic}
`;

export async function generateTagSchema(
	topic: string,
	model: LanguageModel,
): Promise<TagSchema> {
	const { output } = await generateText({
		model,
		prompt: PROMPT_TEMPLATE(topic),
		output: Output.object({
			schema: ResponseSchema,
		}),
	});

	if (!output?.tag_fields) {
		throw new Error("Failed to parse tag schema from LLM response");
	}

	return output.tag_fields.map((field) => {
		const tagField: TagSchemaItem = {
			name: field.name,
			type: field.type,
			description: field.description,
		};

		if (Array.isArray(field.enumValues)) {
			tagField.enumValues = field.enumValues;
		}

		return tagField;
	});
}
