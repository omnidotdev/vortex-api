import { and, eq, inArray } from "drizzle-orm";

import {
  AETHER_IDP_WEBHOOK_SECRET,
  BIFROST_API_URL,
  BIFROST_BILLING_WEBHOOK_SECRET,
  BIFROST_IDP_WEBHOOK_SECRET,
  BILLING_BASE_URL,
  CHRONICLE_API_URL,
  CHRONICLE_WEBHOOK_SECRET,
  CONSENT_SOURCES_WEBHOOK_SECRET,
  CONSENT_WEBHOOK_SECRET,
  CRYSTAL_API_URL,
  CRYSTAL_IDP_WEBHOOK_SECRET,
  EYRIE_API_URL,
  EYRIE_IDP_WEBHOOK_SECRET,
  FACET_API_URL,
  FRACTAL_API_URL,
  FRACTAL_IDP_WEBHOOK_SECRET,
  FRACTAL_OPERATOR_WEBHOOK_SECRET,
  FRACTAL_OPERATOR_WEBHOOK_URL,
  HALO_API_URL,
  HALO_IDP_WEBHOOK_SECRET,
  HERALD_API_URL,
  HERALD_IDP_WEBHOOK_SECRET,
  KEYSTONE_API_URL,
  KEYSTONE_IDP_WEBHOOK_SECRET,
  MANTLE_API_URL,
  MANTLE_IDP_WEBHOOK_SECRET,
  MARKETING_CONSENT_WEBHOOK_SECRET,
  MYFI_API_URL,
  MYFI_IDP_WEBHOOK_SECRET,
  MYFI_MANTLE_WEBHOOK_SECRET,
  OMNI_API_URL,
  SIGNET_API_URL,
  SIGNET_IDP_WEBHOOK_SECRET,
  VERIFICATION_WEBHOOK_SECRET,
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

/**
 * Deliver Crystal verification lifecycle events to Herald, which emails the
 * workspace owner(s) on expiry, reminders, approval, and revocation. Signed with
 * VERIFICATION_WEBHOOK_SECRET, which must equal Herald's VERIFICATION_WEBHOOK_SECRET.
 * payloadMode "envelope" so Herald reads the CloudEvents type/subject/data directly
 */
const heraldVerificationSubscription = () => ({
  name: "herald-crystal-verification",
  description:
    "Deliver crystal.organization_verification.* to Herald for owner email",
  sourcePattern: "omni.crystal",
  typePattern: "crystal.organization_verification.*",
  targetUrl: `${HERALD_API_URL}/webhooks/verification`,
  hmacSecret: VERIFICATION_WEBHOOK_SECRET as string,
  signatureHeader: "x-vortex-signature",
  payloadMode: "envelope",
  transform: null,
});

/**
 * Deliver platform consent changes to Facet, which erases a user's stored AI
 * training samples when they withdraw consent on any surface (e.g. the account
 * hub). omni-api is the authoritative ledger and the producer (source
 * omni.platform); Facet keys its data on the same identity-provider subject.
 * Signed with CONSENT_WEBHOOK_SECRET, which must equal Facet's
 * CONSENT_WEBHOOK_SECRET. payloadMode "envelope" so Facet reads the CloudEvents
 * type/subject/data directly
 */
const facetConsentSubscription = () => ({
  name: "facet-platform-consent",
  description:
    "Deliver platform.consent.changed to Facet for AI-training sample erasure on withdrawal",
  sourcePattern: "omni.platform",
  typePattern: "platform.consent.changed",
  targetUrl: `${FACET_API_URL}/webhooks/consent`,
  hmacSecret: CONSENT_WEBHOOK_SECRET as string,
  signatureHeader: "x-vortex-signature",
  payloadMode: "envelope",
  transform: null,
});

/**
 * Deliver platform consent changes to Herald, which enforces a marketing_email
 * opt-out by suppressing the user's address tenant-wide (non-destructive).
 * omni-api is the authoritative ledger and the producer (source omni.platform);
 * Herald resolves the subject to its email via Gatekeeper, since it keys on
 * address. Signed with MARKETING_CONSENT_WEBHOOK_SECRET, which must equal
 * Herald's MARKETING_CONSENT_WEBHOOK_SECRET. payloadMode "envelope" so Herald
 * reads the CloudEvents type/subject/data directly
 */
const heraldMarketingConsentSubscription = () => ({
  name: "herald-marketing-consent",
  description:
    "Deliver platform.consent.changed to Herald for marketing_email opt-out suppression",
  sourcePattern: "omni.platform",
  typePattern: "platform.consent.changed",
  targetUrl: `${HERALD_API_URL}/webhooks/consent`,
  hmacSecret: MARKETING_CONSENT_WEBHOOK_SECRET as string,
  signatureHeader: "x-vortex-signature",
  payloadMode: "envelope",
  transform: null,
});

/**
 * Deliver the marketing consent sources to omni-api, the authoritative consent
 * ledger, so every surface where a person opts in or out of Omni product
 * marketing lands in one place:
 * - `gatekeeper.user.created` carries the sign-up checkbox
 *   (`marketingConsentAccepted`); omni-api records a `signup` grant only when
 *   the person has no `marketing_email` record yet
 * - `herald.contact.unsubscribed` carries an email unsubscribe; omni-api
 *   records an `email_unsubscribe` withdrawal only for the Omni marketing
 *   tenant and audience
 *
 * Both go to `/webhooks/consent-sources`, signed `x-vortex-signature` with
 * CONSENT_SOURCES_WEBHOOK_SECRET, which must equal omni-api's
 * CONSENT_SOURCES_WEBHOOK_SECRET. payloadMode "envelope" so omni-api reads the
 * CloudEvents type/source/subject/data directly
 */
export const consentSourcesSubscriptions = ({
  apiUrl,
  secret,
}: {
  apiUrl: string;
  secret: string;
}) => {
  const targetUrl = `${apiUrl.replace(/\/+$/, "")}/webhooks/consent-sources`;

  return [
    {
      name: "omni-api-consent-signup",
      description:
        "Deliver gatekeeper.user.created to omni-api to record a sign-up marketing_email opt-in",
      sourcePattern: "omni.gatekeeper",
      typePattern: "gatekeeper.user.created",
      targetUrl,
      hmacSecret: secret,
      signatureHeader: "x-vortex-signature",
      payloadMode: "envelope",
      transform: null,
    },
    {
      name: "omni-api-consent-email-unsubscribe",
      description:
        "Deliver herald.contact.unsubscribed to omni-api to record a marketing_email withdrawal",
      sourcePattern: "omni.herald",
      typePattern: "herald.contact.unsubscribed",
      targetUrl,
      hmacSecret: secret,
      signatureHeader: "x-vortex-signature",
      payloadMode: "envelope",
      transform: null,
    },
  ];
};

/**
 * JSONata transform: Aether entitlement CloudEvent envelope to the flat billing
 * webhook shape Bifrost's /webhooks/billing dispatches on. Envelope mode so the
 * `eventType` (`entitlement.updated` / `entitlement.deleted`) derives from the
 * CloudEvent type; the event data carries no organization id, only the billing
 * account and the app, so the receiver filters on `productId`
 */
export const BIFROST_ENTITLEMENT_TRANSFORM = [
  "{",
  '  "eventType": $substringAfter(type, "aether."),',
  '  "entityType": "billingAccount",',
  '  "entityId": data.billingAccountId,',
  '  "productId": data.appId,',
  '  "featureKey": data.featureKey,',
  '  "value": data.value,',
  '  "version": data.version,',
  '  "timestamp": time,',
  '  "billingAccountId": data.billingAccountId',
  "}",
].join("\n");

/**
 * JSONata transform: Gatekeeper organization.deleted envelope to the flat shape
 * Bifrost's /webhooks/idp dispatches on (`eventType`, `organizationId`)
 */
export const BIFROST_ORG_DELETED_TRANSFORM = [
  "{",
  '  "eventType": "organization.deleted",',
  '  "organizationId": data.organizationId,',
  '  "deletedAt": time,',
  '  "timestamp": time',
  "}",
].join("\n");

/**
 * Deliver plan changes and workspace deletions to Bifrost. Aether
 * `aether.entitlement.*` goes to /webhooks/billing (signed `x-billing-signature`
 * with Bifrost's BILLING_WEBHOOK_SECRET) so a plan change drops the cached plan
 * limits; Gatekeeper `gatekeeper.organization.deleted` goes to /webhooks/idp
 * (signed `x-idp-signature` with Bifrost's AUTH_WEBHOOK_SECRET) so a deleted
 * workspace's connectors, targets, ingest keys and metrics are removed. A
 * subscription whose secret is unset is left out
 */
export const bifrostSubscriptions = ({
  apiUrl,
  billingSecret,
  idpSecret,
}: {
  apiUrl: string;
  billingSecret?: string;
  idpSecret?: string;
}) => [
  ...(billingSecret
    ? [
        {
          name: "bifrost-entitlements",
          description:
            "Deliver aether.entitlement.* to Bifrost to refresh workspace plan limits",
          sourcePattern: "omni.aether",
          typePattern: "aether.entitlement.*",
          targetUrl: `${apiUrl}/webhooks/billing`,
          hmacSecret: billingSecret,
          signatureHeader: "x-billing-signature",
          payloadMode: "envelope",
          transform: BIFROST_ENTITLEMENT_TRANSFORM,
        },
      ]
    : []),
  ...(idpSecret
    ? [
        {
          name: "bifrost-idp-org-deleted",
          description:
            "Deliver gatekeeper.organization.deleted to Bifrost to remove the workspace's data",
          sourcePattern: "omni.gatekeeper",
          typePattern: "gatekeeper.organization.deleted",
          targetUrl: `${apiUrl}/webhooks/idp`,
          hmacSecret: idpSecret,
          signatureHeader: "x-idp-signature",
          payloadMode: "envelope",
          transform: BIFROST_ORG_DELETED_TRANSFORM,
        },
      ]
    : []),
];

/**
 * JSONata transform: a Gatekeeper identity event envelope to the flat shape
 * the `/webhooks/idp` receivers dispatch on. `eventType` drops the
 * `gatekeeper.` prefix (`organization.deleted`, `member.removed`,
 * `user.deleted`); ids the event does not carry are omitted
 */
export const IDP_EVENT_TRANSFORM = [
  "{",
  '  "eventType": $substringAfter(type, "gatekeeper."),',
  '  "organizationId": data.organizationId,',
  '  "userId": data.userId,',
  '  "timestamp": time',
  "}",
].join("\n");

/**
 * Deliver Gatekeeper identity events to a product's `/webhooks/idp`, one
 * subscription per event type, signed `x-idp-signature` with the product's
 * secret
 */
const idpSubscriptions = ({
  product,
  apiUrl,
  secret,
  events,
}: {
  product: string;
  apiUrl: string;
  secret: string;
  events: { type: string; purpose: string }[];
}) =>
  events.map(({ type, purpose }) => ({
    name: `${product}-idp-${type.replace(/^gatekeeper\./, "").replace(/\./g, "-")}`,
    description: `Deliver ${type} to ${product} to ${purpose}`,
    sourcePattern: "omni.gatekeeper",
    typePattern: type,
    targetUrl: `${apiUrl}/webhooks/idp`,
    hmacSecret: secret,
    signatureHeader: "x-idp-signature",
    payloadMode: "envelope",
    transform: IDP_EVENT_TRANSFORM,
  }));

/**
 * Keystone: a deleted workspace's sites and data are deleted, and form
 * submission emails stop when the member they go to leaves the workspace or
 * deletes their account. The secret is keystone-api's AUTH_WEBHOOK_SECRET
 */
export const keystoneSubscriptions = ({
  apiUrl,
  secret,
}: {
  apiUrl: string;
  secret: string;
}) =>
  idpSubscriptions({
    product: "keystone",
    apiUrl,
    secret,
    events: [
      {
        type: "gatekeeper.organization.deleted",
        purpose: "delete the workspace's sites and data",
      },
      {
        type: "gatekeeper.member.removed",
        purpose: "stop form emails to a member who left",
      },
      {
        type: "gatekeeper.user.deleted",
        purpose: "stop form emails to a deleted account",
      },
    ],
  });

/**
 * Herald: a workspace's Team audience follows its members, so a member who
 * joins is added and one who leaves is removed straight away (Herald also
 * re-syncs hourly as a backstop). The Omni marketing audience follows each
 * account: an email change moves the person's contact to the new address and
 * a deleted account's contact is removed. The secret is herald-api's
 * IDP_WEBHOOK_SECRET, the same one its workspace-deletion delivery uses
 */
export const heraldMemberSubscriptions = ({
  apiUrl,
  secret,
}: {
  apiUrl: string;
  secret: string;
}) =>
  idpSubscriptions({
    product: "herald",
    apiUrl: apiUrl.replace(/\/+$/, ""),
    secret,
    events: [
      {
        type: "gatekeeper.member.added",
        purpose: "add a new member to the workspace's Team audience",
      },
      {
        type: "gatekeeper.member.removed",
        purpose: "remove a departed member from the workspace's Team audience",
      },
      {
        type: "gatekeeper.user.updated",
        purpose: "move the account's Omni marketing contact to its new email",
      },
      {
        type: "gatekeeper.user.deleted",
        purpose: "remove the deleted account's Omni marketing contact",
      },
    ],
  });

/**
 * Aether: a deleted account's or workspace's saved cards are removed from
 * Stripe (only the card verification record stays). The secret is
 * aether-api's IDP_WEBHOOK_SECRET
 */
export const aetherSubscriptions = ({
  apiUrl,
  secret,
}: {
  apiUrl: string;
  secret: string;
}) =>
  idpSubscriptions({
    product: "aether",
    apiUrl,
    secret,
    events: [
      {
        type: "gatekeeper.user.deleted",
        purpose: "remove the deleted account's saved cards from Stripe",
      },
      {
        type: "gatekeeper.organization.deleted",
        purpose: "remove the deleted workspace's saved cards from Stripe",
      },
    ],
  });

/**
 * Fractal: a deleted workspace's projects are deleted (services sleep, then
 * the operator purges them). The secret is fractal-api's IDP_WEBHOOK_SECRET
 */
export const fractalSubscriptions = ({
  apiUrl,
  secret,
}: {
  apiUrl: string;
  secret: string;
}) =>
  idpSubscriptions({
    product: "fractal",
    apiUrl,
    secret,
    events: [
      {
        type: "gatekeeper.organization.deleted",
        purpose: "delete the workspace's projects",
      },
    ],
  });

/**
 * Eyrie: a deleted account's circle memberships, locations, and SOS alerts are
 * deleted, and a circle it solely owned passes to an admin or is deleted.
 * Eyrie keeps nothing per workspace, so it gets account deletions only. The
 * secret is eyrie-api's AUTH_WEBHOOK_SECRET
 */
export const eyrieSubscriptions = ({
  apiUrl,
  secret,
}: {
  apiUrl: string;
  secret: string;
}) =>
  idpSubscriptions({
    product: "eyrie",
    apiUrl: apiUrl.replace(/\/+$/, ""),
    secret,
    events: [
      {
        type: "gatekeeper.user.deleted",
        purpose:
          "delete the account's circle memberships, locations, and SOS alerts",
      },
    ],
  });

/**
 * Products whose `/webhooks/idp` deletes what they keep for a deleted
 * workspace, each receiving only `gatekeeper.organization.deleted`. `secret`
 * must equal the product's own identity webhook secret (`receiverSecret`); a
 * product whose URL or secret is unset is left out
 */
export const workspaceDeletionReceivers = () => [
  {
    product: "herald",
    apiUrl: HERALD_API_URL,
    secret: HERALD_IDP_WEBHOOK_SECRET,
    receiverSecret: "IDP_WEBHOOK_SECRET",
    purpose:
      "delete the workspace's tenant, domains, keys, contacts, messages, and suppression list",
  },
  {
    product: "signet",
    apiUrl: SIGNET_API_URL,
    secret: SIGNET_IDP_WEBHOOK_SECRET,
    receiverSecret: "IDP_WEBHOOK_SECRET",
    purpose: "delete the workspace's documents and API keys",
  },
  {
    product: "myfi",
    apiUrl: MYFI_API_URL,
    secret: MYFI_IDP_WEBHOOK_SECRET,
    receiverSecret: "IDP_WEBHOOK_SECRET",
    purpose: "delete the workspace's books and revoke their connections",
  },
  {
    product: "mantle",
    apiUrl: MANTLE_API_URL,
    secret: MANTLE_IDP_WEBHOOK_SECRET,
    receiverSecret: "IDP_WEBHOOK_SECRET",
    purpose: "delete the workspace's clients, catalog, quotes, and invoices",
  },
  {
    product: "crystal",
    apiUrl: CRYSTAL_API_URL,
    secret: CRYSTAL_IDP_WEBHOOK_SECRET,
    receiverSecret: "AUTH_WEBHOOK_SECRET",
    purpose:
      "cancel the workspace's sponsorships and delete its creator page and data",
  },
  {
    product: "halo",
    apiUrl: HALO_API_URL,
    secret: HALO_IDP_WEBHOOK_SECRET,
    receiverSecret: "AUTH_WEBHOOK_SECRET",
    purpose: "cancel the workspace's store subscriptions and delete its stores",
  },
];

/**
 * Seed `<product>-idp-organization-deleted` for each workspace-deletion
 * receiver whose URL and secret are set (see
 * {@link workspaceDeletionReceivers}), warning for the rest
 */
export const workspaceDeletionSubscriptions = (
  receivers: {
    product: string;
    apiUrl?: string;
    secret?: string;
    receiverSecret: string;
    purpose: string;
  }[] = workspaceDeletionReceivers(),
  warn: (message: string) => void = console.warn,
) =>
  receivers.flatMap(({ product, apiUrl, secret, purpose }) => {
    if (!apiUrl || !secret) {
      const name = product.toUpperCase();
      warn(
        `${name}_API_URL / ${name}_IDP_WEBHOOK_SECRET not set, ${product} workspace-deletion delivery disabled`,
      );
      return [];
    }
    return idpSubscriptions({
      product,
      apiUrl: apiUrl.replace(/\/+$/, ""),
      secret,
      events: [{ type: "gatekeeper.organization.deleted", purpose }],
    });
  });

/**
 * JSONata transform: a Mantle CloudEvent envelope to the `{ event, data }` body
 * MyFi's /api/webhooks/mantle dispatches on (`event` is the full CloudEvent
 * type, e.g. `mantle.payment.created`). MyFi verifies the signature over the
 * raw delivered bytes, so key order is free
 */
export const MYFI_MANTLE_TRANSFORM = [
  "{",
  '  "event": type,',
  '  "data": data',
  "}",
].join("\n");

/**
 * Mantle entities MyFi books into a workspace's ledger. One subscription per
 * entity because `matchGlobPattern` treats `*` as `.*`, so a single `mantle.*`
 * would also deliver company, person, product, and numbering events MyFi does
 * not book. Names are stable so re-seeding updates the rows in place; the
 * invoice and quote names match the ones scripts/seedSubscriptions.ts used to
 * register by hand, so those rows are corrected rather than duplicated
 */
export const MYFI_MANTLE_ENTITIES = [
  { entity: "invoice", name: "myfi-mantle-invoices", purpose: "book A/R" },
  {
    entity: "payment",
    name: "myfi-mantle-payments",
    purpose: "book each payment's cash receipt",
  },
  {
    entity: "credit",
    name: "myfi-mantle-credits",
    purpose: "book customer credit issued and applied",
  },
  {
    entity: "quote",
    name: "myfi-mantle-quotes",
    purpose: "audit quote-to-invoice conversions",
  },
] as const;

/**
 * Deliver Mantle ledger events to MyFi, which books invoices, payments, and
 * credits into the workspace's books. Signed `x-webhook-signature` (hex
 * HMAC-SHA256 of the body) with MYFI_MANTLE_WEBHOOK_SECRET, which must equal
 * myfi-api's MANTLE_WEBHOOK_SECRET
 */
export const myfiMantleSubscriptions = ({
  apiUrl,
  secret,
}: {
  apiUrl: string;
  secret: string;
}) =>
  MYFI_MANTLE_ENTITIES.map(({ entity, name, purpose }) => ({
    name,
    description: `Deliver mantle.${entity}.* to MyFi to ${purpose}`,
    sourcePattern: "omni.mantle",
    typePattern: `mantle.${entity}.*`,
    targetUrl: `${apiUrl.replace(/\/+$/, "")}/api/webhooks/mantle`,
    hmacSecret: secret,
    signatureHeader: "x-webhook-signature",
    payloadMode: "envelope",
    transform: MYFI_MANTLE_TRANSFORM,
  }));

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

  if (HERALD_API_URL && VERIFICATION_WEBHOOK_SECRET) {
    subscriptions.push(heraldVerificationSubscription());
  } else {
    console.warn(
      "HERALD_API_URL / VERIFICATION_WEBHOOK_SECRET not set, Crystal verification email delivery disabled",
    );
  }

  if (FACET_API_URL && CONSENT_WEBHOOK_SECRET) {
    subscriptions.push(facetConsentSubscription());
  } else {
    console.warn(
      "FACET_API_URL / CONSENT_WEBHOOK_SECRET not set, Facet consent-withdrawal erasure delivery disabled",
    );
  }

  if (HERALD_API_URL && MARKETING_CONSENT_WEBHOOK_SECRET) {
    subscriptions.push(heraldMarketingConsentSubscription());
  } else {
    console.warn(
      "HERALD_API_URL / MARKETING_CONSENT_WEBHOOK_SECRET not set, Herald marketing_email opt-out delivery disabled",
    );
  }

  if (OMNI_API_URL && CONSENT_SOURCES_WEBHOOK_SECRET) {
    subscriptions.push(
      ...consentSourcesSubscriptions({
        apiUrl: OMNI_API_URL,
        secret: CONSENT_SOURCES_WEBHOOK_SECRET,
      }),
    );
  } else {
    console.warn(
      "OMNI_API_URL / CONSENT_SOURCES_WEBHOOK_SECRET not set, marketing consent source (sign-up opt-in, email unsubscribe) delivery disabled",
    );
  }

  if (
    BIFROST_API_URL &&
    (BIFROST_BILLING_WEBHOOK_SECRET || BIFROST_IDP_WEBHOOK_SECRET)
  ) {
    subscriptions.push(
      ...bifrostSubscriptions({
        apiUrl: BIFROST_API_URL,
        billingSecret: BIFROST_BILLING_WEBHOOK_SECRET,
        idpSecret: BIFROST_IDP_WEBHOOK_SECRET,
      }),
    );
  } else {
    console.warn(
      "BIFROST_API_URL / BIFROST_*_WEBHOOK_SECRET not set, Bifrost billing and workspace-deletion delivery disabled",
    );
  }

  if (KEYSTONE_API_URL && KEYSTONE_IDP_WEBHOOK_SECRET) {
    subscriptions.push(
      ...keystoneSubscriptions({
        apiUrl: KEYSTONE_API_URL,
        secret: KEYSTONE_IDP_WEBHOOK_SECRET,
      }),
    );
  } else {
    console.warn(
      "KEYSTONE_API_URL / KEYSTONE_IDP_WEBHOOK_SECRET not set, Keystone workspace-deletion and member-departure delivery disabled",
    );
  }

  if (BILLING_BASE_URL && AETHER_IDP_WEBHOOK_SECRET) {
    subscriptions.push(
      ...aetherSubscriptions({
        apiUrl: BILLING_BASE_URL.replace(/\/+$/, ""),
        secret: AETHER_IDP_WEBHOOK_SECRET,
      }),
    );
  } else {
    console.warn(
      "BILLING_BASE_URL / AETHER_IDP_WEBHOOK_SECRET not set, removing saved cards on account deletion disabled",
    );
  }

  if (FRACTAL_API_URL && FRACTAL_IDP_WEBHOOK_SECRET) {
    subscriptions.push(
      ...fractalSubscriptions({
        apiUrl: FRACTAL_API_URL,
        secret: FRACTAL_IDP_WEBHOOK_SECRET,
      }),
    );
  } else {
    console.warn(
      "FRACTAL_API_URL / FRACTAL_IDP_WEBHOOK_SECRET not set, Fractal workspace-deletion delivery disabled",
    );
  }

  if (EYRIE_API_URL && EYRIE_IDP_WEBHOOK_SECRET) {
    subscriptions.push(
      ...eyrieSubscriptions({
        apiUrl: EYRIE_API_URL,
        secret: EYRIE_IDP_WEBHOOK_SECRET,
      }),
    );
  } else {
    console.warn(
      "EYRIE_API_URL / EYRIE_IDP_WEBHOOK_SECRET not set, Eyrie account-deletion delivery disabled",
    );
  }

  subscriptions.push(...workspaceDeletionSubscriptions());

  if (MYFI_API_URL && MYFI_MANTLE_WEBHOOK_SECRET) {
    subscriptions.push(
      ...myfiMantleSubscriptions({
        apiUrl: MYFI_API_URL,
        secret: MYFI_MANTLE_WEBHOOK_SECRET,
      }),
    );
  } else {
    console.warn(
      "MYFI_API_URL / MYFI_MANTLE_WEBHOOK_SECRET not set, Mantle to MyFi ledger delivery disabled",
    );
  }

  if (HERALD_API_URL && HERALD_IDP_WEBHOOK_SECRET)
    subscriptions.push(
      ...heraldMemberSubscriptions({
        apiUrl: HERALD_API_URL,
        secret: HERALD_IDP_WEBHOOK_SECRET,
      }),
    );
  else
    console.warn(
      "HERALD_API_URL / HERALD_IDP_WEBHOOK_SECRET not set, Herald team and marketing audience identity delivery disabled",
    );

  return subscriptions;
};

/**
 * Subscriptions this seed deletes at boot: ones registered by hand (or by
 * scripts/seedSubscriptions.ts) that are replaced or no longer needed, so
 * retiring one is a reviewed change here rather than a manual DB edit.
 * `aether-idp` (gatekeeper.user.* to Aether, registered 2026-08) provisioned a
 * user-entity billing account on every sign-up, which no product bills any
 * more, and doubled user.deleted, which aether-idp-user-deleted delivers
 */
export const RETIRED_SUBSCRIPTIONS: readonly string[] = ["aether-idp"];

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

  const retired = await db
    .delete(eventSubscriptionTable)
    .where(
      and(
        inArray(eventSubscriptionTable.name, [...RETIRED_SUBSCRIPTIONS]),
        eq(eventSubscriptionTable.organizationId, organizationId),
      ),
    )
    .returning({ name: eventSubscriptionTable.name });

  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(
    `Seeded ${seeded} event subscriptions${retired.length > 0 ? `, retired ${retired.map((r: { name: string }) => r.name).join(", ")}` : ""}`,
  );
}

export default seedEventSubscriptions;
