#!/usr/bin/env bun
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { cancel, intro, outro, spinner } from "@clack/prompts";
import { cac } from "cac";
import { createGreptor } from "../lib/index.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json");

const cli = cac("greptor");

cli
	.command("eat <file>", "Ingest a file")
	.option("--label <label>", "Label for the content", {
		default: "cli-ingestion",
	})
	.option("--source <source>", "Source of the content", { default: "cli" })
	.option("--publisher <publisher>", "Publisher of the content")
	.option("--topic <topic>", "Topic/Domain for tagging", { default: "general" })
	.option("--dir <dir>", "Base directory for data", { default: process.cwd() })
	.action(async (file, options) => {
		console.clear();
		intro(`Greptor CLI v${pkg.version}`);

		const s = spinner();

		try {
			const filePath = path.resolve(process.cwd(), file);
			s.start(`Reading ${file}`);
			const content = await fs.readFile(filePath, "utf-8");
			s.stop(`Read ${file}`);

			s.start("Initializing Greptor");
			// TODO: Load config from file for model/provider
			const greptor = await createGreptor({
				baseDir: path.resolve(process.cwd(), options.dir),
				topic: options.topic,
				model: {
					provider: "@ai-sdk/openai",
					model: "gpt-4o",
				},
			});
			s.stop("Greptor initialized");

			s.start("Eating content");
			await greptor.eat({
				content,
				format: "text",
				label: options.label,
				source: options.source,
				publisher: options.publisher,
			});
			s.stop("Content ingested");

			outro(`Successfully ingested ${file}`);
			process.exit(0);
		} catch (err: any) {
			s.stop("Error");
			cancel(`Failed: ${err.message}`);
			process.exit(1);
		}
	});

cli.help();
cli.version(pkg.version);

try {
	cli.parse();
} catch (error: any) {
	if (error.message.includes("missing required args")) {
		cli.outputHelp();
		process.exit(1);
	} else {
		throw error;
	}
}
