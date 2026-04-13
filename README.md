<div align="center">

# Vortex API

GraphQL + REST API for Vortex

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE.md)

</div>

## Overview

Vortex API is the backend service for [Vortex](https://github.com/omnidotdev/vortex), Omni's workflow automation platform. It exposes a GraphQL schema (PostGraphile + Grafast) for workflow CRUD and a REST API for triggers, runs, and authz operations. Built with Elysia and Drizzle on PostgreSQL.

## Features

- **GraphQL API** - PostGraphile auto-generated schema with Grafast query planning, Relay compliance, and connection filtering
- **REST API** - Endpoints for triggers, workflow runs, dead-letter queue, and authorization
- **Security** - GraphQL Armor, JWT validation with JWKS, CORS, rate limiting, and TLS/HTTPS
- **Database** - Drizzle ORM with automated migrations, seeding, and Drizzle Studio
- **Observability** - OpenTelemetry, health check endpoints (`/health`, `/ready`), graceful shutdown

## Local Development

First, `cp .env.local.template .env.local` and fill in the values. Then, generate TLS certificates by running `bun src/scripts/generateTlsCert.ts`.

### Building and Running

Run `tilt up`, or:

```sh
bun i
bun db:setup    # first-time only
bun db:migrate
bun dev
```

### Database Scripts

| Script | Description |
|--------|-------------|
| `bun db:setup` | Create the database (first-time setup) |
| `bun db:generate` | Generate migration files from schema changes |
| `bun db:migrate` | Run pending migrations |
| `bun db:migrate:drop` | Drop a migration |
| `bun db:pull` | Introspect existing database schema |
| `bun db:push` | Push schema changes directly (dev only) |
| `bun db:seed` | Seed database with test data |
| `bun db:studio` | Open Drizzle Studio |

## Testing

```sh
bun test

# or in watch mode
bun test:watch

# or test with coverage reporting
bun test:coverage
```

## Documentation

- [Vortex Docs](https://docs.omni.dev/core/vortex)

## License

The code in this repository is licensed under Apache 2.0, &copy; [Omni LLC](https://omni.dev). See [LICENSE.md](LICENSE.md) for more information.
