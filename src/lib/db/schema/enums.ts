import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Organization type enum.
 */
export const organizationType = pgEnum("organization_type", [
  "personal",
  "team",
]);

/**
 * Member role enum for user permissions within an organization.
 */
export const memberRole = pgEnum("member_role", ["owner", "admin", "member"]);

// Note: triggerType and workflowStatus are now text columns for flexibility
// (allows adding new types without migrations)

// Note: runStatus and stepStatus are now text columns for flexibility
// Common values: pending, running, completed, failed, cancelled, skipped
