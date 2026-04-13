import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

/**
 * OAuth State table for CSRF protection during OAuth flow.
 * States are short-lived (10 min TTL) and deleted after use.
 */
export const oauthStateTable = pgTable(
  "oauth_state",
  {
    id: generateDefaultId(),
    /** Random 32-byte state parameter for CSRF protection */
    state: text().notNull(),
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),
    /** OAuth provider identifier (github, discord, slack, google) */
    provider: text().notNull(),
    /** Integration definition ID to create integration for */
    definitionId: text().notNull(),
    /** Encrypted PKCE code verifier (for providers that require PKCE) */
    codeVerifier: text(),
    /** PKCE code challenge (SHA256 hash of verifier, base64url encoded) */
    codeChallenge: text(),
    /** Redirect URI used for this authorization request */
    redirectUri: text().notNull(),
    /** Requested OAuth scopes */
    scopes: text().array().notNull(),
    /** URL to redirect user to after OAuth completes */
    returnUrl: text(),
    /** State expiration (10 minutes from creation) */
    expiresAt: timestamp({
      precision: 6,
      mode: "string",
      withTimezone: true,
    }).notNull(),
    /** Timestamp */
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex("oauth_state_state_idx").on(table.state),
    index("oauth_state_organization_id_idx").on(table.organizationId),
    index("oauth_state_provider_idx").on(table.provider),
    index("oauth_state_expires_at_idx").on(table.expiresAt),
  ],
);
