import { and, eq } from "drizzle-orm";

import {
  CHRONICLE_API_URL,
  CHRONICLE_WEBHOOK_SECRET,
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
const chronicleSubscription = (name: string, product: string) => ({
  name,
  description: `Forward ${product} audit/activity events to Chronicle's ingest endpoint`,
  sourcePattern: `omni.${product}`,
  typePattern: `${product}.*`,
  targetUrl: `${CHRONICLE_API_URL}/ingest/event`,
  hmacSecret: CHRONICLE_WEBHOOK_SECRET,
  // matches Chronicle's expected header and is the column default; set
  // explicitly for clarity
  signatureHeader: "x-vortex-signature",
  payloadMode: "envelope",
  transform: CHRONICLE_TRANSFORM,
});

const buildSubscriptions = () => {
  if (!CHRONICLE_API_URL || !CHRONICLE_WEBHOOK_SECRET) {
    console.warn(
      "CHRONICLE_API_URL / CHRONICLE_WEBHOOK_SECRET not set, Chronicle audit-log subscription disabled",
    );
    return [];
  }

  return [
    // Backfeed keeps the original (un-suffixed) name so its live subscription
    // row is updated in place rather than orphaned and duplicated
    chronicleSubscription("chronicle-audit-log", "backfeed"),
    chronicleSubscription("chronicle-audit-log-runa", "runa"),
  ];
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
