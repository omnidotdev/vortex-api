# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base
WORKDIR /app

# Build
FROM base AS builder
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
RUN bun run src/scripts/cacheSchemaHash.ts

# Run
FROM base AS runner
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src ./src
RUN rm -rf src/__tests__ src/scripts
COPY --from=builder /app/.cache ./.cache

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app && \
    chown -R app:app /app
USER app

EXPOSE 4222
CMD ["bun", "run", "start"]
