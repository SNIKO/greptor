export * from "./types.js";
export type {
	GreptorHooks,
	ProcessingRunStartedEvent,
	ProcessingRunCompletedEvent,
	DocumentProcessingStartedEvent,
	DocumentProcessingCompletedEvent,
	ErrorEvent,
} from "./types.js";

export * from "./config.js";
export type { Greptor } from "./greptor.js";
export { createGreptor } from "./greptor.js";

// Re-export LanguageModel type from AI SDK for convenience
export type { LanguageModel } from "ai";
