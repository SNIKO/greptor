import type { DocumentRef } from "./storage/types.js";

export interface Logger {
	debug?: (message: string, ...meta: unknown[]) => void;
	info?: (message: string, ...meta: unknown[]) => void;
	warn?: (message: string, ...meta: unknown[]) => void;
	error?: (message: string | Error, ...meta: unknown[]) => void;
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

export interface GreptorEatInput {
	content: string;
	format: SupportedFormat;
	label: string;
	source: string;
	publisher?: string;
	id?: string;
	creationDate?: Date;
	metadata?: Metadata;
	overwrite?: boolean;
}

export type GreptorEatResult =
	| { success: true; message: string; ref: DocumentRef }
	| { success: false; message: string };

export type CreateSkillResult =
	| { success: true; message: string; skillPath: string }
	| { success: false; message: string };
