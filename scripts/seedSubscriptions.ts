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

type SubscriptionSeed = {
  name: string;
  typePattern: string;
  targetUrl: string;
  signatureHeader: string;
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
    transform: entitlementTransform,
  },
  {
    name: "arbor-entitlements",
    typePattern: "aether.entitlement.*",
    targetUrl: "https://api.arbor.omni.dev/webhooks/entitlements",
    signatureHeader: "x-billing-signature",
    transform: entitlementTransform,
  },
  {
    name: "runa-entitlements",
    typePattern: "aether.entitlement.*",
    targetUrl: "https://api.runa.omni.dev/webhooks/entitlements",
    signatureHeader: "x-billing-signature",
    transform: entitlementTransform,
  },
  {
    name: "backfeed-entitlements",
    typePattern: "aether.entitlement.*",
    targetUrl: "https://api.backfeed.omni.dev/webhooks/entitlements",
    signatureHeader: "x-billing-signature",
    transform: entitlementTransform,
  },
  {
    name: "synapse-entitlements",
    typePattern: "aether.entitlement.*",
    targetUrl: "https://api.synapse.omni.dev/webhooks/billing",
    signatureHeader: "x-billing-signature",
    transform: entitlementTransform,
  },
  {
    name: "vortex-entitlements",
    typePattern: "aether.entitlement.*",
    targetUrl: "https://api.vortex.omni.dev/webhooks/entitlements",
    signatureHeader: "x-billing-signature",
    transform: entitlementTransform,
  },

  // IDP subscriptions (Gatekeeper → consumers)
  {
    name: "arbor-idp-org-deleted",
    typePattern: "gatekeeper.organization.deleted",
    targetUrl: "https://api.arbor.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    transform: idpTransform,
  },
  {
    name: "arbor-idp-user-deleted",
    typePattern: "gatekeeper.user.deleted",
    targetUrl: "https://api.arbor.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    transform: idpTransform,
  },
  // Runa IDP subscriptions
  {
    name: "runa-idp-org-deleted",
    typePattern: "gatekeeper.organization.deleted",
    targetUrl: "https://api.runa.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    transform: idpTransform,
  },
  {
    name: "runa-idp-user-deleted",
    typePattern: "gatekeeper.user.deleted",
    targetUrl: "https://api.runa.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    transform: idpTransform,
  },
  {
    name: "runa-idp-member-events",
    typePattern: "gatekeeper.member.*",
    targetUrl: "https://api.runa.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    transform: idpTransform,
  },

  // Synapse IDP subscriptions
  {
    name: "synapse-idp-org-deleted",
    typePattern: "gatekeeper.organization.deleted",
    targetUrl: "https://api.synapse.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    transform: idpTransform,
  },
  {
    name: "synapse-idp-user-deleted",
    typePattern: "gatekeeper.user.deleted",
    targetUrl: "https://api.synapse.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    transform: idpTransform,
  },

  // Backfeed IDP subscriptions
  {
    name: "backfeed-idp-org-deleted",
    typePattern: "gatekeeper.organization.deleted",
    targetUrl: "https://api.backfeed.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    transform: idpTransform,
  },
  {
    name: "backfeed-idp-user-deleted",
    typePattern: "gatekeeper.user.deleted",
    targetUrl: "https://api.backfeed.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    transform: idpTransform,
  },

  // Aether IDP webhook (Gatekeeper → Aether)
  {
    name: "aether-idp",
    typePattern: "gatekeeper.user.*",
    targetUrl: "https://api.billing.omni.dev/webhooks/idp",
    signatureHeader: "x-idp-signature",
    transform: idpTransform,
  },
];

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
