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

**Important for multi-instance deployments**: The scheduler does not have distributed locking. Running multiple instances will cause duplicate workflow triggers.

**Options for multi-instance deployments**:

1. Run the scheduler on only one instance using `ENABLE_CRON_SCHEDULER=false` on other instances
2. Use a single dedicated scheduler instance
3. (Future) Implement distributed locking with Redis

### Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals for graceful shutdown:

- Stops accepting new connections
- Stops the cron scheduler
- Closes database connections
- Exits cleanly

## License

The code in this repository is licensed under MIT, &copy; Omni LLC. See [LICENSE.md](LICENSE.md) for more information.
