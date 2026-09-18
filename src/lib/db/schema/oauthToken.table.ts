import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { organizationRlsPolicy } from "lib/db/util/rls.util";
import { integrationTable } from "./integration.table";

/**
 * OAuth Token table for storing OAuth2 access and refresh tokens.
 * Tokens are encrypted at rest using AES-256-GCM (via lib/crypto/encryption.ts).
 */
export const oauthTokenTable = pgTable(
  "oauth_token",
  {
    id: generateDefaultId(),
    /** Foreign key to the integration this token belongs to */
    integrationId: uuid()
      .notNull()
      .references(() => integrationTable.id, { onDelete: "cascade" }),
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),
    /** OAuth provider identifier (github, discord, slack, google) */
    provider: text().notNull(),
    /** Encrypted access token */
    accessToken: text().notNull(),
    /** Encrypted refresh token (nullable - not all providers support refresh) */
    refreshToken: text(),
    /** Token type (typically "Bearer") */
    tokenType: text().notNull().default("Bearer"),
    /** Granted OAuth scopes (space-separated) */
    scope: text().notNull(),
    /** Token expiration timestamp (null if token doesn't expire) */
    expiresAt: timestamp({ precision: 6, mode: "string", withTimezone: true }),
    /** Timestamps */
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    index("oauth_token_integration_id_idx").on(table.integrationId),
    index("oauth_token_organization_id_idx").on(table.organizationId),
    index("oauth_token_provider_idx").on(table.provider),
    index("oauth_token_expires_at_idx").on(table.expiresAt),
    organizationRlsPolicy(),
  ],
);
