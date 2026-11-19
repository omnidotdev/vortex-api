---
"@omnidotdev/vortex-api": minor
---

Deliver account and workspace deletion to Aether

When `BILLING_BASE_URL` and `AETHER_IDP_WEBHOOK_SECRET` are set, Vortex seeds `aether-idp-user-deleted` and `aether-idp-organization-deleted`, delivering Gatekeeper's `user.deleted` and `organization.deleted` to Aether's `/webhooks/idp` so a deleted account's saved cards are removed from Stripe.
