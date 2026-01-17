import { intro, outro } from "@clack/prompts";
import { buildCommand } from "@stricli/core";

async function generateSkills(): Promise<void> {
	intro("greptor generate skills");
	// TODO: Implement skills generation
	outro("Not implemented yet");
}

export const skillsCommand = buildCommand({
	func: generateSkills,
	parameters: {
		flags: {},
		positional: { kind: "tuple", parameters: [] },
	},
	docs: {
		brief: "Generate skills file",
	},
});
