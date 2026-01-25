import type { LanguageModel } from "ai";
import type { ModelConfig } from "../types.js";

const PROVIDER_EXPORTS: Record<string, string> = {
	"@ai-sdk/amazon-bedrock": "createAmazonBedrock",
	"@ai-sdk/anthropic": "createAnthropic",
	"@ai-sdk/azure": "createAzure",
	"@ai-sdk/cerebras": "createCerebras",
	"@ai-sdk/cohere": "createCohere",
	"@ai-sdk/deepinfra": "createDeepInfra",
	"@ai-sdk/google": "createGoogleGenerativeAI",
	"@ai-sdk/google-vertex": "createVertex",
	"@ai-sdk/groq": "createGroq",
	"@ai-sdk/mistral": "createMistral",
	"@ai-sdk/openai": "createOpenAI",
	"@ai-sdk/openai-compatible": "createOpenAICompatible",
	"@ai-sdk/perplexity": "createPerplexity",
	"@ai-sdk/togetherai": "createTogetherAI",
	"@ai-sdk/xai": "createXai",
	"@openrouter/ai-sdk-provider": "createOpenRouter",
};

/**
 * Resolves a LanguageModel from a configuration object.
 */
export async function resolveModel(
	config: ModelConfig,
): Promise<LanguageModel> {
	const { provider, model, options } = config;

	const exportName = PROVIDER_EXPORTS[provider];
	if (!exportName) {
		throw new Error(
			`Unknown or unsupported provider: ${provider}. Please ensure the package is installed.`,
		);
	}

	try {
		// Dynamic import of the provider package
		const mod = await import(provider);
		const factory = mod[exportName];

		if (typeof factory !== "function") {
			throw new Error(
				`Provider ${provider} does not export a factory function named ${exportName}.`,
			);
		}

		// Create the provider instance (e.g., const openai = createOpenAI({...}))
		const providerInstance = factory(options);

		// The provider instance is typically a function that takes the model ID
		// e.g. openai('gpt-4')
		if (typeof providerInstance !== "function") {
			throw new Error(
				`Provider factory for ${provider} did not return a valid provider function.`,
			);
		}

		return providerInstance(model);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("Cannot find module")
		) {
			throw new Error(
				`Failed to import provider ${provider}. Make sure it is installed in your project.\nrun: bun add ${provider}`,
			);
		}
		throw error;
	}
}
