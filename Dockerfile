# syntax=docker/dockerfile:1

FROM oven/bun:1.3.13 AS base
WORKDIR /app

# Build
FROM base AS builder
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG GIT_SHA
RUN echo "$GIT_SHA" > /app/.git-sha
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
RUN rm -rf src/__tests__
COPY --from=builder /app/.cache ./.cache
COPY --from=builder /app/.git-sha ./.git-sha

RUN chown -R 1001:1001 /app
USER 1001:1001

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:4000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["bun", "run", "start"]
