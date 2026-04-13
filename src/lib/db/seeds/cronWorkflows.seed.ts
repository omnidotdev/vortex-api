import { and, eq } from "drizzle-orm";

import { INTERNAL_API_SECRET } from "lib/config/env.config";
import { workflowTable } from "lib/db/schema";

/**
 * System cron workflow definitions seeded on startup.
 * These run under the platform organization and call internal endpoints.
 */
const cronWorkflows = [
  {
    name: "catalog-sync",
    description:
      "Sync Activepieces integration catalog from npm and open a PR with changes",
    cronExpression: "0 4 * * *",
    definition: {
      trigger: {
        type: "cron",
        cron: "0 4 * * *",
      },
      steps: [
        {
          id: "sync-catalog",
          type: "http",
          name: "Sync integration catalog from npm",
          config: {
            method: "POST",
            url: "/api/v1/internal/catalog/sync",
            headers: {
              Authorization: `Bearer ${INTERNAL_API_SECRET}`,
              "Content-Type": "application/json",
            },
            body: {},
            timeout: 60000,
          },
        },
      ],
    },
  },
];

/**
 * Seed system cron workflows for the platform organization.
 * Idempotent — finds by name + organizationId, inserts if missing, updates if present.
 */
async function seedCronWorkflows(
  // biome-ignore lint/suspicious/noExplicitAny: drizzle db instance type varies by driver
  db: any,
  organizationId: string,
) {
  if (!INTERNAL_API_SECRET) {
    console.warn(
      "INTERNAL_API_SECRET not set — skipping cron workflow seeding",
    );
    return;
  }

  let seeded = 0;

  for (const wf of cronWorkflows) {
    const existing = await db.query.workflowTable.findFirst({
      where: and(
        eq(workflowTable.name, wf.name),
        eq(workflowTable.organizationId, organizationId),
      ),
      columns: { id: true },
    });

    if (existing) {
      await db
        .update(workflowTable)
        .set({
          definition: wf.definition,
          cronExpression: wf.cronExpression,
          description: wf.description,
          isActive: true,
        })
        .where(eq(workflowTable.id, existing.id));
    } else {
      await db.insert(workflowTable).values({
        ...wf,
        organizationId,
        isActive: true,
        executor: "hatchet",
      });
    }

    seeded++;
  }

  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(`Seeded ${seeded} cron workflows`);
}

export default seedCronWorkflows;
