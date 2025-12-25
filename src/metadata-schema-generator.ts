import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { z } from "zod";
import { createLlmClient } from "./llm/llm-factory.js";
import type { MetadataSchmeaItem } from "./types.js";

const PROMPT_TEMPLATE = (topic: string) => `
You are an expert information architect designing metadata schemas that improve text search, discovery, and retrieval within a specific knowledge topic. 
Your goal is to produce a list of 5-10 **metadata fields** that are: 
1. **Search-relevant** — users or AI agents are likely to query or filter text by these fields. 
2. **Domain-relevant** — reflect concepts, entities, and descriptors naturally present in this domain. 
3. **Extractable** — values can be identified directly from text (no scoring or inferred metrics like confidence, relevance, etc.). 
4. **Reusable** — should support both keyword search (grep/ripgrep) and structured filtering.

**TOPIC**: ${topic}
`;

const MetadataFieldSchema = z.object({
	name: z.string().describe("Metadata field name in snake_case"),
	type: z
		.enum(["string", "number", "boolean", "enum", "date"])
		.describe("Field data type"),
	description: z.string().describe("Purpose and usage of this metadata field"),
	enumValues: z
		.array(z.string())
		.optional()
		.nullable()
		.describe("Full list of enum values for enum types."),
});

const ResponseSchema = z.object({
	metadata_fields: z
		.array(MetadataFieldSchema)
		.min(5)
		.max(10)
		.describe("List of metadata fields for the given topic"),
});

export async function generateMetadataSchema(
	topic: string,
	llmModel: string,
): Promise<MetadataSchmeaItem[]> {
	const { client, model } = createLlmClient(llmModel);

	const messages: ChatCompletionMessageParam[] = [
		{ role: "user", content: PROMPT_TEMPLATE(topic) },
	];

	const completion = await client.chat.completions.parse({
		model,
		messages,
		response_format: zodResponseFormat(ResponseSchema, "metadata_fields"),
	});

	const parsed = completion.choices[0].message.parsed;
	if (!parsed?.metadata_fields) {
		throw new Error("Failed to parse metadata schema from LLM response");
	}

	return parsed.metadata_fields.map((field) => {
		const metadataField: MetadataSchmeaItem = {
			name: field.name,
			type: field.type,
			description: field.description,
		};

		if (Array.isArray(field.enumValues)) {
			metadataField.enumValues = field.enumValues;
		}

		return metadataField;
	});
}
