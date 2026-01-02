import type { DocumentRef } from "./storage/types.js";

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
	metadataSchema?: MetadataSchema;
	logger?: Logger;
}

export type MetadataSchema = MetadataSchemaItem[];

export interface MetadataSchemaItem {
	name: string;
	type:
		| "string"
		| "string[]"
		| "number"
		| "number[]"
		| "enum"
		| "enum[]"
		| "date"
		| "boolean";
	description: string;
	enumValues?: string[];
}

export type SupportedFormat = "text";

export type MetadataValueType =
	| string
	| number
	| boolean
	| Date
	| string[]
	| number[]
	| boolean[];

export type Metadata = Record<string, MetadataValueType>;

export interface GreptorAddInput {
	content: string;
	format: SupportedFormat;
	label: string;
	source: string;
	author?: string;
	id?: string;
	creationDate?: Date;
	metadata?: Metadata;
	overwrite?: boolean;
}

export type GreptorAddResult =
	| { success: true; message: string; ref: DocumentRef }
	| { success: false; message: string };

export type CreateSkillResult =
	| { success: true; message: string; skillPath: string }
	| { success: false; message: string };
