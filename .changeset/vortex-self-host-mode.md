---
"@omnidotdev/vortex-api": minor
---

Add single-owner self-host mode (`SELF_HOST_MODE`). When enabled, Vortex runs for one operator who owns everything: authentication resolves to a fixed owner principal (no external Gatekeeper required) and authorization grants (no Warden PDP required), with the owner user and membership seeded on first request. This makes a standalone `run up vortex` fully functional without wiring up external identity and authorization services.

The mode is opt-in and explicit, and is mutually exclusive with a configured Warden PDP (`AUTHZ_API_URL`): the service refuses to boot if both are set, so it can never silently activate on the hosted multi-tenant deploy, where an unconfigured PDP continues to fail closed.
