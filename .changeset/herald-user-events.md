---
"@omnidotdev/vortex-api": minor
---

Deliver account email changes and deletions to Herald

When `HERALD_API_URL` and `HERALD_IDP_WEBHOOK_SECRET` are set, Vortex also seeds `herald-idp-user-updated` and `herald-idp-user-deleted`, delivering Gatekeeper's `user.updated` and `user.deleted` to Herald's `/webhooks/idp`. Herald moves a person's Omni marketing contact to their new email, and removes it when the account is deleted. Also registers the `gatekeeper.user.updated` event schema.
