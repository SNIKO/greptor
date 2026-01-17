import crypto from "node:crypto";

export function computeContentHash(content: string): string {
	return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}
