import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import YAML from "yaml";
import type { LlmClient } from "../llm/llm-factory.js";
import type { Metadata } from "../types.js";

const createExtractMetadataPrompt = (
	text: string,
	domain: string,
	metadataSchema: string,
) => `
Extract per-chunk metadata for domain: ${domain}. Optimize for grep-based search/filtering.

Input format:
CHUNK c01: "Title"\n...\n\nCHUNK c02: "Title"\n...

Output: YAML ONLY (no fences/comments). YAML list like:
- id: c01
	title: "Title"
	key1: value
	key2: [v1, v2]

Value formats: strings snake_case (except title); numbers put unit in key (price_aud: 1250000); percentages use _percent; dates ISO-8601; ranges as [min, max]; arrays MUST be single-line YAML (e.g., [a, b]).

Rules: extract each chunk separately; do not output null/empty fields; for enum fields, only use values from schema; include additional useful numeric/date metrics for grep filtering.

SCHEMA:
${metadataSchema}

INPUT:
${text}
`;

export async function extractMetadata(
	chunkedContent: string,
	domain: string,
	metadataSchema: string,
	llm: LlmClient,
): Promise<Metadata[]> {
	const prompt = createExtractMetadataPrompt(
		chunkedContent,
		domain,
		metadataSchema,
	);
	const messages: ChatCompletionMessageParam[] = [
		{ role: "user", content: prompt },
	];

	const completion = await llm.client.chat.completions.parse({
		model: llm.model,
		messages,
	});

	const content = completion.choices[0].message.content;
	if (!content) {
		throw new Error("Failed to extract metadata: empty LLM response");
	}

	return YAML.parse(content) as Metadata[];
}
