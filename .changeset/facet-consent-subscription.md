---
"@omnidotdev/vortex-api": minor
---

feat(subscriptions): deliver platform consent changes to Facet

Seeds a system subscription that forwards `platform.consent.changed` (from omni-api) to Facet's `/webhooks/consent`, so a user's AI-training consent withdrawal on any surface erases the samples Facet retained. Signed with the shared `CONSENT_WEBHOOK_SECRET`; skipped when `FACET_API_URL` or the secret is unset.
