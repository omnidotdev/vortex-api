import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { reset, seed } from "drizzle-seed";

import { DATABASE_URL, isDevEnv } from "lib/config/env.config";
import * as schema from "lib/db/schema";
import { seedEventSchemas } from "lib/db/seeds/eventSchema.seed";
import { seedIntegrationDefinitions } from "lib/db/seeds/integrationDefinitions.seed";
import { seedWorkflowTemplates } from "lib/db/seeds/workflowTemplates.seed";
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

  // Seed base data (exclude integration definitions - we'll seed those properly)
  await seed(db, {
    ...schema,
    integrationDefinitionTable: undefined,
  });

  // biome-ignore lint/suspicious/noConsole: script logging
  console.log("Seeding event schemas...");

  // Seed known event schema catalog entries
  await seedEventSchemas(db);

  // biome-ignore lint/suspicious/noConsole: script logging
  console.log("Seeding integration definitions...");

  // Seed real integration definitions (GitHub, Discord, Slack, etc.)
  await seedIntegrationDefinitions(db);

  // biome-ignore lint/suspicious/noConsole: script logging
  console.log("Seeding workflow templates...");

  // Seed workflow templates (Discord webhook, etc.)
  await seedWorkflowTemplates(db);

  // biome-ignore lint/suspicious/noConsole: script logging
  console.log("Creating demo organization membership...");

  // Create demo user organization membership
  const demoOrganizationId = "demo-org";

  // Find or create the dev user (orin@omni.dev) and add to demo organization
  const devUserEmail = "orin@omni.dev";
  const [devUser] = await db
    .select()
    .from(schema.userTable)
    .where(eq(schema.userTable.email, devUserEmail))
    .limit(1);

  if (devUser) {
    await db
      .insert(schema.userOrganizationTable)
      .values({
        userId: devUser.id,
        organizationId: demoOrganizationId,
        slug: "demo",
        name: "Demo Organization",
        role: "owner",
      })
      .onConflictDoNothing();
    // biome-ignore lint/suspicious/noConsole: script logging
    console.log(`Added ${devUserEmail} as owner of demo organization`);
  } else {
    // biome-ignore lint/suspicious/noConsole: script logging
    console.log(
      `Dev user ${devUserEmail} not found - they will be added on first login`,
    );
  }

  // biome-ignore lint/suspicious/noConsole: script logging
  console.log("Creating demo workflows...");

  // Insert demo workflows
  for (const workflow of demoWorkflows) {
    await db.insert(schema.workflowTable).values({
      organizationId: demoOrganizationId,
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
