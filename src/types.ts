import type { LanguageModel } from "ai";
import type { DocumentRef } from "./storage/types.js";
import type { TagSchema } from "./tag-schema/types.js";
export type {
	TagSchema,
	TagSchemaItem,
} from "./tag-schema/types.js";

export interface Logger {
	debug?: (message: string, ...meta: unknown[]) => void;
	info?: (message: string, ...meta: unknown[]) => void;
	warn?: (message: string, ...meta: unknown[]) => void;
	error?: (message: string | Error, ...meta: unknown[]) => void;
}

export interface GreptorOptions {
	baseDir: string;
	topic: string;
	model: LanguageModel;
	workers?: number;
	tagSchema?: TagSchema;
	logger?: Logger;
}

export type SupportedFormat = "text";

export type TagValueType =
	| string
	| number
	| boolean
	| Date
	| string[]
	| number[]
	| boolean[];

export type Tags = Record<string, TagValueType>;

export interface GreptorEatInput {
	content: string;
	format: SupportedFormat;
	label: string;
	source: string;
	publisher?: string;
	id?: string;
	creationDate?: Date;
	tags?: Tags;
	overwrite?: boolean;
}

export type GreptorEatResult =
	| { success: true; message: string; ref: DocumentRef }
	| { success: false; message: string };

export type CreateSkillResult =
	| { success: true; message: string; skillPath: string }
	| { success: false; message: string };
