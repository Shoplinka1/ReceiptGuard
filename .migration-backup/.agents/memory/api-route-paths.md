---
name: API Route Path Strategy
description: How Express routes are registered vs. mounted — critical for avoiding double /api/api prefix.
---

Routes in all route files use the FULL path including /api prefix (e.g. router.get('/api/receipts', ...)).
app.ts mounts the router at root: app.use(router) — NOT app.use('/api', router).

**Why:** Routes were written with /api/ prefix already included. Mounting at /api caused /api/api/... double prefix and all endpoints became unreachable.

**How to apply:** Any new route file should start paths with /api/... (e.g. router.get('/api/myroute', ...)). Never change app.ts to mount at /api.
