import { boolean, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * User table for workflow automation platform users.
 */
export const userTable = pgTable(
  "user",
  {
    id: generateDefaultId(),
    // External ID used by identity provider (Auth0, Clerk, etc.)
    identityProviderId: uuid().notNull().unique(),
    email: text().notNull().unique(),
    name: text().notNull(),
    avatar: text(),
    // User preferences
    isOnboarded: boolean().default(false).notNull(),
    theme: text().default("system"),
    // Subscription/plan information
    planType: text().default("free").notNull(), // free, pro, enterprise
    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex().on(table.identityProviderId),
    uniqueIndex().on(table.email),
  ],
);

export type InsertUser = InferInsertModel<typeof userTable>;
export type SelectUser = InferSelectModel<typeof userTable>;
