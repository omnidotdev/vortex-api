import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

/**
 * Event subscription table for webhook delivery of routed events.
 * Subscribers receive HMAC-signed HTTP POSTs when events match their
 * source/type patterns.
 * @knipignore Used by relations and subscription routes
 */
export const eventSubscriptionTable = pgTable(
  "event_subscription",
  {
    id: generateDefaultId(),
    /** IDP organization ID (from Gatekeeper) */
    organizationId: text().notNull(),

    /** Human-readable subscription name */
    name: text().notNull(),
    /** Optional description */
    description: text(),

    // Event matching patterns (glob-style)
    /** Source pattern to match (e.g., "omni.billing.*") */
    sourcePattern: text(),
    /** Type pattern to match (e.g., "aether.entitlement.*") - required */
    typePattern: text().notNull(),

    // Delivery configuration
    /** HTTPS endpoint to deliver events to */
    targetUrl: text().notNull(),
    /** HMAC-SHA256 signing key */
    hmacSecret: text().notNull(),
    /** Header name for the HMAC signature (configurable for consumer compat) */
    signatureHeader: text().notNull().default("x-vortex-signature"),

    /** JSONata expression to reshape event data before delivery */
    transform: text(),
    /** "data" sends event.data only, "envelope" sends full CloudEvents */
    payloadMode: text().notNull().default("data"),

    // Retry configuration
    /** Maximum delivery retries before moving to DLQ */
    maxRetries: integer().notNull().default(5),
    /** Initial backoff delay in milliseconds */
    initialBackoffMs: integer().notNull().default(1000),
    /** Backoff multiplier for exponential retry */
    backoffMultiplier: integer().notNull().default(2),

    /** Whether this subscription is active */
    enabled: boolean().notNull().default(true),

    // Timestamps
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    index("event_subscription_org_idx").on(table.organizationId),
    index("event_subscription_org_enabled_idx").on(
      table.organizationId,
      table.enabled,
    ),
    uniqueIndex("event_subscription_org_name_uniq").on(
      table.organizationId,
      table.name,
    ),
  ],
);

// Relations are defined in relations.ts to avoid circular imports
