import { z } from "zod";

export const MetadataFieldSchema = z.object({
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

export const ResponseSchema = z.object({
	metadata_fields: z
		.array(MetadataFieldSchema)
		.min(5)
		.max(10)
		.describe("List of metadata fields for the given topic"),
});
