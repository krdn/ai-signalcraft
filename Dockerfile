# Multi-stage Dockerfile for AI SignalCraft
# Stage 1: 의존성 설치
FROM node:24-slim AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/collectors/package.json ./packages/collectors/
COPY packages/ai-gateway/package.json ./packages/ai-gateway/
RUN pnpm install --frozen-lockfile

# Stage 2: 빌드
FROM node:24-slim AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/collectors/node_modules ./packages/collectors/node_modules
COPY --from=deps /app/packages/ai-gateway/node_modules ./packages/ai-gateway/node_modules
COPY . .
RUN pnpm build

# Stage 3: Web 실행 (Next.js standalone)
FROM node:24-slim AS web
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# public 디렉토리가 있으면 복사 (없어도 빌드 실패하지 않도록)
RUN mkdir -p ./apps/web/public
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# Stage 4: Worker 실행 (BullMQ)
FROM node:24-slim AS worker
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/collectors/node_modules ./packages/collectors/node_modules
COPY --from=deps /app/packages/ai-gateway/node_modules ./packages/ai-gateway/node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/core/src ./packages/core/src
COPY --from=builder /app/packages/collectors/dist ./packages/collectors/dist
COPY --from=builder /app/packages/collectors/package.json ./packages/collectors/
COPY --from=builder /app/packages/ai-gateway/dist ./packages/ai-gateway/dist
COPY --from=builder /app/packages/ai-gateway/package.json ./packages/ai-gateway/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
# tsx로 워커 실행
RUN npm install -g tsx
ENV NODE_ENV=production
CMD ["tsx", "packages/core/src/queue/worker-process.ts"]
