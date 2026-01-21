/**
 * IDP (Identity Provider) webhook handler.
 *
 * Receives organization lifecycle events from the IDP (Gatekeeper).
 * Handles cleanup of organization data when organizations are deleted.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { IDP_WEBHOOK_SECRET } from "lib/config/env.config";
import { dbPool } from "lib/db/db";
import {
  integrationTable,
  mcpServerTable,
  pluginTable,
  userOrganizationTable,
  workflowTable,
} from "lib/db/schema";

interface OrganizationDeletedPayload {
  eventType: "organization.deleted";
  organizationId: string;
  deletedAt: string;
  timestamp: string;
}

interface MemberAddedPayload {
  eventType: "organization.member.added";
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  timestamp: string;
}

interface MemberRemovedPayload {
  eventType: "organization.member.removed";
  organizationId: string;
  userId: string;
  timestamp: string;
}

interface MemberUpdatedPayload {
  eventType: "organization.member.updated";
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  timestamp: string;
}

type IdpWebhookPayload =
  | OrganizationDeletedPayload
  | MemberAddedPayload
  | MemberRemovedPayload
  | MemberUpdatedPayload;

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
      console.warn(
        "IDP_WEBHOOK_SECRET not set - skipping signature verification",
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

      switch (body.eventType) {
        case "organization.deleted":
          await handleOrganizationDeleted(body);
          break;
        case "organization.member.added":
          await handleMemberAdded(body);
          break;
        case "organization.member.removed":
          await handleMemberRemoved(body);
          break;
        case "organization.member.updated":
          await handleMemberUpdated(body);
          break;
        default:
          console.warn("Unknown IDP event type:", eventType);
      }

      set.status = 200;
      return { received: true };
    } catch (err) {
      console.error("Error processing IDP webhook:", err);
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
 * Handle organization deleted event.
 * Cleans up all organization-related data.
 */
async function handleOrganizationDeleted(
  payload: OrganizationDeletedPayload,
): Promise<void> {
  const { organizationId } = payload;

  try {
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
  } catch (err) {
    console.error(
      "Failed to clean up organization data for",
      organizationId,
      ":",
      err,
    );
    throw err;
  }
}

/**
 * Handle member added event.
 * Syncs organization membership from IDP.
 */
async function handleMemberAdded(payload: MemberAddedPayload): Promise<void> {
  const { organizationId, userId, role } = payload;

  try {
    await dbPool
      .insert(userOrganizationTable)
      .values({
        userId,
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
  } catch (err) {
    console.error(
      "Failed to add member",
      userId,
      "to org",
      organizationId,
      err,
    );
    throw err;
  }
}

/**
 * Handle member removed event.
 * Removes organization membership.
 */
async function handleMemberRemoved(
  payload: MemberRemovedPayload,
): Promise<void> {
  const { organizationId, userId } = payload;

  try {
    await dbPool
      .delete(userOrganizationTable)
      .where(eq(userOrganizationTable.userId, userId));
  } catch (err) {
    console.error(
      "Failed to remove member",
      userId,
      "from org",
      organizationId,
      err,
    );
    throw err;
  }
}

/**
 * Handle member updated event.
 * Updates organization membership role.
 */
async function handleMemberUpdated(
  payload: MemberUpdatedPayload,
): Promise<void> {
  const { organizationId, userId, role } = payload;

  try {
    await dbPool
      .update(userOrganizationTable)
      .set({
        role,
        syncedAt: new Date().toISOString(),
      })
      .where(eq(userOrganizationTable.userId, userId));
  } catch (err) {
    console.error(
      "Failed to update member",
      userId,
      "in org",
      organizationId,
      err,
    );
    throw err;
  }
}

export default idpWebhook;
