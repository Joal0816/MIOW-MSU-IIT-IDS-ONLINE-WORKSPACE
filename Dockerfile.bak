# ── Stage 1: Build ─────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app

ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_GOOGLE_API_KEY
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_API_KEY=$VITE_GOOGLE_API_KEY

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
