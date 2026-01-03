import OpenAI from "openai";

export type LlmClient = {
	client: OpenAI;
	model: string;
};

function parseProviderModel(providerModel: string): {
	provider: string;
	model: string;
} {
	if (!providerModel.includes(":")) {
		return { provider: "openai", model: providerModel.trim() };
	}

	const colonIndex = providerModel.indexOf(":");
	const rawProvider = providerModel.substring(0, colonIndex);
	const rawModel = providerModel.substring(colonIndex + 1);

	if (!rawProvider || !rawModel) {
		throw new Error(
			`Invalid provider:model format: ${providerModel}. Expected format: "provider:model"`,
		);
	}

	const provider = rawProvider.trim().toLowerCase();
	const model = rawModel.trim();

	if (!provider || !model) {
		throw new Error(
			`Invalid provider:model format: ${providerModel}. Both provider and model must be non-empty`,
		);
	}

	return { provider, model };
}

function getProviderConfig(provider: string): {
	apiKey: string;
	apiUrl?: string;
} {
	const normalizedProvider = provider.toLowerCase();
	switch (normalizedProvider) {
		case "openai":
			if (!process.env.OPENAI_API_KEY) {
				throw new Error("OPENAI_API_KEY environment variable is not set.");
			}
			return { apiKey: process.env.OPENAI_API_KEY };
		case "azure":
			if (!process.env.AZURE_API_KEY || !process.env.AZURE_API_BASE_URL) {
				throw new Error(
					"AZURE_API_KEY or AZURE_API_BASE_URL environment variable is not set.",
				);
			}
			return {
				apiKey: process.env.AZURE_API_KEY,
				apiUrl: process.env.AZURE_API_BASE_URL,
			};
		case "ollama":
			return {
				apiKey: "ollama",
				apiUrl: "http://localhost:11434/v1",
			};
		default:
			throw new Error(`Unsupported provider: ${provider}`);
	}
}

export function createLlmClient(providerModel: string): LlmClient {
	const { provider, model } = parseProviderModel(providerModel);
	const { apiKey, apiUrl } = getProviderConfig(provider);
	const client = new OpenAI({
		apiKey,
		baseURL: apiUrl,
	});

	return { client, model };
}
