# apps/collector — 독립 수집 서비스 이미지
# 루트에서 빌드: docker build -f apps/collector/Dockerfile -t ais-collector:latest .

FROM node:24-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY apps/collector/package.json ./apps/collector/
COPY packages/collectors/package.json ./packages/collectors/
RUN pnpm install --frozen-lockfile --filter @ai-signalcraft/collector...

FROM node:24-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-cjk \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/collector/node_modules ./apps/collector/node_modules
COPY --from=deps /app/packages/collectors/node_modules ./packages/collectors/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/collector ./apps/collector
COPY packages/collectors ./packages/collectors

RUN npm install -g tsx

ENV NODE_ENV=production
ENV PORT=3400
EXPOSE 3400

CMD ["tsx", "apps/collector/src/server/index.ts"]
