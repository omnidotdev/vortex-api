---
"@omnidotdev/vortex-api": minor
---

Seed identity subscriptions for Keystone and Fractal at boot. Keystone's `/webhooks/idp` gets `gatekeeper.organization.deleted`, `gatekeeper.member.removed`, and `gatekeeper.user.deleted` (a deleted workspace's sites are deleted; form emails stop for a member who left or deleted their account), signed with `KEYSTONE_IDP_WEBHOOK_SECRET`. fractal-api's `/webhooks/idp` gets `gatekeeper.organization.deleted` (a deleted workspace's projects are deleted), signed with `FRACTAL_IDP_WEBHOOK_SECRET`. Each is seeded only when its `*_API_URL` and secret are set.
