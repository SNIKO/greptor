import type { TagSchema } from "./config.js";
import type { DocumentRef } from "./storage/types.js";

type SourceName = string;
type SourceCountEntry = { fetched: number; processed: number };
export type SourceCounts = Record<SourceName, SourceCountEntry>;

/** Event data for when document processing starts */
export interface DocumentProcessingStartedEvent {
	source: SourceName;
	publisher?: string | undefined;
	label: string;
	documentsCount: SourceCounts;
}

/** Event data for when document processing completes */
export type DocumentProcessingCompletedEvent =
	| {
			success: true;
			source: SourceName;
			publisher?: string | undefined;
			label: string;
			documentsCount: SourceCounts;
			elapsedMs: number;
			inputTokens: number;
			outputTokens: number;
			totalTokens: number;
	  }
	| {
			success: false;
			error: string;
			source: SourceName;
			publisher?: string | undefined;
			label: string;
	  };

/** Optional hooks for Greptor events */
export interface GreptorHooks {
	onDocumentProcessingStarted?: (event: DocumentProcessingStartedEvent) => void;
	onDocumentProcessingCompleted?: (
		event: DocumentProcessingCompletedEvent,
	) => void;
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
	basePath: string;
	topic: string;
	model: ModelConfig;
	workers?: number;
	tagSchema: TagSchema;
	hooks?: GreptorHooks;
	customProcessingPrompts?: Record<string, string>;
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
