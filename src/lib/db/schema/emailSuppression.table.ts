import { pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/** @knipignore */
export const emailSuppressionTable = pgTable(
  "email_suppression",
  {
    id: generateDefaultId(),
    email: text().notNull(),
    reason: text().notNull(),
    source: text(),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex("email_suppression_email_idx").on(table.email),
  ],
);

/** @knipignore */
export type InsertEmailSuppression = InferInsertModel<
  typeof emailSuppressionTable
>;
/** @knipignore */
export type SelectEmailSuppression = InferSelectModel<
  typeof emailSuppressionTable
>;
