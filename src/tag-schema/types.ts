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
		.nullable()
		.describe("Full list of enum values for enum types."),
});

export type TagSchemaItem = z.infer<typeof TagFieldSchema>;
export type TagSchema = TagSchemaItem[];
