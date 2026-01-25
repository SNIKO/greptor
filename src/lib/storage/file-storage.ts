import type { Dirent } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type {
	DocumentRef,
	DocumentAddResult as DocumentSaveResult,
} from "../storage/types.js";
import type { GreptorEatInput, Tags } from "../types.js";
import { fileExists } from "../utils/file.js";

export const RAW_DIR_NAME = "raw";
export const PROCESSED_DIR_NAME = "processed";

export interface FileStorage {
	readonly baseDir: string;
	readonly rawContentPath: string;
	readonly processedContentPath: string;

	saveRawContent(input: GreptorEatInput): Promise<DocumentSaveResult>;
	readRawContent(ref: DocumentRef): Promise<{ tags: Tags; content: string }>;
	getUnprocessedContents(): Promise<DocumentRef[]>;
	saveProcessedContent(ref: DocumentRef, content: string): Promise<void>;
}

export function createFileStorage(baseDir: string): FileStorage {
	const rawContentPath = path.join(baseDir, RAW_DIR_NAME);
	const processedContentPath = path.join(baseDir, PROCESSED_DIR_NAME);

	function resolveLayerPath(
		layer: "raw" | "processed",
		ref: DocumentRef,
	): string {
		return path.join(baseDir, layer, ref);
	}

	function getYearMonthSegment(date: Date): string {
		const year = String(date.getUTCFullYear());
		const month = String(date.getUTCMonth() + 1).padStart(2, "0");
		return `${year}-${month}`;
	}

	function sanitize(
		name: string,
		maxLength = 50,
		fallback = "unknown",
	): string {
		const trimmed = name.trim();
		let sanitized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		sanitized = sanitized.replace(/^-+/, "").replace(/-+$/, "");
		sanitized = sanitized.replace(/-+/g, "-");

		if (sanitized.length > maxLength) {
			sanitized = sanitized.slice(0, maxLength);
		}

		if (!sanitized || sanitized === "") {
			return fallback;
		}

		return sanitized;
	}

	function generateDocumentRef(args: {
		id?: string;
		label: string;
		source: string;
		publisher?: string;
		timestamp?: Date;
	}): DocumentRef {
		const effectiveTimestamp = args.timestamp ?? new Date();
		const isoDate = effectiveTimestamp.toISOString().split("T")[0];
		const safeId = sanitize(args.id ?? "", 50, "unknown");
		const safeTitle = sanitize(args.label, 50, safeId);
		const yearMonth = getYearMonthSegment(effectiveTimestamp);
		const source = sanitize(args.source, 20, "unknown");
		const publisher = args.publisher
			? sanitize(args.publisher, 50, "unknown")
			: undefined;

		const fileName = `${isoDate}-${safeTitle}.md`;

		return path.posix.join(
			source,
			...(publisher ? [publisher] : []),
			yearMonth,
			fileName,
		);
	}

	function buildRawFileContent(input: GreptorEatInput): string {
		const yamlHeader = {
			id: input.id,
			title: input.label,
			created_at: input.creationDate
				? input.creationDate.toISOString()
				: new Date().toISOString(),
			...input.tags,
			source: input.source,
			...(input.publisher ? { publisher: input.publisher } : {}),
		};

		const yamlHeaderString = YAML.stringify(yamlHeader);

		const lines = ["---"];
		lines.push(yamlHeaderString.trim());
		lines.push("---");
		lines.push("");
		lines.push(input.content.trim());

		return lines.join("\n");
	}

	async function listLayerRefs(
		layer: "raw" | "processed",
	): Promise<DocumentRef[]> {
		const rootFull = path.join(baseDir, layer);
		const results: DocumentRef[] = [];

		const walk = async (
			dirFull: string,
			dirRelative: string,
		): Promise<void> => {
			let entries: Dirent[];
			try {
				entries = await readdir(dirFull, { withFileTypes: true });
			} catch {
				return;
			}

			for (const entry of entries) {
				const nextFull = path.join(dirFull, entry.name);
				const nextRelative = path.posix.join(dirRelative, entry.name);
				if (entry.isDirectory()) {
					await walk(nextFull, nextRelative);
					continue;
				}
				if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
					results.push(nextRelative);
				}
			}
		};

		await walk(rootFull, "");
		results.sort((a, b) => a.localeCompare(b));
		return results;
	}

	async function saveRawContent(
		input: GreptorEatInput,
	): Promise<DocumentSaveResult> {
		try {
			const content = buildRawFileContent(input);
			const ref = generateDocumentRef({
				id: input.id ?? "unknown",
				label: input.label,
				source: input.source,
				...(input.publisher ? { publisher: input.publisher } : {}),
				...(input.creationDate ? { timestamp: input.creationDate } : {}),
			});

			const fullPath = resolveLayerPath("raw", ref);
			if (await fileExists(fullPath)) {
				if (!input.overwrite) {
					return {
						type: "duplicate",
						ref,
					};
				}
			} else {
				await mkdir(path.dirname(fullPath), { recursive: true });
			}

			await writeFile(fullPath, content, "utf8");
			return {
				type: "added",
				ref,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return {
				type: "error",
				message: errorMessage,
			};
		}
	}

	async function readRawContent(
		ref: DocumentRef,
	): Promise<{ tags: Tags; content: string }> {
		const fullPath = resolveLayerPath("raw", ref);
		const content = await readFile(fullPath, "utf8");
		if (!content.startsWith("---\n")) {
			throw new Error(
				`Invalid raw file format. The file '${ref}' doesn't have yaml header.`,
			);
		}

		const endIndex = content.indexOf("\n---", 4);
		if (endIndex === -1) {
			throw new Error(
				`Invalid raw file format. The file '${ref}' doesn't have yaml header.`,
			);
		}

		const after = content.slice(endIndex + 4);
		const body = after.startsWith("\n") ? after.slice(1) : after;
		const yamlHeader = content.slice(4, endIndex).trimEnd();
		const parsed = YAML.parse(yamlHeader) as unknown;
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Array.isArray(parsed)
		) {
			throw new Error(
				`Invalid raw file format. The file '${ref}' has a non-object yaml header.`,
			);
		}

		const tags = parsed as Tags;

		return { tags, content: body };
	}

	async function getUnprocessedContents(): Promise<DocumentRef[]> {
		const rawRefs = await listLayerRefs("raw");
		const processedRefs = await listLayerRefs("processed");
		const processedSet = new Set(processedRefs);
		return rawRefs.filter((ref) => !processedSet.has(ref));
	}

	async function saveProcessedContent(
		ref: DocumentRef,
		content: string,
	): Promise<void> {
		const processedFullPath = resolveLayerPath("processed", ref);
		await mkdir(path.dirname(processedFullPath), { recursive: true });
		await writeFile(processedFullPath, content, "utf8");
	}

	return {
		baseDir,
		rawContentPath,
		processedContentPath,
		saveRawContent,
		readRawContent,
		getUnprocessedContents,
		saveProcessedContent,
	};
}
