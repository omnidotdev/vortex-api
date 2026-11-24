---
"@omnidotdev/vortex-api": minor
---

Deliver account deletion to Eyrie

When `EYRIE_API_URL` and `EYRIE_IDP_WEBHOOK_SECRET` are set, Vortex seeds `eyrie-idp-user-deleted`, delivering Gatekeeper's `user.deleted` to eyrie-api's `/webhooks/idp` (signed `x-idp-signature`) so a deleted account's circle memberships, locations, and SOS alerts are removed. The secret must equal eyrie-api's `AUTH_WEBHOOK_SECRET`.
