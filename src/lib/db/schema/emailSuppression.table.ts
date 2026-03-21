import { pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Global email suppression list.
 * Stores addresses that must never receive email — populated by
 * hard bounces, abuse complaints, and explicit opt-outs.
 */
/** @knipignore - Used by email delivery and webhook handlers */
export const emailSuppressionTable = pgTable(
  "email_suppression",
  {
    id: generateDefaultId(),
    // Suppressed email address
    email: text().notNull().unique(),
    // Suppression reason (e.g. "hard_bounce", "complaint", "manual", "unsubscribe")
    reason: text().notNull(),
    // Where the suppression originated (e.g. "resend_webhook", "admin_ui")
    source: text(),
    createdAt: generateDefaultDate(),
  },
  (table) => [uniqueIndex().on(table.email)],
);

/** @knipignore - Used by email delivery and webhook handlers */
export type InsertEmailSuppression = InferInsertModel<
  typeof emailSuppressionTable
>;
/** @knipignore - Used by email delivery and webhook handlers */
export type SelectEmailSuppression = InferSelectModel<
  typeof emailSuppressionTable
>;
