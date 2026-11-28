# @omnidotdev/vortex-api

## 0.1.0

### Minor Changes

- [#115](https://github.com/omnidotdev/vortex-api/pull/115) [`64d9f91`](https://github.com/omnidotdev/vortex-api/commit/64d9f91c712589c6e3e57931955cd198bf9b4365) Thanks [@coopbri](https://github.com/coopbri)! - Deliver account and workspace deletion to Aether

  When `BILLING_BASE_URL` and `AETHER_IDP_WEBHOOK_SECRET` are set, Vortex seeds `aether-idp-user-deleted` and `aether-idp-organization-deleted`, delivering Gatekeeper's `user.deleted` and `organization.deleted` to Aether's `/webhooks/idp` so a deleted account's saved cards are removed from Stripe.

- [#113](https://github.com/omnidotdev/vortex-api/pull/113) [`5796fbf`](https://github.com/omnidotdev/vortex-api/commit/5796fbf2c27fa2d2661c372f17e799f199dfba38) Thanks [@coopbri](https://github.com/coopbri)! - Seed `bifrost-entitlements` and `bifrost-idp-org-deleted` event subscriptions at boot, delivering `aether.entitlement.*` to Bifrost's `/webhooks/billing` and `gatekeeper.organization.deleted` to its `/webhooks/idp`, so Bifrost workspace plan changes and workspace deletions reach it. Signed with `BIFROST_BILLING_WEBHOOK_SECRET` / `BIFROST_IDP_WEBHOOK_SECRET` (each must equal Bifrost's); each is seeded only when `BIFROST_API_URL` and its secret are set.

- [#126](https://github.com/omnidotdev/vortex-api/pull/126) [`c57f80e`](https://github.com/omnidotdev/vortex-api/commit/c57f80e8a06be8fec2d70182a862e2d87af6d8e7) Thanks [@coopbri](https://github.com/coopbri)! - Seed `omni-api-consent-signup` (`gatekeeper.user.created`) and `omni-api-consent-email-unsubscribe` (`herald.contact.unsubscribed`) event subscriptions that deliver to omni-api's `/webhooks/consent-sources`, so a sign-up marketing opt-in and an email unsubscribe both land in the consent ledger. Signed with `CONSENT_SOURCES_WEBHOOK_SECRET` (must equal omni-api's); seeded only when both it and `OMNI_API_URL` are set. The registered `gatekeeper.user.created` schema now matches what Gatekeeper sends, including `marketingConsentAccepted`.

- [#125](https://github.com/omnidotdev/vortex-api/pull/125) [`7b7874a`](https://github.com/omnidotdev/vortex-api/commit/7b7874a4402a0671d7e2ce919ca0000ed6e7d769) Thanks [@coopbri](https://github.com/coopbri)! - Deliver account deletion to Eyrie

  When `EYRIE_API_URL` and `EYRIE_IDP_WEBHOOK_SECRET` are set, Vortex seeds `eyrie-idp-user-deleted`, delivering Gatekeeper's `user.deleted` to eyrie-api's `/webhooks/idp` (signed `x-idp-signature`) so a deleted account's circle memberships, locations, and SOS alerts are removed. The secret must equal eyrie-api's `AUTH_WEBHOOK_SECRET`.

- [#109](https://github.com/omnidotdev/vortex-api/pull/109) [`168f318`](https://github.com/omnidotdev/vortex-api/commit/168f31832683bab4e6a2a204f785ed3aba08d715) Thanks [@coopbri](https://github.com/coopbri)! - feat(subscriptions): deliver platform consent changes to Facet

  Seeds a system subscription that forwards `platform.consent.changed` (from omni-api) to Facet's `/webhooks/consent`, so a user's AI-training consent withdrawal on any surface erases the samples Facet retained. Signed with the shared `CONSENT_WEBHOOK_SECRET`; skipped when `FACET_API_URL` or the secret is unset.

- [#110](https://github.com/omnidotdev/vortex-api/pull/110) [`67820c4`](https://github.com/omnidotdev/vortex-api/commit/67820c44ba054d1abbf4c623e63623f65742bec4) Thanks [@coopbri](https://github.com/coopbri)! - Seed a `herald-marketing-consent` event subscription that delivers `platform.consent.changed` to Herald's `/webhooks/consent`, so a `marketing_email` opt-out made on any surface suppresses the user's address. Signed with `MARKETING_CONSENT_WEBHOOK_SECRET` (must equal Herald's); seeded only when both it and `HERALD_API_URL` are set.

- [#129](https://github.com/omnidotdev/vortex-api/pull/129) [`26f809a`](https://github.com/omnidotdev/vortex-api/commit/26f809a62f8791bf94351929d3f9441d6e1fc6f1) Thanks [@coopbri](https://github.com/coopbri)! - Deliver account email changes and deletions to Herald

  When `HERALD_API_URL` and `HERALD_IDP_WEBHOOK_SECRET` are set, Vortex also seeds `herald-idp-user-updated` and `herald-idp-user-deleted`, delivering Gatekeeper's `user.updated` and `user.deleted` to Herald's `/webhooks/idp`. Herald moves a person's Omni marketing contact to their new email, and removes it when the account is deleted. Also registers the `gatekeeper.user.updated` event schema.

- [#114](https://github.com/omnidotdev/vortex-api/pull/114) [`038d5a8`](https://github.com/omnidotdev/vortex-api/commit/038d5a817008568550c1e73fedca4f0e5bdbcfec) Thanks [@coopbri](https://github.com/coopbri)! - Seed identity subscriptions for Keystone and Fractal at boot. Keystone's `/webhooks/idp` gets `gatekeeper.organization.deleted`, `gatekeeper.member.removed`, and `gatekeeper.user.deleted` (a deleted workspace's sites are deleted; form emails stop for a member who left or deleted their account), signed with `KEYSTONE_IDP_WEBHOOK_SECRET`. fractal-api's `/webhooks/idp` gets `gatekeeper.organization.deleted` (a deleted workspace's projects are deleted), signed with `FRACTAL_IDP_WEBHOOK_SECRET`. Each is seeded only when its `*_API_URL` and secret are set.

- [#112](https://github.com/omnidotdev/vortex-api/pull/112) [`651cb3a`](https://github.com/omnidotdev/vortex-api/commit/651cb3a764d9280877baa4ab9c25a9d596dfd39b) Thanks [@coopbri](https://github.com/coopbri)! - Added a Synapse integration. Connect your Synapse key once in your workspace integrations and agent and model steps use it by default, with no per-step key needed.

- [#98](https://github.com/omnidotdev/vortex-api/pull/98) [`9836836`](https://github.com/omnidotdev/vortex-api/commit/9836836006a225f8f71a65b6d281524f06bf3a8e) Thanks [@coopbri](https://github.com/coopbri)! - Add single-owner self-host mode: run Vortex on your own for a single owner without setting up separate sign-in or permission services. It is opt-in and cannot be turned on for a shared, multi-workspace setup.

- [#116](https://github.com/omnidotdev/vortex-api/pull/116) [`1c21880`](https://github.com/omnidotdev/vortex-api/commit/1c218807779ade7fce3b1f416dcd7ba89decf37a) Thanks [@coopbri](https://github.com/coopbri)! - Deliver workspace deletion (`gatekeeper.organization.deleted`) to Herald, Signet, MyFi, Mantle, Crystal, and Halo, each seeded as `<product>-idp-organization-deleted` when its `<PRODUCT>_API_URL` and `<PRODUCT>_IDP_WEBHOOK_SECRET` are set

### Patch Changes

- [#132](https://github.com/omnidotdev/vortex-api/pull/132) [`edcd226`](https://github.com/omnidotdev/vortex-api/commit/edcd2260f1587cb626ed1a43a12512dbd8c5aaf6) Thanks [@coopbri](https://github.com/coopbri)! - The production build now runs in production mode, so API errors no longer include internal details and GraphQL runs without development overhead

- [#111](https://github.com/omnidotdev/vortex-api/pull/111) [`54403c0`](https://github.com/omnidotdev/vortex-api/commit/54403c05a59138c3f926f0eb327fc2b9915aa964) Thanks [@coopbri](https://github.com/coopbri)! - Security: internal sync and email suppression records are no longer readable over GraphQL, and shared catalog entries and user records no longer link to other workspaces' integrations, workflows or memberships.

- [#122](https://github.com/omnidotdev/vortex-api/pull/122) [`1225aac`](https://github.com/omnidotdev/vortex-api/commit/1225aacccf3738e74a316bb92897c2db0674f51e) Thanks [@coopbri](https://github.com/coopbri)! - Fix event log retention stalling: events older than the retention window are deleted again. Each cleanup batch now resumes where the previous one stopped and runs as its own short statement, and the event log is vacuumed more often, so cleanup stays fast however much it has already deleted.

- [#118](https://github.com/omnidotdev/vortex-api/pull/118) [`008bbb6`](https://github.com/omnidotdev/vortex-api/commit/008bbb6f1026e29247decaa1ee4670d09e3033ee) Thanks [@coopbri](https://github.com/coopbri)! - Fractal now emails a workspace when a verified custom domain's ownership TXT record goes missing (with the date to restore it by) and when the domain is disconnected after a week without it. The two new events are registered as `fractal.domain.verification_failing` and `fractal.domain.released`.

- [#123](https://github.com/omnidotdev/vortex-api/pull/123) [`4efbb79`](https://github.com/omnidotdev/vortex-api/commit/4efbb792cb408298a4a8cda1c79892a9aac9b9bb) Thanks [@coopbri](https://github.com/coopbri)! - Herald now receives workspace member joins and departures, so a workspace Team audience updates as soon as someone joins or leaves.

- [#106](https://github.com/omnidotdev/vortex-api/pull/106) [`87e2795`](https://github.com/omnidotdev/vortex-api/commit/87e2795dcde59aa2fcd50a1c012267f978746061) Thanks [@coopbri](https://github.com/coopbri)! - Workspace MCP servers now connect over remote transports only (SSE or HTTP), and a server always stays with the workspace that created it.

- [#127](https://github.com/omnidotdev/vortex-api/pull/127) [`12a39f3`](https://github.com/omnidotdev/vortex-api/commit/12a39f399f9a0c15c33bc71a449d6a248bae8cec) Thanks [@coopbri](https://github.com/coopbri)! - Deliver Mantle invoice, payment, credit, and quote events to MyFi so they are booked into the workspace's ledger. The subscriptions are seeded at boot when `MYFI_API_URL` and `MYFI_MANTLE_WEBHOOK_SECRET` are set, and replace the hand-registered invoice and quote subscriptions, which delivered a body MyFi could not read

- [#133](https://github.com/omnidotdev/vortex-api/pull/133) [`8d0d34f`](https://github.com/omnidotdev/vortex-api/commit/8d0d34f54ccbc6b8aa0552201331c0473872674b) Thanks [@coopbri](https://github.com/coopbri)! - Connecting an integration over OAuth no longer requires SSO, so Free and Pro workspaces can connect integrations. Connections count against the plan's connected-account limit, checked both when the connection starts and before it is saved, and require workspace admin, matching integrations added by hand.

  Add `POST /api/v1/oauth/:provider/authorize-url`, which takes the caller's credentials in the Authorization header and returns `{ url }`, the provider authorization URL to navigate to. Browser clients use it because a page navigation cannot send an Authorization header. `GET /api/v1/oauth/:provider/authorize` still redirects for API-key clients

- [#107](https://github.com/omnidotdev/vortex-api/pull/107) [`fe7db9a`](https://github.com/omnidotdev/vortex-api/commit/fe7db9aca290ec3fadbfa98c3e079a6925ed0a0b) Thanks [@coopbri](https://github.com/coopbri)! - Connected apps now run through built-in connectors. Using them as MCP tools is coming soon.

- [#121](https://github.com/omnidotdev/vortex-api/pull/121) [`4360027`](https://github.com/omnidotdev/vortex-api/commit/43600279079f60bd76e2aa70ca34fba740695800) Thanks [@coopbri](https://github.com/coopbri)! - Move to the `@omnidotdev/providers` v0.4.1 release, whose migration runner recognizes this service's existing migration history instead of re-running applied migrations on boot.

- [#117](https://github.com/omnidotdev/vortex-api/pull/117) [`a56e530`](https://github.com/omnidotdev/vortex-api/commit/a56e53010b3c8800a6570ad40032fd4f07f6a14f) Thanks [@coopbri](https://github.com/coopbri)! - Retire the legacy `aether-idp` subscription

  Boot seeding now deletes subscriptions listed in `RETIRED_SUBSCRIPTIONS`. The first is `aether-idp`, a hand-registered `gatekeeper.user.*` delivery to Aether that created an empty user billing account on every sign-up and delivered account deletions twice. `aether-idp-user-deleted` and `aether-idp-organization-deleted` cover deletion.

- [#128](https://github.com/omnidotdev/vortex-api/pull/128) [`79a41a5`](https://github.com/omnidotdev/vortex-api/commit/79a41a5f6617874e18ac2db94b21ac032dd240e8) Thanks [@coopbri](https://github.com/coopbri)! - Stop rate limiting first-party services by IP

  Requests authenticated with the internal service key now skip the 100-per-minute IP rate limit. First-party services reach Vortex through its public URL and share the cluster's egress IP, so one service's burst (Aether's entitlement updates, say) rejected every other service's events with a 429, and those events were dropped. Tenant API keys and sessions are still limited by IP.
