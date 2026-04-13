import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * User table for workflow automation platform users.
 * Users are created/updated on authentication via OIDC.
 */
export const userTable = pgTable(
  "user",
  {
    id: generateDefaultId(),
    // External ID from identity provider (sub claim from OIDC token)
    identityProviderId: uuid().notNull().unique(),
    email: text().notNull().unique(),
    name: text().notNull(),
    avatarUrl: text(),
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

// Relations are defined in relations.ts to avoid circular imports

export type InsertUser = InferInsertModel<typeof userTable>;
export type SelectUser = InferSelectModel<typeof userTable>;
