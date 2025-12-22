import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Workspace tier enum for subscription levels.
 * Kept as enum since it's tied to Stripe pricing tiers.
 */
export const tier = pgEnum("tier", ["free", "basic", "team"]);

/**
 * Workspace role enum for user permissions within a workspace.
 * Kept as enum since it's core to the permission model.
 */
export const workspaceRole = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
]);

// Note: triggerType and workflowStatus are now text columns for flexibility
// (allows adding new types without migrations)

// Note: runStatus and stepStatus are now text columns for flexibility
// Common values: pending, running, completed, failed, cancelled, skipped
