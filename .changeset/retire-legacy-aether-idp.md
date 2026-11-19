---
"@omnidotdev/vortex-api": patch
---

Retire the legacy `aether-idp` subscription

Boot seeding now deletes subscriptions listed in `RETIRED_SUBSCRIPTIONS`. The first is `aether-idp`, a hand-registered `gatekeeper.user.*` delivery to Aether that created an empty user billing account on every sign-up and delivered account deletions twice. `aether-idp-user-deleted` and `aether-idp-organization-deleted` cover deletion.
