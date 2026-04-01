---
quick_id: 260326-d4v
status: completed
---

# Quick Task 260326-d4v: API 키 관리와 모듈별 모델 설정 연동

## 변경 사항

### 1. tRPC settings.update provider enum 확장

- `apps/web/src/server/trpc/routers/settings.ts`: provider 입력을 `'anthropic' | 'openai'`에서 모든 프로바이더 타입으로 확장

### 2. model-settings.tsx — 동적 프로바이더/모델 목록

- 하드코딩된 `PROVIDER_MODELS` 상수 제거
- `providerKeys.list` 쿼리 추가하여 등록된 API 키의 프로바이더/모델 정보를 동적으로 구성
- 프로바이더 드롭다운: 활성 API 키가 있는 프로바이더만 표시
- 모델 드롭다운: 해당 프로바이더의 `selectedModel` 값들을 표시
- 등록된 키가 없으면 안내 메시지 표시
- 현재 설정이 등록된 키와 불일치하면 경고 표시

### 3. 타입 통합

- `core/analysis/types.ts`: `AIProvider` 타입을 모든 프로바이더 포함으로 확장, `ProviderType`은 별칭으로 유지
- `ai-gateway/src/gateway.ts`: `AIProvider` 타입 확장 + `DEFAULT_MODELS`를 `Partial`로 변경

## 수정 파일

- `apps/web/src/components/settings/model-settings.tsx`
- `apps/web/src/server/trpc/routers/settings.ts`
- `packages/core/src/analysis/types.ts`
- `packages/ai-gateway/src/gateway.ts`
