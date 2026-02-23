# 🌪️ Vortex API

Vortex is a workflow management and automation platform.

## Local Development

First, `cp .env.local.template .env.local` and fill in the values. Then, generate TLS certificates by running `bun src/scripts/generateTlsCert.ts`.

### Building and Running

Install dependencies:

```sh
bun i
```

Set up the database (only required once, to create the database):

```sh
bun db:setup
```

Run database migrations:

```sh
bun db:migrate
```

Run the dev server:

```sh
bun run dev
```

## Deployment

### Health Checks

The API exposes two health check endpoints:

- `GET /health` - Basic liveness check, returns `{ status: "ok", timestamp, service }`
- `GET /ready` - Readiness check including database connectivity, returns 503 if database is unavailable

### Environment Variables

| Variable                | Description                                 | Default                              |
| ----------------------- | ------------------------------------------- | ------------------------------------ |
| `NODE_ENV`              | Environment (`development` or `production`) | -                                    |
| `PORT`                  | Server port                                 | `4000`                               |
| `HOST`                  | Server host                                 | `0.0.0.0`                            |
| `DATABASE_URL`          | PostgreSQL connection string                | -                                    |
| `AUTH_BASE_URL`         | OIDC provider base URL                      | -                                    |
| `CORS_ALLOWED_ORIGINS`  | Comma-separated list of allowed origins     | -                                    |
| `PROTECT_ROUTES`        | Enable route protection                     | `true` in production                 |
| `ENABLE_CRON_SCHEDULER` | Enable/disable cron scheduler               | `true` (set to `"false"` to disable) |
| `STRIPE_API_KEY`        | Stripe API key                              | -                                    |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature secret             | -                                    |

### Cron Scheduler

The cron scheduler runs as part of the API server and checks for scheduled workflows every 60 seconds.

**Multi-instance safe**: Each workflow trigger is protected by a per-workflow distributed lock via Valkey (`SET NX EX` + Lua compare-and-delete release). This ensures exactly one instance triggers each workflow per cycle, even when multiple replicas are running.

- Lock TTL: 90 seconds (slightly longer than the 60s check interval)
- All instances can run with `ENABLE_CRON_SCHEDULER=true` (the default)
- Set `ENABLE_CRON_SCHEDULER=false` to disable the scheduler on specific instances if desired
- Falls back to single-instance mode (no locking) when Valkey is not configured

### Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals for graceful shutdown:

- Stops accepting new connections
- Stops the cron scheduler
- Closes database connections
- Exits cleanly

## License

The code in this repository is licensed under MIT, &copy; [Omni LLC](https://omni.dev). See [LICENSE.md](LICENSE.md) for more information.
