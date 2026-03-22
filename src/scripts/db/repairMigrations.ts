/**
 * Repair drizzle migration journal in the database.
 *
 * Removes entries from __drizzle_migrations that no longer exist
 * in the local journal, preventing "already applied" conflicts
 * when migrations are regenerated.
 *
 * Safe to run repeatedly — only deletes orphaned entries.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error("DATABASE_URL not set");
	process.exit(1);
}

const journalPath = join(
	import.meta.dir,
	"../../generated/drizzle/meta/_journal.json",
);

const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
	entries: Array<{ idx: number; tag: string }>;
};

const validTags = new Set(journal.entries.map((e) => e.tag));

const client = new pg.Client({ connectionString: DATABASE_URL });

try {
	await client.connect();

	const { rows: applied } = await client.query<{
		id: number;
		hash: string;
		created_at: number;
	}>("SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id");

	const stale = applied.filter((row) => !validTags.has(row.hash));

	if (stale.length === 0) {
		console.log("Migration journal is clean — no stale entries");
	} else {
		console.log(`Found ${stale.length} stale migration entries to remove:`);
		for (const row of stale) {
			console.log(`  - ${row.hash} (id=${row.id})`);
		}

		const staleIds = stale.map((r) => r.id);
		await client.query(
			"DELETE FROM __drizzle_migrations WHERE id = ANY($1::int[])",
			[staleIds],
		);
		console.log(`Removed ${stale.length} stale entries`);
	}
} catch (err) {
	console.error("Migration repair failed:", err);
	process.exit(1);
} finally {
	await client.end();
}
