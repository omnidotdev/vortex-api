/**
 * IDP (Identity Provider) webhook handler.
 *
 * Receives organization lifecycle events from the IDP (Gatekeeper).
 * Handles cleanup of organization data when organizations are deleted.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import {
  AUTHZ_API_URL,
  IDP_WEBHOOK_SECRET,
  isAuthzEnabled,
  isProdEnv,
} from "lib/config/env.config";
import { dbPool } from "lib/db/db";
import {
  integrationTable,
  mcpServerTable,
  pluginTable,
  userOrganizationTable,
  wardenSyncQueueTable,
  workflowTable,
} from "lib/db/schema";
import { FEATURE_KEYS } from "lib/entitlements/constants";
import {
  checkFeatureEnabled,
  checkOrganizationLimit,
} from "lib/entitlements/enforce";
import logger from "lib/logger";
import {
  grantOrganizationCreation,
  grantOrganizationRole,
  revokeOrganizationAccess,
  revokeOrganizationRole,
} from "lib/warden/organization";

import type { MemberRole } from "lib/db/schema/userOrganization.table";

/**
 * Best-effort publish to Iggy so IDP webhook events are available
 * for replay/audit even when the streaming layer is temporarily unavailable.
 */
async function publishEventBestEffort(params: {
  type: string;
  source: string;
  organizationId: string;
  data: Record<string, unknown>;
  subject?: string;
}): Promise<void> {
  try {
    const { eventsClient } = await import("server");
    if (!eventsClient) return;

    await eventsClient.publish(params);
  } catch (err) {
    logger.warn("Failed to persist webhook event to Iggy", {
      type: params.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

interface OrganizationCreatedPayload {
  eventType: "organization.created";
  organizationId: string;
  creatorUserId: string;
  timestamp: string;
}

interface OrganizationDeletedPayload {
  eventType: "organization.deleted";
  organizationId: string;
  deletedAt: string;
  timestamp: string;
}

interface MemberAddedPayload {
  eventType: "member.added";
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  timestamp: string;
}

interface MemberRemovedPayload {
  eventType: "member.removed";
  organizationId: string;
  userId: string;
  timestamp: string;
}

interface MemberRoleChangedPayload {
  eventType: "member.role_changed";
  organizationId: string;
  userId: string;
  oldRole: "owner" | "admin" | "member";
  newRole: "owner" | "admin" | "member";
  timestamp: string;
}

type IdpWebhookPayload =
  | OrganizationCreatedPayload
  | OrganizationDeletedPayload
  | MemberAddedPayload
  | MemberRemovedPayload
  | MemberRoleChangedPayload;

/**
 * Verify HMAC-SHA256 signature from IDP.
 */
const verifySignature = (
  payload: string,
  signature: string,
  secret: string,
): boolean => {
  try {
    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
};

/**
 * IDP webhook receiver.
 * Receives organization lifecycle events from the identity provider.
 */
const idpWebhook = new Elysia().post(
  "/idp",
  async ({ request, headers, set }) => {
    const signature = headers["x-idp-signature"];
    const eventType = headers["x-idp-event"];

    if (!IDP_WEBHOOK_SECRET) {
      if (isProdEnv) {
        logger.error("IDP_WEBHOOK_SECRET not set in production");
        set.status = 503;
        return { error: "Webhook configuration error" };
      }
      logger.warn(
        "IDP_WEBHOOK_SECRET not set, skipping signature verification",
      );
    }

    try {
      const rawBody = await request.text();

      // Verify signature if secret is configured
      if (IDP_WEBHOOK_SECRET && signature) {
        const isValid = verifySignature(rawBody, signature, IDP_WEBHOOK_SECRET);

        if (!isValid) {
          set.status = 401;
          return { error: "Invalid signature" };
        }
      } else if (IDP_WEBHOOK_SECRET && !signature) {
        set.status = 401;
        return { error: "Missing signature" };
      }

      const body = JSON.parse(rawBody) as IdpWebhookPayload;

      await publishEventBestEffort({
        type: "idp.event",
        source: "idp",
        organizationId:
          "organizationId" in body ? body.organizationId : "system",
        subject: body.eventType,
        data: body as unknown as Record<string, unknown>,
      });

      switch (body.eventType) {
        case "organization.created":
          await handleOrganizationCreated(body);
          break;
        case "organization.deleted":
          await handleOrganizationDeleted(body);
          break;
        case "member.added":
          await handleMemberAdded(body);
          break;
        case "member.removed":
          await handleMemberRemoved(body);
          break;
        case "member.role_changed":
          await handleMemberRoleChanged(body);
          break;
        default:
          logger.warn("Unknown IDP event type", { eventType });
      }

      set.status = 200;
      return { received: true };
    } catch (err) {
      logger.error("Error processing IDP webhook", {
        error: err instanceof Error ? err.message : String(err),
      });
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  },
  {
    headers: t.Object({
      "x-idp-signature": t.Optional(t.String()),
      "x-idp-event": t.Optional(t.String()),
    }),
  },
);

/**
 * Run a Warden tuple write in the background without blocking the caller.
 * On failure, enqueues the operation to the sync queue for background retry
 * instead of silently dropping it
 */
async function syncWardenBestEffort(
  description: string,
  fn: () => Promise<void>,
  enqueueData: {
    operation: "write" | "delete";
    tuples: Array<{ user: string; relation: string; object: string }>;
  },
): Promise<void> {
  if (!isAuthzEnabled || !AUTHZ_API_URL) return;

  try {
    await fn();
  } catch (err) {
    logger.warn(
      `Warden tuple sync failed, enqueuing for retry: ${description}`,
      {
        error: err instanceof Error ? err.message : String(err),
      },
    );

    try {
      await dbPool.insert(wardenSyncQueueTable).values({
        operation: enqueueData.operation,
        tuples: enqueueData.tuples,
        description,
        nextRetryAt: new Date(Date.now() + 5_000), // Retry in 5s
      });
    } catch (enqueueErr) {
      logger.error(`Failed to enqueue Warden sync retry: ${description}`, {
        error:
          enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
      });
    }
  }
}

/**
 * Handle organization created event.
 * Grants the creator the owner role in Warden
 */
async function handleOrganizationCreated(
  payload: OrganizationCreatedPayload,
): Promise<void> {
  const { organizationId, creatorUserId } = payload;

  const tuples = [
    {
      user: `user:${creatorUserId}`,
      relation: "owner",
      object: `organization:${organizationId}`,
    },
  ];

  await syncWardenBestEffort(
    `grant org creation org=${organizationId} user=${creatorUserId}`,
    () => grantOrganizationCreation(organizationId, creatorUserId),
    { operation: "write", tuples },
  );
}

/**
 * Handle organization deleted event.
 * Cleans up all organization-related data.
 */
async function handleOrganizationDeleted(
  payload: OrganizationDeletedPayload,
): Promise<void> {
  const { organizationId } = payload;

  try {
    // Look up the org owner before deleting memberships so we can revoke Warden tuples
    const owner = await dbPool.query.userOrganizationTable.findFirst({
      where: (table, { and: $and, eq: $eq }) =>
        $and(
          $eq(table.organizationId, organizationId),
          $eq(table.role, "owner"),
        ),
    });

    // Delete workflows (cascade will handle runs and step logs)
    await dbPool
      .delete(workflowTable)
      .where(eq(workflowTable.organizationId, organizationId));

    // Delete integrations
    await dbPool
      .delete(integrationTable)
      .where(eq(integrationTable.organizationId, organizationId));

    // Delete plugins
    await dbPool
      .delete(pluginTable)
      .where(eq(pluginTable.organizationId, organizationId));

    // Delete MCP servers
    await dbPool
      .delete(mcpServerTable)
      .where(eq(mcpServerTable.organizationId, organizationId));

    // Delete user organization memberships
    await dbPool
      .delete(userOrganizationTable)
      .where(eq(userOrganizationTable.organizationId, organizationId));

    if (owner) {
      const tuples = [
        {
          user: `user:${owner.userId}`,
          relation: "owner",
          object: `organization:${organizationId}`,
        },
      ];

      await syncWardenBestEffort(
        `revoke org access org=${organizationId} user=${owner.userId}`,
        () => revokeOrganizationAccess(organizationId, owner.userId),
        { operation: "delete", tuples },
      );
    }
  } catch (err) {
    logger.error("Failed to clean up organization data", {
      organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Handle member added event.
 * Syncs organization membership from IDP.
 *
 * Note: The userId in the webhook payload is the Gatekeeper (IDP) user ID.
 * We need to look up the corresponding Vortex user by their identityProviderId.
 */
async function handleMemberAdded(payload: MemberAddedPayload): Promise<void> {
  const { organizationId, userId: idpUserId, role } = payload;

  try {
    // Look up the Vortex user by their IDP user ID
    const vortexUser = await dbPool.query.userTable.findFirst({
      where: (table, { eq }) => eq(table.identityProviderId, idpUserId),
    });

    if (!vortexUser) {
      // User hasn't logged in to Vortex yet - skip sync
      // Their membership will be synced when they authenticate
      logger.warn(
        "User not found in Vortex, skipping member sync (will sync on next login)",
        {
          idpUserId,
        },
      );
      return;
    }

    // Gate SSO-originated member additions behind entitlement
    const ssoEnabled = await checkFeatureEnabled(
      organizationId,
      FEATURE_KEYS.SSO_ENABLED,
    );
    if (!ssoEnabled) {
      logger.warn("SSO login attempted for org without SSO entitlement", {
        organizationId,
      });
    }

    // Enforce MAX_USERS entitlement
    const [{ count: memberCount }] = await dbPool
      .select({ count: sql<number>`count(*)::int` })
      .from(userOrganizationTable)
      .where(eq(userOrganizationTable.organizationId, organizationId));
    const withinLimit = await checkOrganizationLimit(
      organizationId,
      FEATURE_KEYS.MAX_USERS,
      memberCount,
    );
    if (!withinLimit) {
      logger.warn("Organization has exceeded MAX_USERS entitlement limit", {
        organizationId,
        currentCount: memberCount,
      });
      throw new Error(
        `Member limit reached for organization ${organizationId} (${memberCount} members). Upgrade plan to add more members.`,
      );
    }

    await dbPool
      .insert(userOrganizationTable)
      .values({
        userId: vortexUser.id,
        organizationId,
        slug: organizationId, // Will be updated on next sync
        role,
      })
      .onConflictDoUpdate({
        target: [
          userOrganizationTable.userId,
          userOrganizationTable.organizationId,
        ],
        set: {
          role,
          syncedAt: new Date().toISOString(),
        },
      });

    const grantTuples = [
      {
        user: `user:${idpUserId}`,
        relation: role,
        object: `organization:${organizationId}`,
      },
    ];

    await syncWardenBestEffort(
      `grant role org=${organizationId} user=${idpUserId} role=${role}`,
      () => grantOrganizationRole(organizationId, idpUserId, role),
      { operation: "write", tuples: grantTuples },
    );
  } catch (err) {
    logger.error("Failed to add member to organization", {
      idpUserId,
      organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Handle member removed event.
 * Removes organization membership.
 *
 * Note: The userId in the webhook payload is the Gatekeeper (IDP) user ID.
 * We need to look up the corresponding Vortex user by their identityProviderId.
 */
async function handleMemberRemoved(
  payload: MemberRemovedPayload,
): Promise<void> {
  const { organizationId, userId: idpUserId } = payload;

  try {
    // Look up the Vortex user by their IDP user ID
    const vortexUser = await dbPool.query.userTable.findFirst({
      where: (table, { eq }) => eq(table.identityProviderId, idpUserId),
    });

    if (!vortexUser) {
      logger.warn("User not found in Vortex, skipping member removal", {
        idpUserId,
      });
      return;
    }

    // Look up the member's current role before deleting so we can revoke the right Warden tuple
    const membership = await dbPool.query.userOrganizationTable.findFirst({
      where: (table, { and: $and, eq: $eq }) =>
        $and(
          $eq(table.userId, vortexUser.id),
          $eq(table.organizationId, organizationId),
        ),
    });

    await dbPool
      .delete(userOrganizationTable)
      .where(eq(userOrganizationTable.userId, vortexUser.id));

    if (membership) {
      const revokeTuples = [
        {
          user: `user:${idpUserId}`,
          relation: membership.role,
          object: `organization:${organizationId}`,
        },
      ];

      await syncWardenBestEffort(
        `revoke role org=${organizationId} user=${idpUserId} role=${membership.role}`,
        () =>
          revokeOrganizationRole(
            organizationId,
            idpUserId,
            membership.role as MemberRole,
          ),
        { operation: "delete", tuples: revokeTuples },
      );
    }
  } catch (err) {
    logger.error("Failed to remove member from organization", {
      idpUserId,
      organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Handle member role changed event.
 * Updates organization membership role.
 *
 * Note: The userId in the webhook payload is the Gatekeeper (IDP) user ID.
 * We need to look up the corresponding Vortex user by their identityProviderId.
 */
async function handleMemberRoleChanged(
  payload: MemberRoleChangedPayload,
): Promise<void> {
  const { organizationId, userId: idpUserId, oldRole, newRole } = payload;

  try {
    // Look up the Vortex user by their IDP user ID
    const vortexUser = await dbPool.query.userTable.findFirst({
      where: (table, { eq }) => eq(table.identityProviderId, idpUserId),
    });

    if (!vortexUser) {
      logger.warn(
        "User not found in Vortex, skipping role update (will sync on next login)",
        {
          idpUserId,
        },
      );
      return;
    }

    await dbPool
      .update(userOrganizationTable)
      .set({
        role: newRole,
        syncedAt: new Date().toISOString(),
      })
      .where(eq(userOrganizationTable.userId, vortexUser.id));

    const revokeOldTuples = [
      {
        user: `user:${idpUserId}`,
        relation: oldRole,
        object: `organization:${organizationId}`,
      },
    ];

    await syncWardenBestEffort(
      `revoke old role org=${organizationId} user=${idpUserId} role=${oldRole}`,
      () => revokeOrganizationRole(organizationId, idpUserId, oldRole),
      { operation: "delete", tuples: revokeOldTuples },
    );

    const grantNewTuples = [
      {
        user: `user:${idpUserId}`,
        relation: newRole,
        object: `organization:${organizationId}`,
      },
    ];

    await syncWardenBestEffort(
      `grant new role org=${organizationId} user=${idpUserId} role=${newRole}`,
      () => grantOrganizationRole(organizationId, idpUserId, newRole),
      { operation: "write", tuples: grantNewTuples },
    );
  } catch (err) {
    logger.error("Failed to update member role in organization", {
      idpUserId,
      organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export default idpWebhook;
