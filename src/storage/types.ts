/**
 * Reference to a stored document under Greptor's data directory.
 * A relative path like `source/publisher/2025-12/2025-12-06-some-label.md`
 */
export type DocumentRef = string;

export type DocumentAddResult =
	| { type: "added"; ref: DocumentRef }
	| { type: "duplicate"; ref: DocumentRef }
	| { type: "error"; message: string };
