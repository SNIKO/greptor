import { intro, outro } from "@clack/prompts";
import { buildCommand } from "@stricli/core";

async function generateTags(): Promise<void> {
	intro("greptor generate tags");
	// TODO: Implement tag generation
	outro("Not implemented yet");
}

export const tagsCommand = buildCommand({
	func: generateTags,
	parameters: {
		flags: {},
		positional: { kind: "tuple", parameters: [] },
	},
	docs: {
		brief: "Generate tags for content",
	},
});
