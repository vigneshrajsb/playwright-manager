# syntax=docker/dockerfile:1

# ============================================================================
# Base stage - shared between all stages
# ============================================================================
FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ============================================================================
# Dependencies stage - install all dependencies
# ============================================================================
FROM base AS deps

# Copy workspace config and lockfile from repo root
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy all workspace package.json files
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/reporter/package.json ./packages/reporter/
COPY packages/fixture/package.json ./packages/fixture/
COPY packages/eslint-plugin/package.json ./packages/eslint-plugin/

RUN pnpm install --frozen-lockfile

# ============================================================================
# Builder stage - build the application
# ============================================================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY . .

WORKDIR /app/apps/dashboard

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN pnpm build

# ============================================================================
# Runner stage - production image
# ============================================================================
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets (paths must match monorepo structure for standalone output)
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

# Copy drizzle migrations (must be in apps/dashboard to find node_modules)
COPY --from=builder /app/apps/dashboard/drizzle ./apps/dashboard/drizzle
COPY --from=builder /app/apps/dashboard/scripts/migrate.mjs ./apps/dashboard/scripts/migrate.mjs

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/dashboard/server.js"]
