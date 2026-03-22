/**
 * Run Drizzle migrations programmatically.
 *
 * Replaces `drizzle-kit migrate` in the startup chain to provide
 * actual error messages when migrations fail.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error("DATABASE_URL not set");
	process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

try {
	const db = drizzle(pool, { casing: "snake_case" });

	console.log("Applying migrations...");
	await migrate(db, {
		migrationsFolder: "./src/generated/drizzle",
	});
	console.log("Migrations applied successfully");
} catch (err) {
	console.error("Migration failed:", err);
	process.exit(1);
} finally {
	await pool.end();
}
