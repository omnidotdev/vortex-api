import { eventSchemaTable } from "lib/db/schema/eventSchema.table";

const events = [
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
  // Vortex (workflow engine lifecycle)
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

/**
 * Seed known event schema catalog entries.
 */
// biome-ignore lint/suspicious/noExplicitAny: drizzle db instance type varies by driver
export async function seedEventSchemas(db: any) {
  await db.insert(eventSchemaTable).values(events).onConflictDoNothing();
  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(`Seeded ${events.length} event schema entries`);
}
