import { dbPool, pgPool } from "../lib/db/db";
import { seedIntegrationDefinitions } from "../lib/db/seeds/integrationDefinitions.seed";

async function main() {
  try {
    await seedIntegrationDefinitions(dbPool);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

main();
