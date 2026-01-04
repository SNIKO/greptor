import { type LanguageModel, generateText } from "ai";

const createCleanPrompt = (text: string, domain: string) => `
Clean + structure the raw content into independent semantic chunks for domain: ${domain}

Remove completely (noise/boilerplate): ads/sponsors, greetings/intros/outros, CTAs/promos ("like & subscribe"), duplicates/filler, contact/social/discount codes, sign-offs ("reach out", "visit our website"), anything not primary informational content.

Preserve meaning exactly: no summarizing/paraphrasing. Keep all facts/numbers/names/dates, domain terminology, tables/lists, and URLs only if meaningful.

Normalize: canonicalize entity names; remove formatting garbage/repeated boilerplate; normalize whitespace/tabs/newlines.

Chunking: prefer fewer richer chunks. Target 100–200+ words per chunk where possible. Group related subtopics; split only when topics are truly distinct or context switches.

Output (English only), chunks separated by blank lines:
CHUNK c01: "Short Topic Title"
<cleaned content>

Rules: do not paraphrase, shorten meaning, add interpretation, or merge unrelated topics.

RAW CONTENT:
${text}
`;

export async function chunk(
	rawContent: string,
	domain: string,
	model: LanguageModel,
): Promise<string> {
	const prompt = createCleanPrompt(rawContent, domain);

	const { text } = await generateText({
		model,
		prompt,
	});

	if (!text) {
		throw new Error("Failed to clean content: empty LLM response");
	}

	return text;
}
