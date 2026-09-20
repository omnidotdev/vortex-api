# syntax=docker/dockerfile:1

FROM oven/bun:1.4.0 AS base
WORKDIR /app

# Build
FROM base AS builder
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
# Bust the COPY cache per commit. The operator always builds --cache-from
# <name>:buildcache and injects GIT_SHA; consuming it BEFORE "COPY . ." forces
# COPY to re-copy real source every commit, so a cached layer can never ship an
# image whose code differs from the merged commit (the stale-build class that hit
# vortex-worker and gatekeeper). Must precede COPY: an ARG after it cannot key the
# copy layer
ARG GIT_SHA
RUN echo "source-cache-bust ${GIT_SHA}"
COPY . .
RUN echo "$GIT_SHA" > /app/.git-sha
RUN bun run build
# Guard: bun's bundler can emit an undefined __promiseAll helper for concurrent
# async-module init, crash-looping the server on boot (the 2026-06 aether
# incident). Fail the build before a broken bundle can deploy.
RUN if grep -q '__promiseAll' build/server.js && \
      ! grep -qE '(function|var|let|const) +__promiseAll' build/server.js; then \
      echo 'FATAL: bundle references undefined __promiseAll (bun bundler bug); aborting build'; exit 1; \
    fi
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
