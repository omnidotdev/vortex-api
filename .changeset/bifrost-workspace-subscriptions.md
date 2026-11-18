---
"@omnidotdev/vortex-api": minor
---

Seed `bifrost-entitlements` and `bifrost-idp-org-deleted` event subscriptions at boot, delivering `aether.entitlement.*` to Bifrost's `/webhooks/billing` and `gatekeeper.organization.deleted` to its `/webhooks/idp`, so Bifrost workspace plan changes and workspace deletions reach it. Signed with `BIFROST_BILLING_WEBHOOK_SECRET` / `BIFROST_IDP_WEBHOOK_SECRET` (each must equal Bifrost's); each is seeded only when `BIFROST_API_URL` and its secret are set.
