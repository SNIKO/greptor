#!/usr/bin/env node
import { buildApplication, buildRouteMap } from "@stricli/core";
import { run } from "@stricli/core";
import { generateRoutes } from "./commands/generate/index.js";
import { loginCommand } from "./commands/login.js";

const routes = buildRouteMap({
	routes: {
		login: loginCommand,
		generate: generateRoutes,
	},
	docs: {
		brief: "Greptor CLI - Transform unstructured text into grep-friendly data",
	},
});

export const app = buildApplication(routes, {
	name: "greptor",
	versionInfo: {
		currentVersion: "0.6.0",
	},
});

await run(app, process.argv.slice(2), {
	process: {
		stdout: process.stdout,
		stderr: process.stderr,
		exitCode: process.exitCode ?? null,
	},
});
