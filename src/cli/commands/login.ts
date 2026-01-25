import {
	autocomplete,
	cancel,
	intro,
	isCancel,
	outro,
	spinner,
	text,
} from "@clack/prompts";
import { buildCommand } from "@stricli/core";
import type { ProviderInfo } from "../types.js";
import {
	fetchProviders,
	readAuthStore,
	writeAuthStore,
} from "../utils/auth.js";

async function login(): Promise<void> {
	console.clear();
	intro("Connect to an AI provider");

	const s = spinner();

	try {
		const authStore = await readAuthStore();

		s.start("Fetching available providers...");
		const providers = await fetchProviders();
		s.stop("Providers loaded");

		const providerOptions = buildProviderOptions(providers, authStore);

		const selectedProviderId = await autocomplete({
			message: "Select a provider:",
			maxItems: 8,
			options: providerOptions,
		});

		if (isCancel(selectedProviderId)) {
			cancel("Cancelled");
			return;
		}

		const provider = providers[selectedProviderId];
		if (!provider) {
			cancel("Invalid provider");
			return;
		}

		// Get available models for this provider
		const modelOptions = Object.entries(provider.models).map(([id, m]) => ({
			value: id,
			label: m.name || id,
		}));

		modelOptions.push({
			value: "other",
			label: "Other (specify custom model)",
		});

		let selectedModel = await autocomplete({
			message: "Select a model (select 'other' to specify a custom model):",
			maxItems: 8,
			options: modelOptions,
			placeholder: "Type to search...",
		});

		if (isCancel(selectedModel)) {
			cancel("Cancelled");
			return;
		}

		if (selectedModel === "other") {
			selectedModel = await text({
				message: "Enter the custom model ID:",
				placeholder: "e.g., nvidia/llama-3.1-nemotron-70b-instruct",
				validate: (v) => (!v?.trim() ? "Model ID required" : undefined),
			});

			if (isCancel(selectedModel)) {
				cancel("Cancelled");
				return;
			}
		}

		const apiKey = await text({
			message: `Enter API key for ${provider.name}:`,
			validate: (v) => (!v?.trim() ? "API key required" : undefined),
		});

		if (isCancel(apiKey)) {
			cancel("Cancelled");
			return;
		}

		authStore[selectedProviderId] = {
			provider: provider.npm,
			baseUrl: provider.api || "",
			apiKey: apiKey,
			model: selectedModel,
		};

		s.start("Saving...");
		await writeAuthStore(authStore);
		s.stop("Saved");

		outro(`Connected to ${provider.name} with ${selectedModel}`);
	} catch (err) {
		s.stop("Error");
		cancel(err instanceof Error ? err.message : String(err));
	}
}

function buildProviderOptions(
	providers: Record<string, ProviderInfo>,
	authStore: Record<string, { model: string }>,
) {
	return Object.entries(providers)
		.filter(([_, p]) => p.api || p.npm)
		.map(([id, p]) => {
			const auth = authStore[id];
			const label = auth ? `${p.name} ✓ (${auth.model})` : p.name;
			return { value: id, label, hint: p.doc ?? p.api ?? "" };
		})
		.sort((a, b) => {
			const aConn = a.label.includes("✓");
			const bConn = b.label.includes("✓");
			if (aConn !== bConn) return aConn ? -1 : 1;
			return a.label.localeCompare(b.label);
		});
}

export const loginCommand = buildCommand({
	func: login,
	parameters: {
		flags: {},
		positional: { kind: "tuple", parameters: [] },
	},
	docs: {
		brief: "Connect to an AI provider",
	},
});
