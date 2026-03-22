import { sql } from "drizzle-orm";

import { eventSchemaTable } from "lib/db/schema/eventSchema.table";

import type { InsertEventSchema } from "lib/db/schema/eventSchema.table";

/** JSON Schema shorthand helpers */
const str = (description: string) => ({ type: "string", description }) as const;
const num = (description: string) => ({ type: "number", description }) as const;
const bool = (description: string) =>
  ({ type: "boolean", description }) as const;
const iso = (description: string) =>
  ({ type: "string", format: "date-time", description }) as const;

/** Build a JSON Schema object for an event's `data` payload */
const schema = (
  properties: Record<string, object>,
  required: string[] = [],
) => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

/** Platform events visible to all orgs */
const publicEvents: Omit<InsertEventSchema, "organizationId" | "visibility">[] =
  [
    {
      name: "vortex.workflow.started",
      source: "vortex-api",
      description: "Workflow execution dispatched",
      payloadSchema: schema(
        {
          workflowId: str("Workflow record ID"),
          runId: str("Workflow run record ID"),
          executor: str("Execution backend (hatchet, temporal, or BYOK slug)"),
        },
        ["workflowId", "runId", "executor"],
      ),
    },
    {
      name: "vortex.workflow.completed",
      source: "vortex-worker",
      description: "Workflow execution completed successfully",
      payloadSchema: schema(
        {
          workflowId: str("Engine workflow ID"),
          runId: str("Hatchet/Temporal run ID"),
          dbRunId: str("Database workflow run record ID"),
          completedSteps: num("Number of steps that executed successfully"),
        },
        ["workflowId", "runId", "dbRunId", "completedSteps"],
      ),
    },
    {
      name: "vortex.workflow.failed",
      source: "vortex-worker",
      description: "Workflow execution failed",
      payloadSchema: schema(
        {
          workflowId: str("Engine workflow ID"),
          runId: str("Hatchet/Temporal run ID"),
          dbRunId: str("Database workflow run record ID"),
          error: str("Error message describing the failure"),
        },
        ["workflowId", "runId", "dbRunId", "error"],
      ),
    },
  ];

/** Omni-internal events visible only to the platform org */
const privateEvents: Omit<
  InsertEventSchema,
  "organizationId" | "visibility"
>[] = [
  // Synapse (AI router)
  {
    name: "synapse.provider.error",
    source: "synapse-api",
    description: "Inference provider returned an error",
    payloadSchema: schema(
      {
        providerId: str("Provider identifier"),
        model: str("Model that was requested"),
        errorCode: str("Provider error code"),
        errorMessage: str("Human-readable error description"),
        requestId: str("Originating request ID"),
      },
      ["providerId", "errorMessage"],
    ),
  },
  {
    name: "synapse.provider.health_changed",
    source: "synapse-api",
    description: "Provider availability status changed",
    payloadSchema: schema(
      {
        providerId: str("Provider identifier"),
        previousStatus: str("Previous health status"),
        currentStatus: str("New health status"),
        reason: str("Reason for the status change"),
        checkedAt: iso("Timestamp of the health check"),
      },
      ["providerId", "previousStatus", "currentStatus"],
    ),
  },
  {
    name: "synapse.usage.threshold",
    source: "synapse-api",
    description: "Usage crossed a budget or rate threshold",
    payloadSchema: schema(
      {
        thresholdType: str("Type of threshold (budget, rate, tokens)"),
        currentValue: num("Current usage value"),
        thresholdValue: num("Configured threshold value"),
        percentage: num("Percentage of threshold consumed"),
        period: str("Billing or rate-limit period"),
      },
      ["thresholdType", "currentValue", "thresholdValue"],
    ),
  },
  // Beacon (voice/messaging gateway)
  {
    name: "beacon.conversation.started",
    source: "beacon-gateway",
    description: "A conversation session began",
    payloadSchema: schema(
      {
        conversationId: str("Unique conversation session ID"),
        channel: str("Communication channel (voice, sms, web)"),
        participantId: str("Initiating participant ID"),
        startedAt: iso("Session start timestamp"),
      },
      ["conversationId", "channel"],
    ),
  },
  {
    name: "beacon.conversation.ended",
    source: "beacon-gateway",
    description: "A conversation session ended",
    payloadSchema: schema(
      {
        conversationId: str("Unique conversation session ID"),
        channel: str("Communication channel (voice, sms, web)"),
        durationMs: num("Session duration in milliseconds"),
        messageCount: num("Total messages exchanged"),
        endedAt: iso("Session end timestamp"),
        reason: str("Reason the session ended (hangup, timeout, error)"),
      },
      ["conversationId", "channel"],
    ),
  },
  {
    name: "beacon.tool.executed",
    source: "beacon-gateway",
    description: "A tool was invoked during a conversation",
    payloadSchema: schema(
      {
        conversationId: str("Parent conversation session ID"),
        toolName: str("Name of the invoked tool"),
        toolId: str("Tool definition ID"),
        durationMs: num("Tool execution duration in milliseconds"),
        success: bool("Whether the tool executed successfully"),
        error: str("Error message if the tool failed"),
      },
      ["conversationId", "toolName", "success"],
    ),
  },
  {
    name: "beacon.message.received",
    source: "beacon-gateway",
    description: "A message was received on any channel",
    payloadSchema: schema(
      {
        messageId: str("Unique message ID"),
        conversationId: str("Parent conversation session ID"),
        channel: str("Communication channel (voice, sms, web)"),
        senderId: str("Sender participant ID"),
        contentType: str("Message content type (text, audio, image)"),
        receivedAt: iso("Message receipt timestamp"),
      },
      ["messageId", "conversationId", "channel"],
    ),
  },
  {
    name: "beacon.message.processed",
    source: "beacon-gateway",
    description: "A message was processed and a response was sent",
    payloadSchema: schema(
      {
        messageId: str("Originating message ID"),
        conversationId: str("Parent conversation session ID"),
        channel: str("Communication channel"),
        responseId: str("Generated response ID"),
        processingMs: num("Processing time in milliseconds"),
        model: str("AI model used for generation"),
      },
      ["messageId", "conversationId", "channel"],
    ),
  },
  {
    name: "beacon.wake_word.detected",
    source: "beacon-gateway",
    description: "Wake word was detected",
    payloadSchema: schema(
      {
        deviceId: str("Device that detected the wake word"),
        wakeWord: str("Detected wake word phrase"),
        confidence: num("Detection confidence score (0-1)"),
        detectedAt: iso("Detection timestamp"),
      },
      ["deviceId", "wakeWord"],
    ),
  },
  // Gatekeeper (IDP)
  {
    name: "gatekeeper.user.created",
    source: "omni.gatekeeper",
    description: "New user account created",
    payloadSchema: schema(
      {
        userId: str("Newly created user ID"),
        email: str("User email address"),
        provider: str("Authentication provider (email, oauth, etc.)"),
        createdAt: iso("Account creation timestamp"),
      },
      ["userId"],
    ),
  },
  {
    name: "gatekeeper.user.deleted",
    source: "omni.gatekeeper",
    description: "User account deleted",
    payloadSchema: schema(
      {
        userId: str("Deleted user ID"),
        deletedAt: iso("Account deletion timestamp"),
        reason: str("Deletion reason (self, admin, policy)"),
      },
      ["userId"],
    ),
  },
  {
    name: "gatekeeper.org.created",
    source: "omni.gatekeeper",
    description: "New organization created",
    payloadSchema: schema(
      {
        orgId: str("Newly created organization ID"),
        name: str("Organization display name"),
        slug: str("Organization URL slug"),
        ownerId: str("User ID of the organization owner"),
        createdAt: iso("Organization creation timestamp"),
      },
      ["orgId", "ownerId"],
    ),
  },
  // Gatekeeper email events (routed to email-send workflow)
  {
    name: "gatekeeper.email.verify_email_requested",
    source: "omni.gatekeeper",
    description: "Email verification requested for a new account",
    payloadSchema: schema(
      {
        to: str("Recipient email address"),
        templateId: str("Email template identifier"),
        templateData: {
          type: "object",
          description: "Data for template rendering",
          additionalProperties: true,
        },
        senderAddress: str("From address"),
      },
      ["to", "templateId", "senderAddress"],
    ),
  },
  {
    name: "gatekeeper.email.reset_password_requested",
    source: "omni.gatekeeper",
    description: "Password reset email requested",
    payloadSchema: schema(
      {
        to: str("Recipient email address"),
        templateId: str("Email template identifier"),
        templateData: {
          type: "object",
          description: "Data for template rendering",
          additionalProperties: true,
        },
        senderAddress: str("From address"),
      },
      ["to", "templateId", "senderAddress"],
    ),
  },
  {
    name: "gatekeeper.email.change_email_requested",
    source: "omni.gatekeeper",
    description: "Email change verification requested",
    payloadSchema: schema(
      {
        to: str("Recipient email address"),
        templateId: str("Email template identifier"),
        templateData: {
          type: "object",
          description: "Data for template rendering",
          additionalProperties: true,
        },
        senderAddress: str("From address"),
      },
      ["to", "templateId", "senderAddress"],
    ),
  },
  {
    name: "gatekeeper.email.otp_requested",
    source: "omni.gatekeeper",
    description: "One-time password email requested",
    payloadSchema: schema(
      {
        to: str("Recipient email address"),
        templateId: str("Email template identifier"),
        templateData: {
          type: "object",
          description: "Data for template rendering",
          additionalProperties: true,
        },
        senderAddress: str("From address"),
      },
      ["to", "templateId", "senderAddress"],
    ),
  },
  {
    name: "gatekeeper.email.invite_user_requested",
    source: "omni.gatekeeper",
    description: "Organization invitation email requested",
    payloadSchema: schema(
      {
        to: str("Recipient email address"),
        templateId: str("Email template identifier"),
        templateData: {
          type: "object",
          description: "Data for template rendering",
          additionalProperties: true,
        },
        senderAddress: str("From address"),
      },
      ["to", "templateId", "senderAddress"],
    ),
  },
  // Warden (AuthZ PDP)
  {
    name: "warden.role.assigned",
    source: "warden",
    description: "Role assigned to a user",
    payloadSchema: schema(
      {
        userId: str("User receiving the role"),
        role: str("Role identifier"),
        resourceType: str("Resource type the role applies to"),
        resourceId: str("Resource ID the role applies to"),
        assignedBy: str("User ID of the assigner"),
      },
      ["userId", "role"],
    ),
  },
  {
    name: "warden.policy.changed",
    source: "warden",
    description: "Authorization policy updated",
    payloadSchema: schema(
      {
        policyId: str("Updated policy identifier"),
        action: str("Change action (created, updated, deleted)"),
        modelId: str("Authorization model ID"),
        changedBy: str("User ID of the author"),
        changedAt: iso("Policy change timestamp"),
      },
      ["policyId", "action"],
    ),
  },
  // Aether (billing/entitlements)
  {
    name: "aether.subscription.changed",
    source: "aether",
    description: "Subscription tier changed",
    payloadSchema: schema(
      {
        subscriptionId: str("Subscription record ID"),
        previousTier: str("Previous subscription tier"),
        newTier: str("New subscription tier"),
        effectiveAt: iso("When the change takes effect"),
        reason: str("Change reason (upgrade, downgrade, cancellation)"),
      },
      ["subscriptionId", "newTier"],
    ),
  },
  {
    name: "aether.credits.exhausted",
    source: "aether",
    description: "Organization credits exhausted",
    payloadSchema: schema(
      {
        creditPoolId: str("Credit pool identifier"),
        productId: str("Product the credits apply to"),
        exhaustedAt: iso("Timestamp credits reached zero"),
        lastChargeAmount: num("Amount of the final charge"),
      },
      ["creditPoolId"],
    ),
  },
  {
    name: "aether.entitlement.updated",
    source: "aether",
    description: "Entitlement limits updated",
    payloadSchema: schema(
      {
        entitlementId: str("Entitlement record ID"),
        feature: str("Feature key (e.g. workflows, seats)"),
        previousLimit: num("Previous limit value"),
        newLimit: num("New limit value"),
        reason: str("Reason for the update"),
      },
      ["entitlementId", "feature", "newLimit"],
    ),
  },
  // Arbor (git host)
  {
    name: "arbor.repository.created",
    source: "arbor-api",
    description: "New repository created",
    payloadSchema: schema(
      {
        repositoryId: str("Repository record ID"),
        name: str("Repository name"),
        owner: str("Owning user or organization slug"),
        visibility: str("Repository visibility (public, private)"),
        createdAt: iso("Repository creation timestamp"),
      },
      ["repositoryId", "name", "owner"],
    ),
  },
  {
    name: "arbor.ref.created",
    source: "arbor-api",
    description: "Git ref (branch or tag) created",
    payloadSchema: schema(
      {
        repositoryId: str("Parent repository ID"),
        ref: str("Full ref path (refs/heads/main, refs/tags/v1.0)"),
        refType: str("Ref type (branch, tag)"),
        sha: str("Commit SHA the ref points to"),
        createdBy: str("User ID who created the ref"),
      },
      ["repositoryId", "ref", "refType", "sha"],
    ),
  },
  {
    name: "arbor.ref.deleted",
    source: "arbor-api",
    description: "Git ref (branch or tag) deleted",
    payloadSchema: schema(
      {
        repositoryId: str("Parent repository ID"),
        ref: str("Full ref path that was deleted"),
        refType: str("Ref type (branch, tag)"),
        previousSha: str("Last commit SHA before deletion"),
        deletedBy: str("User ID who deleted the ref"),
      },
      ["repositoryId", "ref", "refType"],
    ),
  },
  {
    name: "arbor.pull_request.merged",
    source: "arbor-api",
    description: "Pull request merged",
    payloadSchema: schema(
      {
        repositoryId: str("Parent repository ID"),
        pullRequestId: str("Pull request record ID"),
        number: num("Pull request number"),
        title: str("Pull request title"),
        sourceBranch: str("Source branch name"),
        targetBranch: str("Target branch name"),
        mergeCommitSha: str("Merge commit SHA"),
        mergedBy: str("User ID who merged"),
      },
      ["repositoryId", "pullRequestId", "number", "targetBranch"],
    ),
  },
  // Trellis (knowledge garden)
  {
    name: "trellis.vault.synced",
    source: "trellis-api",
    description: "Vault synced with new commits",
    payloadSchema: schema(
      {
        vaultId: str("Vault record ID"),
        commitCount: num("Number of new commits synced"),
        headSha: str("New HEAD commit SHA after sync"),
        previousSha: str("Previous HEAD commit SHA before sync"),
        syncedAt: iso("Sync completion timestamp"),
      },
      ["vaultId", "headSha"],
    ),
  },
  {
    name: "trellis.vault.cloned",
    source: "trellis-api",
    description: "Vault cloned from a remote",
    payloadSchema: schema(
      {
        vaultId: str("Newly created vault record ID"),
        remoteUrl: str("Source remote URL"),
        headSha: str("HEAD commit SHA after clone"),
        clonedAt: iso("Clone completion timestamp"),
      },
      ["vaultId", "remoteUrl"],
    ),
  },

  // Crystal (zero-fee funding)
  {
    name: "crystal.donation.received",
    source: "crystal-api",
    description: "Donation payment completed via Stripe checkout",
    payloadSchema: schema(
      {
        donationId: str("Donation record ID"),
        donorId: str("Donor user ID"),
        amount: num("Donation amount in smallest currency unit"),
        currency: str("ISO 4217 currency code"),
      },
      ["donationId", "amount", "currency"],
    ),
  },
  {
    name: "crystal.sponsorship.created",
    source: "crystal-api",
    description: "New sponsorship subscription started",
    payloadSchema: schema(
      {
        sponsorshipId: str("Sponsorship record ID"),
        sponsorId: str("Sponsor user ID"),
        tierId: str("Sponsorship tier ID"),
        amount: num("Sponsorship amount in smallest currency unit"),
        currency: str("ISO 4217 currency code"),
        frequency: str("Billing frequency (monthly, yearly)"),
      },
      ["sponsorshipId", "sponsorId", "amount", "currency"],
    ),
  },
  {
    name: "crystal.sponsorship.renewed",
    source: "crystal-api",
    description: "Recurring sponsorship payment processed",
    payloadSchema: schema(
      {
        sponsorshipId: str("Sponsorship record ID"),
        sponsorId: str("Sponsor user ID"),
        amount: num("Renewal amount in smallest currency unit"),
        currency: str("ISO 4217 currency code"),
      },
      ["sponsorshipId", "amount", "currency"],
    ),
  },
  {
    name: "crystal.sponsorship.cancelled",
    source: "crystal-api",
    description: "Sponsorship subscription cancelled",
    payloadSchema: schema(
      {
        sponsorshipId: str("Sponsorship record ID"),
        sponsorId: str("Sponsor user ID"),
        reason: str("Cancellation reason if provided"),
      },
      ["sponsorshipId", "sponsorId"],
    ),
  },
  {
    name: "crystal.payout.completed",
    source: "crystal-api",
    description: "Payout to connected account completed",
    payloadSchema: schema(
      {
        payoutId: str("Stripe payout ID"),
        organizationId: str("Receiving organization ID"),
        amount: num("Payout amount in smallest currency unit"),
        currency: str("ISO 4217 currency code"),
      },
      ["payoutId", "organizationId", "amount", "currency"],
    ),
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
      visibility: "public" as const,
    })),
    ...privateEvents.map((e) => ({
      ...e,
      organizationId,
      visibility: "private" as const,
    })),
  ];

  await db
    .insert(eventSchemaTable)
    .values(allEvents)
    .onConflictDoUpdate({
      target: [
        eventSchemaTable.name,
        eventSchemaTable.version,
        eventSchemaTable.organizationId,
      ],
      set: {
        description: sql`excluded.description`,
        payloadSchema: sql`excluded.payload_schema`,
        source: sql`excluded.source`,
        visibility: sql`excluded.visibility`,
      },
    });
  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(`Seeded ${allEvents.length} event schema entries`);
}
