import { randomUUID } from "node:crypto";

import { Hatchet } from "@hatchet-dev/typescript-sdk";
import { and, desc, eq } from "drizzle-orm";
import { EXPORTABLE } from "graphile-export";
import { context, lambda } from "postgraphile/grafast";
import { gql, makeExtendSchemaPlugin } from "postgraphile/utils";

import { dbPool } from "lib/db/db";
import {
  eventRoutingRuleTable,
  workflowRunTable,
  workflowTable,
} from "lib/db/schema";

import type { SelectUser } from "lib/db/schema";

// Initialize Hatchet client for workflow triggers
export let hatchetClient: ReturnType<typeof Hatchet.init> | null = null;
try {
  hatchetClient = Hatchet.init();
} catch {
  console.warn(
    "[PublishEvent] Hatchet not configured, event routing will be unavailable",
  );
}

/**
 * Match a glob-style pattern against a value.
 * Supports:
 * - "*" matches everything
 * - "prefix.*" matches "prefix.anything"
 * - "exact" matches exactly "exact"
 */
export const matchGlobPattern = (pattern: string, value: string): boolean => {
  if (pattern === "*") return true;

  // Convert glob pattern to regex
  // Escape special regex chars except *, then convert * to .*
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(value);
};

interface PublishEventInput {
  organizationId: string;
  type: string;
  subject?: string | null;
  data?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  correlationId?: string | null;
}

interface TriggeredWorkflow {
  workflowId: string;
  workflowName: string;
  runId: string;
  status: string;
}

interface PublishEventPayload {
  eventId: string;
  workflowsTriggered: TriggeredWorkflow[];
}

/**
 * Execute the publishEvent mutation logic.
 * Exported for use with EXPORTABLE in schema generation.
 */
export const executePublishEvent = async (
  input: PublishEventInput,
  observer: SelectUser | null,
  db: typeof dbPool,
  hatchet: ReturnType<typeof Hatchet.init> | null,
  generateUUID: typeof randomUUID,
  matchPattern: typeof matchGlobPattern,
  drizzleAnd: typeof and,
  drizzleEq: typeof eq,
  drizzleDesc: typeof desc,
  eventTable: typeof eventRoutingRuleTable,
  wfTable: typeof workflowTable,
  wfRunTable: typeof workflowRunTable,
): Promise<PublishEventPayload> => {
  const { organizationId, type, subject, data, correlationId } = input;

  // Verify user has access to this organization
  if (!observer) {
    throw new Error("Unauthorized");
  }

  const membership = await db.query.userOrganizationTable.findFirst({
    where: (table, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(table.userId, observer.id),
        eqFn(table.organizationId, organizationId),
      ),
  });

  if (!membership) {
    throw new Error("Unauthorized: not a member of this organization");
  }

  if (!hatchet) {
    throw new Error("Event routing is not configured");
  }

  // Generate event ID
  const eventId = generateUUID();

  // Find matching routing rules
  const rules = await db.query.eventRoutingRuleTable.findMany({
    where: drizzleAnd(
      drizzleEq(eventTable.organizationId, organizationId),
      drizzleEq(eventTable.enabled, true),
    ),
    orderBy: [drizzleDesc(eventTable.priority)],
  });

  // Filter rules by type pattern matching
  const matchingRules = rules.filter((rule) =>
    matchPattern(rule.typePattern, type),
  );

  // Trigger workflows for each matching rule
  const triggeredWorkflows: TriggeredWorkflow[] = [];

  for (const rule of matchingRules) {
    // Fetch the workflow
    const workflow = await db.query.workflowTable.findFirst({
      where: drizzleAnd(
        drizzleEq(wfTable.id, rule.workflowId),
        drizzleEq(wfTable.isActive, true),
      ),
    });

    if (!workflow) {
      // Skip inactive or deleted workflows
      continue;
    }

    try {
      // Generate run IDs
      const engineWorkflowId = `event-${workflow.id}-${Date.now()}`;
      const engineRunId = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Create run record
      const [run] = await db
        .insert(wfRunTable)
        .values({
          workflowId: workflow.id,
          engineWorkflowId,
          engineRunId,
          status: "pending",
          input: {
            event: {
              id: eventId,
              type,
              subject,
              data: data || {},
              correlationId,
              timestamp: new Date().toISOString(),
            },
          },
        })
        .returning();

      // Trigger execution via Hatchet
      await hatchet.event.push("workflow:execute", {
        workflowId: engineWorkflowId,
        runId: run.id,
        organizationId,
        triggerData: {
          event: {
            id: eventId,
            type,
            subject,
            data: data || {},
            correlationId,
            timestamp: new Date().toISOString(),
          },
        },
        definition: workflow.definition,
      });

      // Update status to running
      await db
        .update(wfRunTable)
        .set({ status: "running" })
        .where(drizzleEq(wfRunTable.id, run.id));

      triggeredWorkflows.push({
        workflowId: workflow.id,
        workflowName: workflow.name,
        runId: run.id,
        status: "running",
      });
    } catch (err) {
      console.error(
        `[PublishEvent] Failed to trigger workflow ${workflow.id}:`,
        err,
      );
      // Continue with other workflows even if one fails
    }
  }

  return {
    eventId,
    workflowsTriggered: triggeredWorkflows,
  };
};

/**
 * PublishEvent GraphQL mutation plugin.
 *
 * Allows Omni services to publish events that trigger workflows
 * based on event routing rules.
 */
const PublishEventPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    """
    Input for publishing an event to trigger workflows
    """
    input PublishEventInput {
      """
      Organization ID that owns the event routing rules
      """
      organizationId: String!

      """
      Event type (e.g., "user.created", "subscription.updated")
      """
      type: String!

      """
      Optional event subject (e.g., user ID, subscription ID)
      """
      subject: String

      """
      Event data payload as JSON
      """
      data: JSON

      """
      Optional idempotency key for deduplication
      """
      idempotencyKey: String

      """
      Optional correlation ID for tracing related events
      """
      correlationId: String
    }

    """
    Information about a workflow that was triggered by an event
    """
    type TriggeredWorkflow {
      """
      ID of the workflow that was triggered
      """
      workflowId: UUID!

      """
      Name of the workflow
      """
      workflowName: String!

      """
      ID of the workflow run
      """
      runId: UUID!

      """
      Status of the triggered workflow run
      """
      status: String!
    }

    """
    Result of publishing an event
    """
    type PublishEventPayload {
      """
      Unique ID for this event (UUID)
      """
      eventId: UUID!

      """
      List of workflows that were triggered by this event
      """
      workflowsTriggered: [TriggeredWorkflow!]!
    }

    extend type Mutation {
      """
      Publish an event to trigger matching workflows.

      Finds event routing rules that match the event type and triggers
      the associated workflows via Hatchet.
      """
      publishEvent(input: PublishEventInput!): PublishEventPayload
    }
  `,
  plans: {
    Mutation: {
      publishEvent: EXPORTABLE(
        (
          context,
          lambda,
          executePublishEvent,
          dbPool,
          hatchetClient,
          randomUUID,
          matchGlobPattern,
          and,
          eq,
          desc,
          eventRoutingRuleTable,
          workflowTable,
          workflowRunTable,
        ) => {
          // biome-ignore lint/suspicious/noExplicitAny: Grafast plan function signature
          return function plan(_$root: any, fieldArgs: any) {
            const $input = fieldArgs.get("input");
            const $observer = context().get("observer");
            const $db = context().get("db");

            // Use lambda to combine values and execute the mutation
            const $result = lambda(
              [$input, $observer, $db],
              // biome-ignore lint/suspicious/noExplicitAny: Grafast lambda callback
              (values: any) =>
                executePublishEvent(
                  values[0] as PublishEventInput,
                  values[1] as SelectUser | null,
                  dbPool,
                  hatchetClient,
                  randomUUID,
                  matchGlobPattern,
                  and,
                  eq,
                  desc,
                  eventRoutingRuleTable,
                  workflowTable,
                  workflowRunTable,
                ),
              true, // isSyncAndSafe = false for async
            );

            return $result;
          };
        },
        [
          context,
          lambda,
          executePublishEvent,
          dbPool,
          hatchetClient,
          randomUUID,
          matchGlobPattern,
          and,
          eq,
          desc,
          eventRoutingRuleTable,
          workflowTable,
          workflowRunTable,
        ],
      ),
    },
  },
}));

export default PublishEventPlugin;
