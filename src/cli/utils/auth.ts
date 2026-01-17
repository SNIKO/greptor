import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AuthStore, ProviderInfo } from "../types.js";

const AUTH_DIR = path.join(os.homedir(), ".greptor");
const AUTH_FILE = path.join(AUTH_DIR, "auth.json");

export async function readAuthStore(): Promise<AuthStore> {
	try {
		const data = await fs.readFile(AUTH_FILE, "utf-8");
		return JSON.parse(data) as AuthStore;
	} catch {
		return {};
	}
}

export async function writeAuthStore(store: AuthStore): Promise<void> {
	await fs.mkdir(AUTH_DIR, { recursive: true });
	await fs.writeFile(AUTH_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export async function fetchProviders(): Promise<Record<string, ProviderInfo>> {
	const response = await fetch("https://models.dev/api.json");
	if (!response.ok) {
		throw new Error(`Failed to fetch providers: ${response.statusText}`);
	}
	return response.json() as Promise<Record<string, ProviderInfo>>;
}
