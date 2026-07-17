# ── SalesRx — production Docker image ─────────────────────────────
# Multi-stage build: deps → build → minimal runtime (standalone Next.js)

# Stage 1: install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Stage 2: build the app
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# API keys are runtime-only; nothing secret is needed at build time
RUN npm run build

# Stage 3: minimal runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as non-root
RUN addgroup -S salesrx && adduser -S salesrx -G salesrx

# Standalone output = server + only the node_modules it actually uses
COPY --from=builder --chown=salesrx:salesrx /app/.next/standalone ./
COPY --from=builder --chown=salesrx:salesrx /app/.next/static ./.next/static

# Writable dir for the brief cache + watchlist (mount a volume here to persist)
RUN mkdir -p /app/data && chown salesrx:salesrx /app/data
VOLUME ["/app/data"]

USER salesrx
EXPOSE 3000

CMD ["node", "server.js"]
