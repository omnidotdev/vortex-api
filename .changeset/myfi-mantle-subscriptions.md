---
"@omnidotdev/vortex-api": patch
---

Deliver Mantle invoice, payment, credit, and quote events to MyFi so they are booked into the workspace's ledger. The subscriptions are seeded at boot when `MYFI_API_URL` and `MYFI_MANTLE_WEBHOOK_SECRET` are set, and replace the hand-registered invoice and quote subscriptions, which delivered a body MyFi could not read
