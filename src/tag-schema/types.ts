import { z } from "zod";

export const TagFieldSchema = z.object({
	name: z.string().describe("Tag field name in snake_case"),
	type: z
		.enum([
			"string",
			"string[]",
			"number",
			"number[]",
			"boolean",
			"enum",
			"enum[]",
			"date",
		])
		.describe("Field data type"),
	description: z.string().describe("Purpose and usage of this tag field"),
	enumValues: z
		.array(z.string())
		.optional()
		.nullable()
		.describe("Full list of enum values for enum types."),
});

export const ResponseSchema = z.object({
	tag_fields: z
		.array(TagFieldSchema)
		.min(5)
		.max(10)
		.describe("List of tag fields for the given topic"),
});
