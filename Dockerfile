FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build for production
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "preview"]
