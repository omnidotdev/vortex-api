<div align="center">

# Vortex API

GraphQL + REST API for Vortex

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE.md)

</div>

Backend service for [Vortex](https://github.com/omnidotdev/vortex), exposing a GraphQL schema (PostGraphile + Grafast) for workflow CRUD and a REST API for triggers, runs, and authorization. Built with Elysia and Drizzle on PostgreSQL.

## Setup

```sh
cp .env.local.template .env.local   # fill in values
bun src/scripts/generateTlsCert.ts  # generate TLS certificates
bun i
bun db:setup                        # first-time only
bun db:migrate
bun dev
```

Or run `tilt up` from the [metarepo](https://github.com/omnidotdev/vortex).

## Commands

| Command | Description |
|---------|-------------|
| `bun dev` | Start dev server |
| `bun build` | Build for production |
| `bun test` | Run tests |
| `bun test:watch` | Run tests in watch mode |
| `bun test:coverage` | Run tests with coverage |
| `bun lint` | Lint with Biome |
| `bun format` | Format with Biome |

### Database

| Command | Description |
|---------|-------------|
| `bun db:setup` | Create the database (first-time setup) |
| `bun db:generate` | Generate migration files from schema changes |
| `bun db:migrate` | Run pending migrations |
| `bun db:migrate:drop` | Drop a migration |
| `bun db:seed` | Seed database |
| `bun db:studio` | Open Drizzle Studio |

## Documentation

For detailed documentation, visit [omni.dev/grid/vortex](https://omni.dev/grid/vortex).

## License

The code in this repository is licensed under Apache 2.0, &copy; [Omni LLC](https://omni.dev). See [LICENSE.md](LICENSE.md) for more information.
