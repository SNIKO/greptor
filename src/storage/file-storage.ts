import type { Dirent } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { DocumentRef, GreptorAddInput, Metadata } from "../types.js";

export interface FileStorage {
	readonly baseDir: string;
	readonly rawContentPath: string;
	readonly processedContentPath: string;

	saveRawContent(input: GreptorAddInput): Promise<DocumentRef>;
	readRawContent(
		ref: DocumentRef,
	): Promise<{ metadata: Metadata; content: string }>;
	getUnprocessedContents(): Promise<DocumentRef[]>;
	saveProcessedContent(ref: DocumentRef, content: string): Promise<void>;
}

export function createFileStorage(baseDir: string): FileStorage {
	const rawContentPath = path.join(baseDir, "raw");
	const processedContentPath = path.join(baseDir, "processed");

	function resolveLayerPath(
		layer: "raw" | "processed",
		ref: DocumentRef,
	): string {
		return path.join(baseDir, layer, ref);
	}

	function encodeIdForFilename(id: string): string {
		return id.trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
	}

	function getMonthSegments(date: Date): { year: string; month: string } {
		const year = String(date.getUTCFullYear());
		const month = String(date.getUTCMonth() + 1).padStart(2, "0");
		return { year, month };
	}

	function sanitizeFileName(name: string, maxLength = 50): string {
		const trimmed = name.trim();
		let sanitized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		sanitized = sanitized.replace(/^-+/, "").replace(/-+$/, "");
		sanitized = sanitized.replace(/-+/g, "-");

		if (sanitized.length > maxLength) {
			sanitized = sanitized.slice(0, maxLength);
		}

		return sanitized;
	}

	function generateDocumentRef(args: {
		label: string;
		id?: string;
		timestamp?: Date;
	}): DocumentRef {
		const effectiveTimestamp = args.timestamp ?? new Date();
		const isoDate = effectiveTimestamp.toISOString().split("T")[0];
		const sageTitle = sanitizeFileName(args.label);
		const { year, month } = getMonthSegments(effectiveTimestamp);

		const fileName = args.id
			? `${isoDate}-${sageTitle}-${encodeIdForFilename(args.id)}.md`
			: `${isoDate}-${sageTitle}.md`;

		return path.posix.join(year, month, fileName);
	}

	function buildRawFileContent(input: GreptorAddInput): string {
		const yamlHeader = {
			title: input.label,
			created_at: input.creationDate
				? input.creationDate.toISOString()
				: new Date().toISOString(),
			...input.metadata,
		};

		const yamlHeaderString = YAML.stringify(yamlHeader);

		const lines = ["---"];
		lines.push(yamlHeaderString.trim());
		lines.push("---");
		lines.push("");
		lines.push(input.content.trimStart().trimEnd());

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

	async function saveRawContent(input: GreptorAddInput): Promise<DocumentRef> {
		const content = buildRawFileContent(input);
		const ref = generateDocumentRef({
			label: input.label,
			id: input.id,
			timestamp: input.creationDate,
		});

		const fullPath = resolveLayerPath("raw", ref);
		await mkdir(path.dirname(fullPath), { recursive: true });
		await writeFile(fullPath, content, "utf8");

		return ref;
	}

	async function readRawContent(
		ref: DocumentRef,
	): Promise<{ metadata: Metadata; content: string }> {
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
		const metadata = YAML.parse(yamlHeader) as Metadata;

		return { metadata, content: body };
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
