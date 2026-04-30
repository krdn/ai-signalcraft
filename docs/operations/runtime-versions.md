# 런타임 버전 매트릭스

이 프로젝트의 Node.js, pnpm, Docker 베이스 이미지 버전 정합성 기준.

## 현재 기준

| 항목        | 버전              | 위치                                                                        |
| ----------- | ----------------- | --------------------------------------------------------------------------- |
| Node.js     | `24.x` (24.14.1+) | `.nvmrc`, `package.json#engines.node`                                       |
| pnpm        | `10.28.x`         | `package.json#packageManager`, `package.json#engines.pnpm`                  |
| Docker base | `node:24-slim`    | `Dockerfile`, `apps/collector/Dockerfile`, `apps/whisper-worker/Dockerfile` |

## 변경 절차

Node 메이저 버전을 올릴 때 (예: 24 → 26):

1. **로컬 검증**
   - `nvm install <new-version>` 후 `nvm use`
   - `pnpm install --frozen-lockfile` 통과
   - `pnpm -r build` PASS
   - `pnpm -r test` PASS

2. **Dockerfile 동기화** — 다음 3개 파일 모두 동일 버전으로:
   - `/Dockerfile`
   - `/apps/collector/Dockerfile`
   - `/apps/whisper-worker/Dockerfile`

3. **메타 파일 업데이트**:
   - `.nvmrc`
   - `package.json#engines.node` 범위
   - 본 문서

4. **CI 검증**: PR 단계에서 빌드 + 테스트 통과 확인

5. **운영 배포 시 주의**:
   - Native 의존성 재컴파일 필요 (sharp, esbuild 등 — `pnpm.onlyBuiltDependencies`)
   - Docker 이미지 캐시 무효화로 빌드 시간 5~10분 증가

## pnpm 버전 변경

`packageManager` 필드는 corepack과 연동됨. 메이저 변경 시:

- `package.json#packageManager` 업데이트
- `package.json#engines.pnpm` 범위 업데이트
- lockfile 호환성 검증 (`pnpm install`)

## 호환성 노트

- Native 의존성: `pnpm.onlyBuiltDependencies`에 명시된 `esbuild`, `msgpackr-extract`, `sharp`는 Node ABI 변경 시 재빌드 필요
- React 19 + Next.js 16: Node 22+ 권장, 본 프로젝트는 24로 통일
- Drizzle 0.40: Node 18+ 호환, 24에서 동작 확인됨
