import { drizzle } from "drizzle-orm/node-postgres";
import { reset, seed } from "drizzle-seed";

import { DATABASE_URL, isDevEnv } from "lib/config/env.config";
import * as schema from "lib/db/schema";
import { demoWorkflows } from "./demoWorkflows";

/**
 * Seed a database with sample data.
 */
const seedDatabase = async () => {
  if (!isDevEnv || !DATABASE_URL?.includes("localhost")) {
    // biome-ignore lint/suspicious/noConsole: script logging
    console.log("This script can only be run in development");
    process.exit(1);
  }

  const db = drizzle(DATABASE_URL, { casing: "snake_case" });
  await reset(db, schema);

  // biome-ignore lint/suspicious/noConsole: script logging
  console.log("Seeding database...");

  // Seed base data
  await seed(db, schema);

  // biome-ignore lint/suspicious/noConsole: script logging
  console.log("Creating demo workspace...");

  // Create demo workspace
  const [demoWorkspace] = await db
    .insert(schema.workspaceTable)
    .values({
      name: "Demo Workspace",
      slug: "demo",
      tier: "free",
    })
    .returning();

  // biome-ignore lint/suspicious/noConsole: script logging
  console.log("Creating demo workflows...");

  // Insert demo workflows
  for (const workflow of demoWorkflows) {
    await db.insert(schema.workflowTable).values({
      workspaceId: demoWorkspace.id,
      name: workflow.name,
      description: workflow.description,
      definition: workflow.definition,
      isActive: true,
      webhookSecret: workflow.webhookSecret,
    });
  }

  // biome-ignore lint/suspicious/noConsole: script logging
  console.log(`Created ${demoWorkflows.length} demo workflows`);

  // biome-ignore lint/suspicious/noConsole: script logging
  console.log("Database seeded successfully!");
};

await seedDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
