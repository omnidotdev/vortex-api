import { eventSchemaTable } from "lib/db/schema/eventSchema.table";

/** Platform events visible to all orgs */
const publicEvents = [
  {
    name: "vortex.workflow.started",
    source: "vortex-api",
    description: "Workflow execution dispatched",
  },
  {
    name: "vortex.workflow.completed",
    source: "vortex-worker",
    description: "Workflow execution completed successfully",
  },
  {
    name: "vortex.workflow.failed",
    source: "vortex-worker",
    description: "Workflow execution failed",
  },
];

/** Omni-internal events visible only to the platform org */
const privateEvents = [
  // Synapse (AI router)
  {
    name: "synapse.provider.error",
    source: "synapse-api",
    description: "Inference provider returned an error",
  },
  {
    name: "synapse.provider.health_changed",
    source: "synapse-api",
    description: "Provider availability status changed",
  },
  {
    name: "synapse.usage.threshold",
    source: "synapse-api",
    description: "Usage crossed a budget or rate threshold",
  },
  // Beacon (voice/messaging gateway)
  {
    name: "beacon.conversation.started",
    source: "beacon-gateway",
    description: "A conversation session began",
  },
  {
    name: "beacon.conversation.ended",
    source: "beacon-gateway",
    description: "A conversation session ended",
  },
  {
    name: "beacon.tool.executed",
    source: "beacon-gateway",
    description: "A tool was invoked during a conversation",
  },
  {
    name: "beacon.message.received",
    source: "beacon-gateway",
    description: "A message was received on any channel",
  },
  {
    name: "beacon.message.processed",
    source: "beacon-gateway",
    description: "A message was processed and a response was sent",
  },
  {
    name: "beacon.wake_word.detected",
    source: "beacon-gateway",
    description: "Wake word was detected",
  },
  // Gatekeeper (IDP)
  {
    name: "gatekeeper.user.created",
    source: "gatekeeper-app",
    description: "New user account created",
  },
  {
    name: "gatekeeper.user.deleted",
    source: "gatekeeper-app",
    description: "User account deleted",
  },
  {
    name: "gatekeeper.org.created",
    source: "gatekeeper-app",
    description: "New organization created",
  },
  // Warden (AuthZ PDP)
  {
    name: "warden.role.assigned",
    source: "warden",
    description: "Role assigned to a user",
  },
  {
    name: "warden.policy.changed",
    source: "warden",
    description: "Authorization policy updated",
  },
  // Aether (billing/entitlements)
  {
    name: "aether.subscription.changed",
    source: "aether",
    description: "Subscription tier changed",
  },
  {
    name: "aether.credits.exhausted",
    source: "aether",
    description: "Organization credits exhausted",
  },
  {
    name: "aether.entitlement.updated",
    source: "aether",
    description: "Entitlement limits updated",
  },
  // Arbor (git host)
  {
    name: "arbor.repository.created",
    source: "arbor-api",
    description: "New repository created",
  },
  {
    name: "arbor.ref.created",
    source: "arbor-api",
    description: "Git ref (branch or tag) created",
  },
  {
    name: "arbor.ref.deleted",
    source: "arbor-api",
    description: "Git ref (branch or tag) deleted",
  },
  {
    name: "arbor.pull_request.merged",
    source: "arbor-api",
    description: "Pull request merged",
  },
  // Trellis (knowledge garden)
  {
    name: "trellis.vault.synced",
    source: "trellis-api",
    description: "Vault synced with new commits",
  },
  {
    name: "trellis.vault.cloned",
    source: "trellis-api",
    description: "Vault cloned from a remote",
  },
];

/**
 * Seed known event schema catalog entries.
 * @param db - Drizzle database instance.
 * @param organizationId - Platform organization ID (owns all seeded schemas).
 */
// biome-ignore lint/suspicious/noExplicitAny: drizzle db instance type varies by driver
export async function seedEventSchemas(db: any, organizationId: string) {
  const allEvents = [
    ...publicEvents.map((e) => ({
      ...e,
      organizationId,
      visibility: "public",
    })),
    ...privateEvents.map((e) => ({
      ...e,
      organizationId,
      visibility: "private",
    })),
  ];

  await db.insert(eventSchemaTable).values(allEvents).onConflictDoNothing();
  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(`Seeded ${allEvents.length} event schema entries`);
}
