import { z } from "zod";
import type { DocumentRef } from "./storage/types.js";

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

/** Event data for when a processing run starts */
export interface ProcessingRunStartedEvent {
	documentsToProcess: number;
	totalDocuments: number;
}

/** Event data for when a processing run completes */
export interface ProcessingRunCompletedEvent {
	successful: number;
	failed: number;
	elapsedMs: number;
}

/** Event data for when document processing starts */
export interface DocumentProcessingStartedEvent {
	source: string;
	publisher?: string | undefined;
	label: string;
	successful: number;
	failed: number;
	queueSize: number;
}

/** Event data for when document processing completes */
export interface DocumentProcessingCompletedEvent {
	success: boolean;
	source: string;
	publisher?: string | undefined;
	label: string;
	successful: number;
	failed: number;
	queueSize: number;
	elapsedMs: number;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}

/** Event data for errors */
export interface ErrorEvent {
	error: Error;
	context?: {
		source?: string | undefined;
		publisher?: string | undefined;
		label?: string | undefined;
		ref?: DocumentRef | undefined;
	};
}

/** Optional hooks for Greptor events */
export interface GreptorHooks {
	onProcessingRunStarted?: (event: ProcessingRunStartedEvent) => void;
	onProcessingRunCompleted?: (event: ProcessingRunCompletedEvent) => void;
	onDocumentProcessingStarted?: (event: DocumentProcessingStartedEvent) => void;
	onDocumentProcessingCompleted?: (
		event: DocumentProcessingCompletedEvent,
	) => void;
	onError?: (event: ErrorEvent) => void;
}

export interface ModelConfig {
	/**
	 * The name of the AI SDK provider fro [AI SDK ecosystem](https://sdk.vercel.ai/providers/ai-sdk-providers):
   - `@ai-sdk/openai` - OpenAI (GPT-4, GPT-4o, etc.)
   - `@ai-sdk/anthropic` - Anthropic (Claude)
   - `@ai-sdk/groq` - Groq (fast inference)
   - `@ai-sdk/openai-compatible` - OpenAI-compatible endpoints (NVIDIA NIM, OpenRouter, etc.)
   - And [many more](https://sdk.vercel.ai/providers/ai-sdk-providers)...
	 */
	provider: string;

	/**
	 * The model ID to use (specific to the provider).
	 */
	model: string;

	/**
	 * Configuration options passed to the provider factory function.
	 * Examples: apiKey, baseURL, etc.
	 */
	options?: Record<string, unknown>;
}

export interface GreptorOptions {
	baseDir: string;
	topic: string;
	model: ModelConfig;
	workers?: number;
	tagSchema?: TagSchema;
	hooks?: GreptorHooks;
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
