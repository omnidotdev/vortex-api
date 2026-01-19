/**
 * Workspace authorization helpers.
 *
 * Provides functions for managing Warden authorization tuples
 * when creating, updating, or deleting workspaces.
 *
 * Required tuples for workspace creation:
 * 1. workspace:ws_123#organization@organization:org_456 - links workspace to org
 * 2. workspace:ws_123#owner@user:user_789 - sets workspace owner
 *
 * Organization members automatically get workspace access via OpenFGA model:
 * - org owner -> workspace admin
 * - org admin -> workspace admin
 * - org member -> workspace member -> workspace viewer
 */

import { AUTHZ_API_URL } from "lib/config/env.config";
import { deleteTuples, writeTuples } from "./client";

/**
 * Write authorization tuples for a new workspace.
 *
 * Creates the required tuples to:
 * 1. Link the workspace to its organization (enables permission inheritance)
 * 2. Set the creating user as workspace owner
 *
 * @param workspaceId - The ID of the newly created workspace
 * @param organizationId - The organization this workspace belongs to
 * @param creatorUserId - The user who created the workspace (becomes owner)
 */
export async function grantWorkspaceCreation(
  workspaceId: string,
  organizationId: string,
  creatorUserId: string,
): Promise<void> {
  if (!AUTHZ_API_URL) return;

  await writeTuples(AUTHZ_API_URL, [
    // Link workspace to organization - enables org member -> workspace access
    {
      user: `organization:${organizationId}`,
      relation: "organization",
      object: `workspace:${workspaceId}`,
    },
    // Set creator as workspace owner
    {
      user: `user:${creatorUserId}`,
      relation: "owner",
      object: `workspace:${workspaceId}`,
    },
  ]);
}

/**
 * Remove all authorization tuples for a deleted workspace.
 *
 * @param workspaceId - The ID of the workspace being deleted
 * @param organizationId - The organization this workspace belongs to
 * @param ownerUserId - The workspace owner user ID
 */
export async function revokeWorkspaceAccess(
  workspaceId: string,
  organizationId: string,
  ownerUserId: string,
): Promise<void> {
  if (!AUTHZ_API_URL) return;

  await deleteTuples(AUTHZ_API_URL, [
    {
      user: `organization:${organizationId}`,
      relation: "organization",
      object: `workspace:${workspaceId}`,
    },
    {
      user: `user:${ownerUserId}`,
      relation: "owner",
      object: `workspace:${workspaceId}`,
    },
  ]);
}

/**
 * Grant a user a specific role on a workspace.
 *
 * @param workspaceId - The workspace ID
 * @param userId - The user to grant access to
 * @param role - The role to grant: owner, admin, member, viewer
 */
export async function grantWorkspaceRole(
  workspaceId: string,
  userId: string,
  role: "owner" | "admin" | "member" | "viewer",
): Promise<void> {
  if (!AUTHZ_API_URL) return;

  await writeTuples(AUTHZ_API_URL, [
    {
      user: `user:${userId}`,
      relation: role,
      object: `workspace:${workspaceId}`,
    },
  ]);
}

/**
 * Revoke a users role on a workspace.
 *
 * @param workspaceId - The workspace ID
 * @param userId - The user to revoke access from
 * @param role - The role to revoke: owner, admin, member, viewer
 */
export async function revokeWorkspaceRole(
  workspaceId: string,
  userId: string,
  role: "owner" | "admin" | "member" | "viewer",
): Promise<void> {
  if (!AUTHZ_API_URL) return;

  await deleteTuples(AUTHZ_API_URL, [
    {
      user: `user:${userId}`,
      relation: role,
      object: `workspace:${workspaceId}`,
    },
  ]);
}

/**
 * Transfer workspace ownership to a new user.
 *
 * @param workspaceId - The workspace ID
 * @param currentOwnerId - The current owner user ID
 * @param newOwnerId - The new owner user ID
 */
export async function transferWorkspaceOwnership(
  workspaceId: string,
  currentOwnerId: string,
  newOwnerId: string,
): Promise<void> {
  if (!AUTHZ_API_URL) return;

  // Delete old owner tuple and write new one
  await deleteTuples(AUTHZ_API_URL, [
    {
      user: `user:${currentOwnerId}`,
      relation: "owner",
      object: `workspace:${workspaceId}`,
    },
  ]);

  await writeTuples(AUTHZ_API_URL, [
    {
      user: `user:${newOwnerId}`,
      relation: "owner",
      object: `workspace:${workspaceId}`,
    },
  ]);
}
