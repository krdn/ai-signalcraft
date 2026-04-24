# apps/whisper-worker — YouTube 자막 대체용 전사 서비스
# 루트에서 빌드: docker build -f apps/whisper-worker/Dockerfile -t ais-whisper-worker:latest .
#
# 기능: BullMQ `whisper` 큐 consumer. yt-dlp로 오디오 다운로드 → faster-whisper 전사
# → videos.transcript UPDATE.

FROM node:24-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY apps/whisper-worker/package.json ./apps/whisper-worker/
COPY packages/core/package.json ./packages/core/
COPY packages/collectors/package.json ./packages/collectors/
RUN pnpm install --frozen-lockfile --filter @ai-signalcraft/whisper-worker...

FROM node:24-slim AS runtime
# 시스템 의존성: python3 + pip + ffmpeg (faster-whisper가 내부적으로 사용) + tini
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    tini \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성: faster-whisper + yt-dlp + curl-cffi (impersonation)
# PEP 668 bypass — 컨테이너이므로 안전
# yt-dlp는 빈번히 업데이트되고 PyPI가 이전 버전을 금방 삭제하므로 상한 느슨하게.
# curl-cffi는 0.15에서 yt-dlp와 non-compatible이라 <0.15 핀 유지.
RUN pip install --break-system-packages --no-cache-dir \
    "faster-whisper==1.2.*" \
    "yt-dlp[default]>=2026.3" \
    "curl-cffi>=0.10,<0.15"

# 모델은 첫 호출 시 HuggingFace에서 자동 다운로드됨 (/root/.cache/huggingface).
# 빌드 시 미리 받아 이미지 안에 포함 — cold start 제거, 오프라인 실행 가능.
# 모델 크기: small ~500MB int8
RUN python3 -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/whisper-worker/node_modules ./apps/whisper-worker/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/whisper-worker ./apps/whisper-worker
COPY packages/core ./packages/core
COPY packages/collectors ./packages/collectors

RUN npm install -g tsx

ENV NODE_ENV=production
# Whisper 실행 기본값 (docker-compose에서 override 가능)
ENV WHISPER_MODEL=small
ENV WHISPER_LANGUAGE=ko
ENV WHISPER_THREADS=8
ENV WHISPER_CONCURRENCY=1

ENTRYPOINT ["tini", "--"]
CMD ["tsx", "apps/whisper-worker/src/index.ts"]
