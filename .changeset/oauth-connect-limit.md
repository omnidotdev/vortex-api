---
"@omnidotdev/vortex-api": patch
---

Connecting an integration over OAuth no longer requires SSO, so Free and Pro workspaces can connect integrations. Connections count against the plan's connected-account limit, checked both when the connection starts and before it is saved, and require workspace admin, matching integrations added by hand.

Add `POST /api/v1/oauth/:provider/authorize-url`, which takes the caller's credentials in the Authorization header and returns `{ url }`, the provider authorization URL to navigate to. Browser clients use it because a page navigation cannot send an Authorization header. `GET /api/v1/oauth/:provider/authorize` still redirects for API-key clients
