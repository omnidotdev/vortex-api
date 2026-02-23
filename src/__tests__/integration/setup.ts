/**
 * Integration test setup.
 *
 * Provides an isolated test database (per-suite) with Drizzle migrations
 * applied, and exports connection objects for use in test suites.
 */

import { afterAll, beforeAll } from "bun:test";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import * as schema from "lib/db/schema";

/** Test database connection URL */
export const TEST_DB_URL =
	process.env.TEST_DATABASE_URL ??
	"postgres://postgres:postgres@localhost:5432/vortex_test";

/** Test cache connection URL */
export const TEST_CACHE_URL =
	process.env.TEST_CACHE_URL ?? "redis://localhost:6379/1";

const testPool = new Pool({
	connectionString: TEST_DB_URL,
	max: 5,
	idleTimeoutMillis: 10_000,
	connectionTimeoutMillis: 5_000,
});

/** Drizzle client connected to the test database */
export const testDb = drizzle({
	client: testPool,
	schema,
	casing: "snake_case",
});

beforeAll(async () => {
	// Run migrations against the test database
	await migrate(testDb, {
		migrationsFolder: "src/generated/drizzle",
	});
});

afterAll(async () => {
	await testPool.end();
});
