/**
 * Organization authorization helpers.
 *
 * Provides functions for managing Warden authorization tuples
 * when creating, updating, or deleting organizations.
 *
 * Required tuples for organization creation:
 * 1. organization:org_123#owner@user:user_789 - sets organization owner
 *
 * Organization members automatically get organization access via OpenFGA model:
 * - org owner -> org admin
 * - org admin -> org member
 */

import { AUTHZ_API_URL } from "lib/config/env.config";
import { deleteTuples, writeTuples } from "./client";

import type { MemberRole } from "lib/db/schema/userOrganization.table";

/**
 * Write authorization tuples for a new organization.
 *
 * Creates the required tuples to:
 * 1. Set the creating user as organization owner
 *
 * @param organizationId - The ID of the newly created organization
 * @param creatorUserId - The user who created the organization (becomes owner)
 */
export async function grantOrganizationCreation(
  organizationId: string,
  creatorUserId: string,
): Promise<void> {
  if (!AUTHZ_API_URL) return;

  await writeTuples(AUTHZ_API_URL, [
    {
      user: `user:${creatorUserId}`,
      relation: "owner",
      object: `organization:${organizationId}`,
    },
  ]);
}

/**
 * Remove all authorization tuples for a deleted organization.
 *
 * @param organizationId - The ID of the organization being deleted
 * @param ownerUserId - The organization owner user ID
 */
export async function revokeOrganizationAccess(
  organizationId: string,
  ownerUserId: string,
): Promise<void> {
  if (!AUTHZ_API_URL) return;

  await deleteTuples(AUTHZ_API_URL, [
    {
      user: `user:${ownerUserId}`,
      relation: "owner",
      object: `organization:${organizationId}`,
    },
  ]);
}

/**
 * Grant a user a specific role on an organization.
 *
 * @param organizationId - The organization ID
 * @param userId - The user to grant access to
 * @param role - The role to grant: owner, admin, member
 */
export async function grantOrganizationRole(
  organizationId: string,
  userId: string,
  role: MemberRole,
): Promise<void> {
  if (!AUTHZ_API_URL) return;

  await writeTuples(AUTHZ_API_URL, [
    {
      user: `user:${userId}`,
      relation: role,
      object: `organization:${organizationId}`,
    },
  ]);
}

/**
 * Revoke a users role on an organization.
 *
 * @param organizationId - The organization ID
 * @param userId - The user to revoke access from
 * @param role - The role to revoke: owner, admin, member
 */
export async function revokeOrganizationRole(
  organizationId: string,
  userId: string,
  role: MemberRole,
): Promise<void> {
  if (!AUTHZ_API_URL) return;

  await deleteTuples(AUTHZ_API_URL, [
    {
      user: `user:${userId}`,
      relation: role,
      object: `organization:${organizationId}`,
    },
  ]);
}

/**
 * Collaborators for {@link transferOrganizationOwnership}. Each defaults to the
 * real implementation; tests inject fakes to assert the write-before-delete
 * ordering without hitting Warden.
 */
interface TransferOwnershipDeps {
  authzApiUrl?: string;
  writeTuples?: typeof writeTuples;
  deleteTuples?: typeof deleteTuples;
}

/**
 * Transfer organization ownership to a new user.
 *
 * Writes the new owner tuple first, then removes the old one, so a failure
 * between the two leaves two owners (recoverable) rather than zero owners
 * (catastrophic).
 *
 * @param organizationId - The organization ID
 * @param currentOwnerId - The current owner user ID
 * @param newOwnerId - The new owner user ID
 */
export async function transferOrganizationOwnership(
  organizationId: string,
  currentOwnerId: string,
  newOwnerId: string,
  deps: TransferOwnershipDeps = {},
): Promise<void> {
  const {
    authzApiUrl = AUTHZ_API_URL,
    writeTuples: write = writeTuples,
    deleteTuples: remove = deleteTuples,
  } = deps;

  if (!authzApiUrl) return;

  // Write new owner first, then remove old. If the delete fails we have
  // two owners (recoverable) instead of zero owners (catastrophic)
  await write(authzApiUrl, [
    {
      user: `user:${newOwnerId}`,
      relation: "owner",
      object: `organization:${organizationId}`,
    },
  ]);

  await remove(authzApiUrl, [
    {
      user: `user:${currentOwnerId}`,
      relation: "owner",
      object: `organization:${organizationId}`,
    },
  ]);
}
