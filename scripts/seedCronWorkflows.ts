#!/usr/bin/env bun
/**
 * Seed Cron Workflows for Aether Scheduled Jobs
 *
 * Registers Vortex cron workflows that replace Aether's setInterval-based
 * periodic maintenance. Each workflow triggers an HTTP POST to Aether's
 * internal job endpoints on an hourly schedule.
 *
 * Usage:
 *   VORTEX_API_URL=https://api.vortex.omni.dev \
 *   VORTEX_API_KEY=<key> \
 *   AETHER_INTERNAL_URL=https://api.billing.omni.dev \
 *   AETHER_INTERNAL_SECRET=<secret> \
 *   bun run scripts/seedCronWorkflows.ts
 */

const {
  VORTEX_API_URL = "http://localhost:4100",
  VORTEX_API_KEY,
  AETHER_INTERNAL_URL = "http://localhost:4000",
  AETHER_INTERNAL_SECRET,
} = process.env;

if (!VORTEX_API_KEY) {
  console.error("VORTEX_API_KEY is required");
  process.exit(1);
}

const workflows = [
  {
    name: "aether-reset-meters",
    definition: {
      trigger: {
        type: "cron",
        cron: "0 * * * *",
      },
      steps: [
        {
          id: "reset-meters",
          type: "http",
          name: "Reset expired usage meters",
          config: {
            method: "POST",
            url: `${AETHER_INTERNAL_URL}/internal/jobs/reset-meters`,
            headers: {
              Authorization: `Bearer ${AETHER_INTERNAL_SECRET}`,
              "Content-Type": "application/json",
            },
            body: {},
            timeout: 30000,
          },
        },
      ],
    },
  },
  {
    name: "aether-renew-credits",
    definition: {
      trigger: {
        type: "cron",
        cron: "0 * * * *",
      },
      steps: [
        {
          id: "renew-credits",
          type: "http",
          name: "Renew free-tier monthly credits",
          config: {
            method: "POST",
            url: `${AETHER_INTERNAL_URL}/internal/jobs/renew-credits`,
            headers: {
              Authorization: `Bearer ${AETHER_INTERNAL_SECRET}`,
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

for (const workflow of workflows) {
  const response = await fetch(
    `${VORTEX_API_URL}/api/v1/workflows/${workflow.name}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: VORTEX_API_KEY,
      },
      body: JSON.stringify({
        definition: workflow.definition,
        isActive: true,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(`Failed to upsert ${workflow.name}: ${response.status} ${body}`);
  } else {
    const result = await response.json();
    console.log(`Upserted workflow: ${workflow.name} (id: ${result.id ?? "ok"})`);
  }
}

console.log("Done seeding cron workflows");
