---
"@omnidotdev/vortex-api": patch
---

Fix event log retention stalling: events older than the retention window are deleted again. Each cleanup batch now resumes where the previous one stopped and runs as its own short statement, and the event log is vacuumed more often, so cleanup stays fast however much it has already deleted.
