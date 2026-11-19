---
"@omnidotdev/vortex-api": patch
---

Fractal now emails a workspace when a verified custom domain's ownership TXT record goes missing (with the date to restore it by) and when the domain is disconnected after a week without it. The two new events are registered as `fractal.domain.verification_failing` and `fractal.domain.released`.
