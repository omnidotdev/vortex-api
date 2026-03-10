import { randomUUID } from "node:crypto";

import { Hatchet } from "@hatchet-dev/typescript-sdk";
import { Client, Connection } from "@temporalio/client";
import { and, desc, eq } from "drizzle-orm";
import { EXPORTABLE } from "graphile-export";
import { GraphQLError } from "graphql";
import { context, lambda } from "postgraphile/grafast";
import { gql, makeExtendSchemaPlugin } from "postgraphile/utils";

import { dbPool } from "lib/db/db";
import {
  eventRoutingRuleTable,
  workflowRunTable,
  workflowTable,
} from "lib/db/schema";
import logger from "lib/logger";

import type { SelectUser } from "lib/db/schema";

// Initialize Hatchet client for workflow triggers
export let hatchetClient: ReturnType<typeof Hatchet.init> | null = null;
try {
  hatchetClient = Hatchet.init();
} catch {
  logger.warn("Hatchet not configured, will try Temporal fallback");
}

// Lazy Temporal client (same pattern as dispatch.ts)
let temporalClientPromise: Promise<Client | null> | null = null;

async function getTemporalClient(): Promise<Client | null> {
  if (!process.env.TEMPORAL_ADDRESS) return null;
  if (!temporalClientPromise) {
    temporalClientPromise = Connection.connect({
      address: process.env.TEMPORAL_ADDRESS,
    })
      .then(
        (connection) =>
          new Client({
            connection,
            namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
          }),
      )
      .catch((err) => {
        temporalClientPromise = null;
        logger.error("Failed to connect to Temporal for event routing", {
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      });
  }
  return temporalClientPromise;
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
    throw new GraphQLError("Unauthorized");
  }

  const membership = await db.query.userOrganizationTable.findFirst({
    where: (table, { and: andFn, eq: eqFn }) =>
      andFn(
        eqFn(table.userId, observer.id),
        eqFn(table.organizationId, organizationId),
      ),
  });

  if (!membership) {
    throw new GraphQLError("Not a member of this organization");
  }

  const temporal = await getTemporalClient();

  if (!hatchet && !temporal) {
    throw new GraphQLError(
      "Event routing is not configured. Ensure Hatchet or Temporal is running.",
    );
  }

  // Generate event ID
  const eventId = generateUUID();

  // Best-effort persist to Iggy so events are available for replay/audit
  // even if the streaming layer is temporarily unavailable
  try {
    const { eventsClient } = await import("server");

    if (eventsClient) {
      await eventsClient.publish({
        type,
        source: "graphql",
        data: data || {},
        organizationId,
        subject: subject ?? undefined,
        correlationId: correlationId ?? undefined,
      });
    }
  } catch (err) {
    logger.warn("Failed to persist event to Iggy", {
      eventId,
      type,
      error: err instanceof Error ? err.message : String(err),
    });
  }

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

      // Trigger execution via Hatchet, fall back to Temporal
      const triggerPayload = {
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
      };

      let dispatched = false;
      if (hatchet) {
        try {
          await hatchet.event.push("workflow:execute", triggerPayload);
          dispatched = true;
        } catch (hatchetErr) {
          logger.warn("Hatchet dispatch failed, trying Temporal fallback", {
            workflowId: workflow.id,
            error:
              hatchetErr instanceof Error
                ? hatchetErr.message
                : String(hatchetErr),
          });
        }
      }

      if (!dispatched && temporal) {
        await temporal.workflow.signalWithStart("workflowExecute", {
          taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? "vortex-workflows",
          workflowId: engineWorkflowId,
          signal: "triggerEvent",
          signalArgs: [triggerPayload],
          args: [triggerPayload],
        });
        dispatched = true;
      }

      if (!dispatched) {
        throw new Error("No executor available");
      }

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
      logger.error("Failed to trigger workflow", {
        workflowId: workflow.id,
        error: err instanceof Error ? err.message : String(err),
      });
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
              false, // async callback
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
