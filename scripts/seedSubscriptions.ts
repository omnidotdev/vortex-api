#!/usr/bin/env bun
/**
 * Seed Event Subscriptions
 *
 * Registers webhook subscriptions so that events routed through Vortex
 * are delivered as HMAC-signed HTTP POSTs to consumer service endpoints.
 *
 * Usage:
 *   VORTEX_API_URL=https://api.vortex.omni.dev \
 *   VORTEX_API_KEY=<key> \
 *   bun run scripts/seedSubscriptions.ts
 */

const {
  VORTEX_API_URL = "http://localhost:4100",
  VORTEX_API_KEY,
  // IDP webhook secrets, sourced from env rather than hardcoded (each must match
  // the consumer service's IDP_WEBHOOK_SECRET). Their subscription is skipped
  // when the secret is unset
  HERALD_IDP_WEBHOOK_SECRET,
  WARDEN_IDP_WEBHOOK_SECRET,
  VORTEX_IDP_WEBHOOK_SECRET,
  // crystal verifies idp webhooks with its existing AUTH_WEBHOOK_SECRET
  CRYSTAL_IDP_WEBHOOK_SECRET,
} = process.env;

if (!VORTEX_API_KEY) {
  console.error("VORTEX_API_KEY is required");
  process.exit(1);
}

/**
 * JSONata transform: Aether entitlement → consumer expected shape.
 */
const entitlementTransform = `{
  "eventType": type,
  "entityType": "billingAccount",
  "entityId": billingAccountId,
  "productId": appId,
  "featureKey": featureKey,
  "value": value,
  "version": version,
  "timestamp": $now(),
  "billingAccountId": billingAccountId
}`;

/**
 * JSONata transform: Gatekeeper IDP → consumer expected shape.
 */
const idpTransform = `$`;

/**
 * JSONata transform: Gatekeeper organization.updated → the flat shape the
 * consumer /idp receivers dispatch on. The default identity transform delivers
 * only event.data (no `eventType`), so inject it explicitly here.
 */
const orgUpdatedTransform = `{
  "eventType": "organization.updated",
  "organizationId": organizationId,
  "name": name,
  "slug": slug,
  "logo": logo,
  "timestamp": $now()
}`;

/**
 * JSONata transform: Gatekeeper organization.deleted → the flat shape the
 * consumer /idp receivers dispatch on. Same reason as orgUpdatedTransform: the
 * identity transform delivers event.data with no top-level `eventType`, so the
 * receivers (which switch on `eventType`) silently no-op. This is why org
 * deletions were not cleaning up downstream data.
 */
const orgDeletedTransform = `{
  "eventType": "organization.deleted",
  "organizationId": organizationId,
  "deletedAt": $now(),
  "timestamp": $now()
}`;

/**
 * JSONata transform for the remaining idp event types (user.*, member.*),
 * which are wildcard subscriptions so the eventType cannot be hardcoded. Runs in
 * envelope mode (payloadMode "envelope") so the CloudEvent `type` is available:
 * derive the flat `eventType` the receivers switch on by stripping the
 * `gatekeeper.` prefix, and flatten every data field these events carry. Fields
 * absent from a given event resolve to null and are ignored by the receiver.
 */
const idpEnvelopeTransform = `{
  "eventType": $substringAfter(type, "gatekeeper."),
  "organizationId": data.organizationId,
  "userId": data.userId,
  "email": data.email,
  "role": data.role,
  "oldRole": data.oldRole,
  "newRole": data.newRole,
  "deletedAt": $now(),
  "timestamp": $now()
}`;

type SubscriptionSeed = {
  name: string;
  typePattern: string;
  targetUrl: string;
  signatureHeader: string;
  hmacSecret: string;
  sourcePattern?: string;
  transform?: string;
  payloadMode?: "data" | "envelope";
};

const subscriptions: SubscriptionSeed[] = [
  // Entitlement subscriptions (Aether → consumers)
  {
    name: "trellis-entitlements",
    typePattern: "aether.entitlement.*",
    targetUrl: "https://api.trellis.omni.dev/webhooks/entitlements",
    signatureHeader: "x-billing-signature",
    hmacSecret: "***REMOVED***",
    transform: entitlementTransform,
  },
  {
    name: "arbor-entitlements",
    typePattern: "aether.entitlement.*",
    targetUrl: "https://api.arbor.omni.dev/webhooks/entitlements",
    signatureHeader: "x-billing-signature",
    hmacSecret: "***REMOVED***",
    transform: entitlementTransform,
  },
  {
    name: "runa-entitlements",
    typePattern: "aether.entitlement.*",
    targetUrl: "https://api.runa.omni.dev/webhooks/entitlements",
    signatureHeader: "x-billing-signature",
    hmacSecret: "***REMOVED***",
    transform: entitlementTransform,
  },
  {
    name: "backfeed-entitlements",
    typePattern: "aether.entitlement.*",
    targetUrl: "https://api.backfeed.omni.dev/webhooks/entitlements",
    signatureHeader: "x-billing-signature",
    hmacSecret: "***REMOVED***",
    transform: entitlementTransform,
  },
  {
    name: "synapse-entitlements",
    typePattern: "aether.entitlement.*",
    targetUrl: "https://api.synapse.omni.dev/webhooks/billing",
    signatureHeader: "x-billing-signature",
    hmacSecret: "***REMOVED***",
    transform: entitlementTransform,
  },
  {
    name: "vortex-entitlements",
    typePattern: "aether.entitlement.*",
    targetUrl: "https://api.vortex.omni.dev/webhooks/entitlements",
    signatureHeader: "x-billing-signature",
    hmacSecret: "***REMOVED***",
    transform: entitlementTransform,
  },

  // IDP subscriptions (Gatekeeper → consumers)
  {
    name: "arbor-idp-org-deleted",
    typePattern: "gatekeeper.organization.deleted",
    targetUrl: "https://api.arbor.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: "***REMOVED***",
    transform: idpTransform,
  },
  {
    name: "arbor-idp-user-deleted",
    typePattern: "gatekeeper.user.deleted",
    targetUrl: "https://api.arbor.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: "***REMOVED***",
    transform: idpTransform,
  },
  // Runa IDP subscriptions
  {
    name: "runa-idp-org-deleted",
    typePattern: "gatekeeper.organization.deleted",
    targetUrl: "https://api.runa.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: "***REMOVED***",
    transform: idpTransform,
  },
  {
    name: "runa-idp-user-deleted",
    typePattern: "gatekeeper.user.deleted",
    targetUrl: "https://api.runa.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: "***REMOVED***",
    transform: idpTransform,
  },
  {
    name: "runa-idp-member-events",
    typePattern: "gatekeeper.member.*",
    targetUrl: "https://api.runa.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: "***REMOVED***",
    transform: idpTransform,
  },

  // Synapse IDP subscriptions
  {
    name: "synapse-idp-org-deleted",
    typePattern: "gatekeeper.organization.deleted",
    targetUrl: "https://api.synapse.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: "***REMOVED***",
    transform: idpTransform,
  },
  {
    name: "synapse-idp-user-deleted",
    typePattern: "gatekeeper.user.deleted",
    targetUrl: "https://api.synapse.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: "***REMOVED***",
    transform: idpTransform,
  },

  // Backfeed IDP subscriptions
  {
    name: "backfeed-idp-org-deleted",
    typePattern: "gatekeeper.organization.deleted",
    targetUrl: "https://api.backfeed.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: "***REMOVED***",
    transform: idpTransform,
  },
  {
    name: "backfeed-idp-user-deleted",
    typePattern: "gatekeeper.user.deleted",
    targetUrl: "https://api.backfeed.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: "***REMOVED***",
    transform: idpTransform,
  },

  // MyFi subscriptions (Mantle → MyFi)
  {
    name: "myfi-mantle-invoices",
    typePattern: "mantle.invoice.*",
    targetUrl: "https://api.myfi.omni.dev/api/webhooks/mantle",
    signatureHeader: "X-Webhook-Signature",
    hmacSecret: "***REMOVED***",
    payloadMode: "data",
  },
  {
    name: "myfi-mantle-quotes",
    typePattern: "mantle.quote.*",
    targetUrl: "https://api.myfi.omni.dev/api/webhooks/mantle",
    signatureHeader: "X-Webhook-Signature",
    hmacSecret: "***REMOVED***",
    payloadMode: "data",
  },

  // Halo catalog projection (Mantle → Halo)
  // envelope mode: Halo's /catalog-sync reads { type, data } to dispatch
  // created/updated/deleted. hmacSecret MUST equal halo-api's
  // CATALOG_WEBHOOK_SECRET env (signed with x-catalog-signature, hex SHA-256).
  {
    name: "halo-catalog-sync",
    typePattern: "mantle.product.*",
    sourcePattern: "omni.mantle",
    targetUrl: "https://api.halo.omni.dev/webhooks/catalog-sync",
    signatureHeader: "x-catalog-signature",
    hmacSecret: "***REMOVED***",
    payloadMode: "envelope",
  },

  // Aether IDP webhook (Gatekeeper → Aether)
  {
    name: "aether-idp",
    typePattern: "gatekeeper.user.*",
    targetUrl: "https://api.billing.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: "***REMOVED***",
    transform: idpTransform,
  },
];

// Org-identity reconcile subscriptions (Gatekeeper organization.updated ->
// herald/warden). Secrets come from env; skip when unset so a local run without
// prod secrets does not register a subscription with an empty secret.
if (HERALD_IDP_WEBHOOK_SECRET) {
  subscriptions.push({
    name: "herald-idp-org-updated",
    typePattern: "gatekeeper.organization.updated",
    targetUrl: "https://api.herald.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: HERALD_IDP_WEBHOOK_SECRET,
    transform: orgUpdatedTransform,
  });
} else {
  console.warn(
    "HERALD_IDP_WEBHOOK_SECRET not set, skipping herald-idp-org-updated",
  );
}

if (WARDEN_IDP_WEBHOOK_SECRET) {
  subscriptions.push({
    name: "warden-idp-org-updated",
    typePattern: "gatekeeper.organization.updated",
    targetUrl: "https://api.access.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: WARDEN_IDP_WEBHOOK_SECRET,
    transform: orgUpdatedTransform,
  });
} else {
  console.warn(
    "WARDEN_IDP_WEBHOOK_SECRET not set, skipping warden-idp-org-updated",
  );
}

if (VORTEX_IDP_WEBHOOK_SECRET) {
  subscriptions.push({
    name: "vortex-idp-org-updated",
    typePattern: "gatekeeper.organization.updated",
    targetUrl: "https://api.vortex.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: VORTEX_IDP_WEBHOOK_SECRET,
    transform: orgUpdatedTransform,
  });
} else {
  console.warn(
    "VORTEX_IDP_WEBHOOK_SECRET not set, skipping vortex-idp-org-updated",
  );
}

if (CRYSTAL_IDP_WEBHOOK_SECRET) {
  subscriptions.push({
    name: "crystal-idp-org-updated",
    typePattern: "gatekeeper.organization.updated",
    targetUrl: "https://api.crystal.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    hmacSecret: CRYSTAL_IDP_WEBHOOK_SECRET,
    transform: orgUpdatedTransform,
  });
} else {
  console.warn(
    "CRYSTAL_IDP_WEBHOOK_SECRET not set, skipping crystal-idp-org-updated",
  );
}

// Every organization.deleted subscription was defined with the identity
// transform, so its consumer silently no-op'd (no top-level eventType). Give
// them all the flat delete shape their receivers expect. Handlers are strictly
// scoped to the deleted org's own id, so this only cleans up that org's data.
for (const sub of subscriptions) {
  if (sub.typePattern === "gatekeeper.organization.deleted") {
    sub.transform = orgDeletedTransform;
  }
}

// The remaining idp subscriptions (user.* and member.* deletes/sync) were also
// left on the identity transform, so their receivers silently no-op'd too.
// Switch them to the envelope transform (derives eventType from the CloudEvent
// type). org.updated/org.deleted are already handled above, so they are skipped.
for (const sub of subscriptions) {
  if (sub.transform === idpTransform) {
    sub.transform = idpEnvelopeTransform;
    sub.payloadMode = "envelope";
  }
}

let upserted = 0;
let failed = 0;

for (const sub of subscriptions) {
  const response = await fetch(
    `${VORTEX_API_URL}/api/v1/subscriptions/${sub.name}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: VORTEX_API_KEY,
      },
      body: JSON.stringify(sub),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(`Failed to upsert ${sub.name}: ${response.status} ${body}`);
    failed++;
  } else {
    const result = (await response.json()) as {
      id: string;
      created: boolean;
      hmacSecret?: string;
    };
    const action = result.created ? "Created" : "Updated";
    console.log(`${action} subscription: ${sub.name} (id: ${result.id})`);
    if (result.created && result.hmacSecret) {
      console.log(`  HMAC secret: ${result.hmacSecret}`);
    }
    console.log(`  → ${sub.targetUrl}`);
    upserted++;
  }
}

console.log(`\nDone: ${upserted} upserted, ${failed} failed`);
