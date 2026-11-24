---
"@omnidotdev/vortex-api": patch
---

Stop rate limiting first-party services by IP

Requests authenticated with the internal service key now skip the 100-per-minute IP rate limit. First-party services reach Vortex through its public URL and share the cluster's egress IP, so one service's burst (Aether's entitlement updates, say) rejected every other service's events with a 429, and those events were dropped. Tenant API keys and sessions are still limited by IP.
