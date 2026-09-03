# ── Stage 1: Build ─────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ── Stage 2: Production ───────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app

COPY --from=builder /app/.output .output

EXPOSE 3000

CMD ["bun", "run", ".output/server/index.mjs"]
