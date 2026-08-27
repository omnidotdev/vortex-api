import { and, eq } from "drizzle-orm";

import {
  CHRONICLE_API_URL,
  CHRONICLE_WEBHOOK_SECRET,
  FRACTAL_OPERATOR_WEBHOOK_SECRET,
  FRACTAL_OPERATOR_WEBHOOK_URL,
} from "lib/config/env.config";
import { eventSubscriptionTable } from "lib/db/schema";

/**
 * Reshape a product CloudEvent envelope into Chronicle's flat ingest schema.
 * Product-agnostic: `product`/`action` are derived from the `omni.<product>`
 * source and `<product>.<entity>.<verb>` type, so the same transform serves
 * every enriched producer.
 *
 * Notes:
 * - `data.organizationId` (the customer org carried in the event payload) is
 *   used, not the envelope `organizationid` (which is the platform org the
 *   producer's API key resolves to).
 * - `product`/`action` are derived from the `omni.<product>` source and the
 *   `<product>.<entity>.<verb>` type.
 * - actor/resource fields come from the producer-enriched payload; JSONata omits
 *   keys whose value is absent, so system (actorless) events stay valid.
 *
 * IMPORTANT: key order must match Chronicle's ingest `eventPayloadSchema`
 * property order. Chronicle verifies the HMAC over `JSON.stringify` of its
 * Elysia-parsed body, which re-serializes fields in schema order; if this
 * transform emits keys in a different order the signatures will not match and
 * deliveries fail with 401. Do not reorder without updating Chronicle.
 */
const CHRONICLE_TRANSFORM = [
  "{",
  '  "organizationId": data.organizationId,',
  '  "product": $substringAfter(source, "omni."),',
  '  "actorId": data.actorId,',
  '  "actorIdpId": data.actorIdpId,',
  '  "actorName": data.actorName,',
  '  "actorEmail": data.actorEmail,',
  '  "action": $substringAfter(type, $substringAfter(source, "omni.") & "."),',
  '  "resourceType": data.resourceType,',
  '  "resourceId": subject,',
  '  "resourceName": data.resourceName,',
  '  "traceId": correlationid,',
  '  "metadata": data',
  "}",
].join("\n");

/**
 * System webhook subscriptions seeded on startup under the platform
 * organization. Idempotent: matched by (organizationId, name).
 *
 * The Chronicle subscription forwards product audit/activity events to
 * Chronicle's ingest endpoint. It is only seeded when the shared ingest URL and
 * HMAC secret are configured; otherwise it is skipped so Vortex still boots.
 */
/**
 * Build a Chronicle forwarding subscription scoped to a single enriched
 * producer. Only products that enrich their events with actor/resource metadata
 * (via `@omnidotdev/providers` `eventMeta`) should be added here.
 */
const chronicleSubscription = (
  name: string,
  product: string,
  // defaults to the whole product stream; pass a narrower glob to forward only
  // a subset of a product's event types (see Herald below)
  typePattern = `${product}.*`,
) => ({
  name,
  description: `Forward ${product} audit/activity events to Chronicle's ingest endpoint`,
  sourcePattern: `omni.${product}`,
  typePattern,
  targetUrl: `${CHRONICLE_API_URL}/ingest/event`,
  hmacSecret: CHRONICLE_WEBHOOK_SECRET,
  // matches Chronicle's expected header and is the column default; set
  // explicitly for clarity
  signatureHeader: "x-vortex-signature",
  payloadMode: "envelope",
  transform: CHRONICLE_TRANSFORM,
});

/**
 * Herald forwards only its audit event types to Chronicle, NOT its high-volume
 * `herald.message.*` delivery telemetry (up to 1M/mo on Pro), which is delivery
 * data (already in Herald's own store) and would flood the audit log. Because
 * `matchGlobPattern` treats `*` as `.*`, a single `herald.*` cannot exclude
 * `herald.message.*`, so one subscription is seeded per audited entity. Names
 * are stable so re-seeding updates the same rows in place.
 */
export const HERALD_CHRONICLE_SUBSCRIPTIONS = [
  {
    name: "chronicle-audit-log-herald-domains",
    typePattern: "herald.sending_domain.*",
  },
  { name: "chronicle-audit-log-herald-keys", typePattern: "herald.api_key.*" },
] as const;

/**
 * Deliver a Fractal billing event to the operator's webhook so it scales the
 * owner's workspaces to zero (on suspend) or restores them (on resume). The
 * operator does not verify HMAC on these in-cluster routes, but hmacSecret is
 * NOT NULL, so a non-empty secret is still required to sign. payloadMode "data"
 * (the column default) delivers the flat event.data the operator deserializes.
 */
const operatorBillingSubscription = (
  name: string,
  typePattern: string,
  path: string,
) => ({
  name,
  description: `Deliver ${typePattern} to the Fractal operator (${path})`,
  sourcePattern: "omni.aether",
  typePattern,
  targetUrl: `${FRACTAL_OPERATOR_WEBHOOK_URL}${path}`,
  hmacSecret: FRACTAL_OPERATOR_WEBHOOK_SECRET as string,
  signatureHeader: "x-vortex-signature",
  payloadMode: "data",
  transform: null,
});

const buildSubscriptions = () => {
  const subscriptions = [];

  if (CHRONICLE_API_URL && CHRONICLE_WEBHOOK_SECRET) {
    subscriptions.push(
      // Backfeed keeps the original (un-suffixed) name so its live subscription
      // row is updated in place rather than orphaned and duplicated
      chronicleSubscription("chronicle-audit-log", "backfeed"),
      chronicleSubscription("chronicle-audit-log-runa", "runa"),
      ...HERALD_CHRONICLE_SUBSCRIPTIONS.map((sub) =>
        chronicleSubscription(sub.name, "herald", sub.typePattern),
      ),
    );
  } else {
    console.warn(
      "CHRONICLE_API_URL / CHRONICLE_WEBHOOK_SECRET not set, Chronicle audit-log subscription disabled",
    );
  }

  if (FRACTAL_OPERATOR_WEBHOOK_SECRET) {
    subscriptions.push(
      operatorBillingSubscription(
        "fractal-operator-suspend",
        "aether.billing.suspended",
        "/webhooks/billing/suspended",
      ),
      operatorBillingSubscription(
        "fractal-operator-restore",
        "aether.billing.suspension_lifted",
        "/webhooks/billing/suspension-lifted",
      ),
    );
  } else {
    console.warn(
      "FRACTAL_OPERATOR_WEBHOOK_SECRET not set, Fractal operator billing (suspend/restore) delivery disabled",
    );
  }

  return subscriptions;
};

/**
 * Seed system event subscriptions for the platform organization.
 */
// biome-ignore lint/suspicious/noExplicitAny: shared db client type, matches sibling seeds
async function seedEventSubscriptions(db: any, organizationId: string) {
  let seeded = 0;

  for (const subscription of buildSubscriptions()) {
    const existing = await db.query.eventSubscriptionTable.findFirst({
      where: and(
        eq(eventSubscriptionTable.name, subscription.name),
        eq(eventSubscriptionTable.organizationId, organizationId),
      ),
      columns: { id: true },
    });

    if (existing) {
      await db
        .update(eventSubscriptionTable)
        .set({
          description: subscription.description,
          sourcePattern: subscription.sourcePattern,
          typePattern: subscription.typePattern,
          targetUrl: subscription.targetUrl,
          hmacSecret: subscription.hmacSecret,
          signatureHeader: subscription.signatureHeader,
          payloadMode: subscription.payloadMode,
          transform: subscription.transform,
          enabled: true,
        })
        .where(eq(eventSubscriptionTable.id, existing.id));
    } else {
      await db.insert(eventSubscriptionTable).values({
        ...subscription,
        organizationId,
        enabled: true,
      });
    }

    seeded++;
  }

  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(`Seeded ${seeded} event subscriptions`);
}

export default seedEventSubscriptions;
