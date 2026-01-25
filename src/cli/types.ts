/** Provider info from models.dev API */
export interface ProviderInfo {
	id: string;
	name: string;
	npm: string;
	api?: string;
	doc?: string;
	env?: string[];
	models: Record<string, ModelInfo>;
}

export interface ModelInfo {
	id: string;
	name: string;
	family?: string;
}

/** Stored auth entry */
export interface AuthEntry {
	provider: string;
	baseUrl: string;
	apiKey: string;
	model: string;
}

export type AuthStore = Record<string, AuthEntry>;
