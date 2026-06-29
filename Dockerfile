# syntax=docker/dockerfile:1

# ---- Base Node image ----
FROM node:20-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Project is built with pnpm (committed pnpm-lock.yaml v9 + a pnpm-specific
# .npmrc: node-linker=hoisted, package-import-method=copy). pnpm's
# autoInstallPeers resolves the React 19 peer ranges (e.g. vaul) that a strict
# `npm ci` rejects with ERESOLVE.
RUN npm install -g pnpm@9

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app

# Copy manifest + lockfile + .npmrc (the pnpm settings) and install frozen.
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ---- Builder ----
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN pnpm run build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public folder
COPY --from=builder /app/public ./public

# Set correct permissions for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy database migration files (read at runtime by migrate.ts)
COPY --from=builder --chown=nextjs:nodejs /app/lib/db/migrations ./lib/db/migrations

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
