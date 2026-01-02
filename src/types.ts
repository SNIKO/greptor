export interface Logger {
	// biome-ignore lint/suspicious/noExplicitAny: Logger interface requires any
	debug?: (message: string, ...meta: any[]) => void;
	// biome-ignore lint/suspicious/noExplicitAny: Logger interface requires any
	info?: (message: string, ...meta: any[]) => void;
	// biome-ignore lint/suspicious/noExplicitAny: Logger interface requires any
	warn?: (message: string, ...meta: any[]) => void;
	// biome-ignore lint/suspicious/noExplicitAny: Logger interface requires any
	error?: (message: string | Error, ...meta: any[]) => void;
}

export interface GreptorOptions {
	baseDir: string;
	topic: string;
	llmModel: string;
	workers?: number;
	metadataSchema?: MetadataSchemaItem[];
	logger?: Logger;
}

export interface MetadataSchemaItem {
	name: string;
	type: "string" | "number" | "enum" | "date" | "boolean";
	description: string;
	enumValues?: string[];
}

// Backwards-compatible alias (typo in early versions).
export type MetadataSchmeaItem = MetadataSchemaItem;

export type SupportedFormat = "text";

export type MetadataValueType = string | number | boolean | Date;

export type Metadata = Record<string, MetadataValueType>;

export interface GreptorAddInput {
	content: string;
	format: SupportedFormat;
	label: string;
	id?: string;
	creationDate?: Date;
	metadata?: Metadata;
}

/**
 * Reference to a stored document under Greptor's data directory.
 * A relative path like `2025/12/2025-12-06-some-label.md`
 */
export type DocumentRef = string;

export type GreptorAddResult = {
	success: boolean;
	message: string;
	ref?: DocumentRef;
};

export type CreateSkillResult = {
	success: boolean;
	message: string;
	skillPath?: string;
};
