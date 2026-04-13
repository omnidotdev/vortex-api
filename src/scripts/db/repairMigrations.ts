/**
 * Repair drizzle migration journal in the database.
 *
 * Removes entries from __drizzle_migrations that no longer exist
 * in the local journal, preventing "already applied" conflicts
 * when migrations are regenerated.
 *
 * Handles both drizzle-kit (public schema) and drizzle-orm
 * programmatic migrator (drizzle schema) tracking tables.
 *
 * Safe to run repeatedly (only deletes orphaned entries).
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

	// Check if the drizzle schema migrations table exists (programmatic migrator)
	const { rows: drizzleSchemaCheck } = await client.query(
		"SELECT 1 FROM information_schema.tables WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'",
	);

	if (drizzleSchemaCheck.length === 0) {
		// Check if user tables exist (DB was set up outside Drizzle)
		const { rows: userTables } = await client.query(
			"SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name NOT LIKE '\\_%' LIMIT 1",
		);

		if (userTables.length === 0) {
			console.log("Fresh database, skipping repair");
			await client.end();
			process.exit(0);
		}

		// Tables exist but no migrations tracker, backfill it
		console.log(
			"Database has tables but no drizzle.__drizzle_migrations, backfilling tracker",
		);

		await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
		await client.query(`
			CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
				id SERIAL PRIMARY KEY,
				hash TEXT NOT NULL,
				created_at BIGINT
			)
		`);

		const now = Date.now();
		for (const entry of journal.entries) {
			await client.query(
				'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
				[entry.tag, now],
			);
		}

		console.log(
			`Backfilled ${journal.entries.length} migration entries`,
		);
		await client.end();
		process.exit(0);
	}

	// Migrations table exists, check for stale or missing entries
	const { rows: applied } = await client.query<{
		id: number;
		hash: string;
		created_at: number;
	}>(
		'SELECT id, hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY id',
	);

	// Table exists but is empty, backfill all entries
	if (applied.length === 0 && journal.entries.length > 0) {
		const { rows: userTables } = await client.query(
			"SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name NOT LIKE '\\_%' LIMIT 1",
		);

		if (userTables.length > 0) {
			console.log(
				"Migrations table is empty but database has tables, backfilling",
			);
			const now = Date.now();
			for (const entry of journal.entries) {
				await client.query(
					'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
					[entry.tag, now],
				);
			}
			console.log(`Backfilled ${journal.entries.length} migration entries`);
			await client.end();
			process.exit(0);
		}
	}

	const stale = applied.filter((row) => !validTags.has(row.hash));

	if (stale.length === 0) {
		console.log("Migration journal is clean, no stale entries");
	} else {
		console.log(`Found ${stale.length} stale migration entries to remove:`);
		for (const row of stale) {
			console.log(`  - ${row.hash} (id=${row.id})`);
		}

		const staleIds = stale.map((r) => r.id);
		await client.query(
			'DELETE FROM "drizzle"."__drizzle_migrations" WHERE id = ANY($1::int[])',
			[staleIds],
		);
		console.log(`Removed ${stale.length} stale entries`);
	}
} catch (err) {
	// 42P01 = relation does not exist, safe to skip on fresh DBs
	if (err instanceof Error && "code" in err && (err as any).code === "42P01") {
		console.log("Migration table does not exist yet, skipping repair");
	} else {
		console.error("Migration repair failed:", err);
		process.exit(1);
	}
} finally {
	await client.end();
}
