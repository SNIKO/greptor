export interface Logger {
	// biome-ignore lint/suspicious/noExplicitAny: Logger interface requires any
	debug?: (...args: any[]) => void;
	// biome-ignore lint/suspicious/noExplicitAny: Logger interface requires any
	info?: (...args: any[]) => void;
	// biome-ignore lint/suspicious/noExplicitAny: Logger interface requires any
	warn?: (...args: any[]) => void;
	// biome-ignore lint/suspicious/noExplicitAny: Logger interface requires any
	error?: (...args: any[]) => void;
}

export interface GreptorOptions {
	baseDir: string;
	topic: string;
	llmModel: string;
	workers?: number;
	metadataSchema?: MetadataSchmeaItem[];
	/**
	 * If true and no schema exists on disk (and none provided), Greptor will call the LLM
	 * once to generate a starter metadata schema.
	 *
	 * Default: false (do not call LLM during initialization).
	 */
	autoGenerateMetadataSchema?: boolean;
	logger?: Logger;
}

export interface MetadataSchmeaItem {
	name: string;
	type: "string" | "number" | "enum" | "date" | "boolean";
	description: string;
	enumValues?: string[];
}

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
