---
"@omnidotdev/vortex-api": minor
---

Seed `omni-api-consent-signup` (`gatekeeper.user.created`) and `omni-api-consent-email-unsubscribe` (`herald.contact.unsubscribed`) event subscriptions that deliver to omni-api's `/webhooks/consent-sources`, so a sign-up marketing opt-in and an email unsubscribe both land in the consent ledger. Signed with `CONSENT_SOURCES_WEBHOOK_SECRET` (must equal omni-api's); seeded only when both it and `OMNI_API_URL` are set. The registered `gatekeeper.user.created` schema now matches what Gatekeeper sends, including `marketingConsentAccepted`.
