# ---- Base ----
FROM oven/bun:1.3.6 AS base
WORKDIR /app

# ---- Install Dependencies ----
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
ARG APP_VERSION
# Provide a dummy SESSION_SECRET for build (actual secret is provided at runtime)
ENV SESSION_SECRET="build-time-placeholder-secret-32chars"
RUN test -n "$APP_VERSION" && \
    APP_VERSION="${APP_VERSION#v}" && \
    if [ "${#APP_VERSION}" -eq 40 ] && printf '%s' "$APP_VERSION" | grep -Eq '^[0-9a-f]+$'; then \
      APP_VERSION="$(printf '%s' "$APP_VERSION" | cut -c1-7)"; \
    fi && \
    NEXT_PUBLIC_APP_VERSION="$APP_VERSION" bun run build

# ---- Final Image ----
FROM oven/bun:1.3.6-slim AS runner
WORKDIR /app
# Copy standalone build and static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
ENV NODE_ENV=production
USER bun
EXPOSE 3000
# Run Next.js using Bun’s runtime entrypoint
CMD ["bun", "server.js"]
