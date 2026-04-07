#!/usr/bin/env bash
# ai-insight-engine → ais 단방향 동기화
#
# 사용법:
#   bash scripts/sync-engine.sh [SOURCE_DIR]
#
# 기본 SOURCE_DIR: /home/gon/projects/ai/ai-insight-engine
#
# 동기화 대상:
#   ai-insight-engine/packages/gateway/src → packages/insight-gateway/src
#   ai-insight-engine/packages/engine/src  → packages/insight-engine/src
#
# package.json은 동기화하지 않음 (namespace가 @ai-signalcraft/* 로 다름).
# 동기화 후 자동으로 typecheck + test 실행하여 회귀 감지.

set -euo pipefail

SOURCE_DIR="${1:-/home/gon/projects/ai/ai-insight-engine}"
TARGET_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[sync-engine] ERROR: source not found: $SOURCE_DIR" >&2
  exit 1
fi

GATEWAY_SRC="$SOURCE_DIR/packages/gateway/src"
ENGINE_SRC="$SOURCE_DIR/packages/engine/src"
GATEWAY_DST="$TARGET_DIR/packages/insight-gateway/src"
ENGINE_DST="$TARGET_DIR/packages/insight-engine/src"

if [[ ! -d "$GATEWAY_SRC" ]] || [[ ! -d "$ENGINE_SRC" ]]; then
  echo "[sync-engine] ERROR: source packages missing in $SOURCE_DIR" >&2
  exit 1
fi

echo "[sync-engine] Source: $SOURCE_DIR"
echo "[sync-engine] Target: $TARGET_DIR"
echo

# 1) gateway 동기화
echo "[sync-engine] Sync gateway..."
rsync -av --delete \
  --exclude='*.d.ts' --exclude='*.d.ts.map' --exclude='*.js.map' \
  "$GATEWAY_SRC/" "$GATEWAY_DST/"

# 2) engine 동기화
echo "[sync-engine] Sync engine..."
rsync -av --delete \
  --exclude='*.d.ts' --exclude='*.d.ts.map' --exclude='*.js.map' \
  "$ENGINE_SRC/" "$ENGINE_DST/"

# 3) namespace 패치 — @ai-insight/gateway → @ai-signalcraft/insight-gateway
echo "[sync-engine] Patch import namespaces..."
find "$ENGINE_DST" -name "*.ts" -exec sed -i \
  -e "s|'@ai-insight/gateway'|'@ai-signalcraft/insight-gateway'|g" \
  {} \;

# 4) 검증
cd "$TARGET_DIR"
echo
echo "[sync-engine] Run typecheck..."
pnpm --filter @ai-signalcraft/insight-gateway exec tsc --noEmit
pnpm --filter @ai-signalcraft/insight-engine exec tsc --noEmit
pnpm --filter @ai-signalcraft/core exec tsc --noEmit

echo
echo "[sync-engine] Run tests..."
pnpm --filter @ai-signalcraft/insight-engine test
pnpm --filter @ai-signalcraft/core test

echo
echo "[sync-engine] DONE — sync verified."
