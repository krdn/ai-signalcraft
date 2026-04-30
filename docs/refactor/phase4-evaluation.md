# Phase 4 (packages/core 분할) 진입 평가

**작성일**: 2026-04-30
**평가 결과**: **Phase 4 연기** — db-schema 분리 이득 < 비용. 대신 순환 의존 정리가 우선.

---

## 측정 자료

| 항목                               | 측정값            | 마스터플랜 기준 | 판정     |
| ---------------------------------- | ----------------- | --------------- | -------- |
| `packages/core` 빌드 시간 (tsc)    | **7.0초**         | 10초 초과       | ❌       |
| `apps/collector` 빌드 시간 (tsc)   | 7.1초             | —               | 정상     |
| `apps/web` 빌드 시간 (Next.js)     | 37.3초            | —               | 정상     |
| db schema 디렉토리 라인 수         | 2,027줄 (15 파일) | —               | 중간     |
| web에서 core import 라인           | 65건              | —               | —        |
| web에서 schema-only import 파일 수 | 19개 (~30%)       | —               | 부분     |
| 30일 schema 변경 commit 수         | 35건              | —               | **활발** |
| 30일 변경된 schema 파일 수         | 15개 (전체)       | —               | 광범위   |
| `madge --circular` 결과            | **6 사이클**      | 분리 시 0       | ⚠️       |

### 순환 의존 6건 (db-schema와 무관)

```
1) pipeline/control.ts > pipeline/pipeline-checks.ts
2) analysis/pipeline-orchestrator.ts > analysis/map-reduce.ts > analysis/runner.ts
3) analysis/manipulation/types.ts > analysis/manipulation/signals/media-sync.ts
   > analysis/manipulation/signals/similarity.ts
4) analysis/manipulation/types.ts > analysis/manipulation/signals/media-sync.ts
5) analysis/manipulation/types.ts > analysis/manipulation/signals/trend-shape.ts
6) analysis/manipulation/types.ts > analysis/manipulation/signals/vote.ts
```

모두 `analysis/` 또는 `pipeline/` 도메인 내부. db-schema 분리로 해소되지 않음.

---

## 결론

### Phase 4 db-schema 분리 — **연기**

**근거**:

1. **빌드 시간 이득 측정 어려움**
   - core 7초 / collector 7초 / web 37초 — db-schema 분리해도 핵심 빌드 의미 있게 줄지 않음
   - Next.js 빌드 시간(37초)이 전체 병목인데 이는 schema 분리와 무관

2. **schema 변경 활발 — 분리 비용 ↑**
   - 30일간 35 commit, 15개 schema 파일 변경
   - 분리 시 schema 변경마다 web/core/collector 3 패키지 lockstep 업데이트 필요
   - 현재 monorepo 구조에서는 1 PR로 끝나는 작업이 3 PR 협응으로 증가

3. **schema-only import 19개 (~30%)** — 분리 이득 측정 가능하지만 운영 부담을 정당화할 정도는 아님

4. **마스터플랜 "세 답이 모두 아니오면 연기" 조건 충족**:
   - Q1: core 빌드 시간 10초 초과? → **아니오** (7초)
   - Q2: 순환 의존이 코드 변경을 막고 있는가? → **부분 — db-schema 분리로 해소 안 됨**
   - Q3: schema 변경 시 web/worker 동시 재빌드가 실측 부담? → **아니오** (모두 7~37초 범위)

### 대신 우선해야 할 작업: **순환 의존 정리**

발견된 6건의 순환 의존은 db-schema 분리와 무관하지만, 향후 어떤 분리든 막는 진짜 장애물입니다.

**우선순위 추정**:

| 사이클                                        | 영향도                   | 정리 비용                              |
| --------------------------------------------- | ------------------------ | -------------------------------------- |
| `pipeline-orchestrator → map-reduce → runner` | 🔴 high (분석 핵심 흐름) | 중 — runner의 dual import 분리 필요    |
| `pipeline/control ↔ pipeline-checks`          | 🟡 medium (큐/취소 흐름) | 낮 — 함수 1~2개 이동으로 해소 가능     |
| `manipulation/types ↔ signals/*` (4건)        | 🟢 low (타입 import만)   | 낮 — `import type` 또는 type 분리 파일 |

manipulation 4건은 type-only import이므로 `import type`으로 변경하면 빌드 시 사이클이 사라집니다 (TypeScript가 erased).

### 후속 spec 권장

**`docs/refactor/circular-deps.md`** — 6건 사이클의 원인 분석 + 해소 전략. db-schema 분리보다 이쪽이 코드 모듈성에 더 큰 영향.

---

## 재평가 트리거

다음 조건 중 하나가 발생하면 Phase 4 재평가:

1. core 빌드 시간이 15초 이상으로 증가
2. schema 변경 시 web/worker 빌드 시간 합산이 1분 이상
3. 다른 프로젝트가 schema만 가져갈 수요 발생
4. analysis/ 도메인이 별도 패키지로 분리 가능해진 시점 (현재는 21K줄로 비현실적)

## Sources

- 마스터플랜: `docs/refactor/00-master-plan.md` Phase 4 섹션
- 측정 도구: `madge@8.0.0` (npx 1회용)
