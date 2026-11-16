---
"@omnidotdev/vortex-api": minor
---

Seed a `herald-marketing-consent` event subscription that delivers `platform.consent.changed` to Herald's `/webhooks/consent`, so a `marketing_email` opt-out made on any surface suppresses the user's address. Signed with `MARKETING_CONSENT_WEBHOOK_SECRET` (must equal Herald's); seeded only when both it and `HERALD_API_URL` are set.
