# raw_items 중복 방지 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `raw_items`에 누적되는 중복 행(naver-news 302건)을 차단하고 기존 중복을 정리한다.

**Architecture:** `item-mapper.ts`에서 `publishedAt`이 null일 때 `time`을 **UTC 자정**으로 절삭해 UNIQUE `(source, source_id, item_type, time)`이 같은 날 안에서 일정하게 유지되도록 한다. 기존 중복은 `(source, source_id, item_type)` 그룹에서 `fetched_at` 가장 이른 행만 남기는 정리 스크립트로 처리한다.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL/TimescaleDB, vitest, pnpm, tsx.

**Spec:** `docs/superpowers/specs/2026-04-20-raw-items-dedup-strengthening-design.md`

---

## File Structure

| File                                            | Responsibility                    | Action                      |
| ----------------------------------------------- | --------------------------------- | --------------------------- |
| `apps/collector/src/queue/item-mapper.ts`       | sourceId 생성·필드 매핑·time 산출 | Modify (time 폴백 변경)     |
| `apps/collector/src/queue/item-mapper.test.ts`  | mapToRawItem 단위 테스트          | Modify (1개 교체, 3개 추가) |
| `apps/collector/src/scripts/dedup-raw-items.ts` | 누적된 중복 행 정리 CLI           | Create                      |

변경 파일 3개. DB 스키마·마이그레이션·UNIQUE 인덱스는 건드리지 않는다.

---

### Task 1: `startOfUtcDay` 헬퍼의 실패 테스트 추가

**Files:**

- Test: `apps/collector/src/queue/item-mapper.test.ts`

이 태스크는 "publishedAt이 null이면 time이 UTC 자정이어야 한다"는 계약을 먼저 고정한다.

- [ ] **Step 1: 실패하는 테스트 3개를 추가**

`apps/collector/src/queue/item-mapper.test.ts` 파일을 연다. 기존 `it('publishedAt이 없으면 createdAt → publishDate → timestamp → now 순으로 폴백한다', ...)` 블록 전체를 아래 코드로 **교체**한다. (기존 91~104행)

```typescript
it('publishedAt이 없으면 createdAt → publishDate → timestamp 순으로 폴백한다', () => {
  const rawA = { sourceId: 'a', createdAt: '2026-01-01T00:00:00Z' };
  const rawB = { sourceId: 'b', timestamp: 1704067200000 };

  const a = mapToRawItem(rawA, ctx);
  const b = mapToRawItem(rawB, ctx);

  expect(a.publishedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  expect(b.publishedAt?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
});

it('publishedAt이 모두 null이면 time은 현재 UTC 자정이다', () => {
  const raw = { sourceId: 'no-date' };
  const before = startOfUtcDayForTest(new Date());
  const row = mapToRawItem(raw, ctx);
  const after = startOfUtcDayForTest(new Date());

  expect(row.publishedAt).toBeNull();
  expect(row.time).toBeInstanceOf(Date);
  expect(row.time.getTime()).toBe(before.getTime());
  expect(row.time.getTime()).toBe(after.getTime());
  expect(row.time.getUTCHours()).toBe(0);
  expect(row.time.getUTCMinutes()).toBe(0);
  expect(row.time.getUTCSeconds()).toBe(0);
  expect(row.time.getUTCMilliseconds()).toBe(0);
});

it('publishedAt null 아이템을 연속 호출해도 동일한 UTC day에서는 같은 time을 돌려준다', () => {
  const raw = { sourceId: 'same-id' };
  const row1 = mapToRawItem(raw, ctx);
  const row2 = mapToRawItem(raw, ctx);
  expect(row1.time.getTime()).toBe(row2.time.getTime());
});

it('publishedAt이 유효하면 time은 publishedAt과 같다 (회귀 방지)', () => {
  const raw = {
    sourceId: 'pub',
    publishedAt: '2026-03-15T12:34:56Z',
  };
  const row = mapToRawItem(raw, ctx);
  expect(row.publishedAt?.toISOString()).toBe('2026-03-15T12:34:56.000Z');
  expect(row.time.getTime()).toBe(row.publishedAt?.getTime());
});
```

그리고 파일 상단 import 아래(`import { mapToRawItem, type MapItemContext } from './item-mapper';` 다음 줄)에 테스트용 헬퍼를 추가:

```typescript
function startOfUtcDayForTest(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
```

- [ ] **Step 2: 테스트를 실행해 실패 확인**

Run:

```bash
pnpm --filter @ai-signalcraft/collector exec vitest run src/queue/item-mapper.test.ts
```

Expected: "publishedAt이 모두 null이면 time은 현재 UTC 자정이다" 케이스가 실패. 현재 구현은 `time = publishedAt ?? new Date()`라 `time.getUTCHours()`가 0이 아닐 확률이 매우 높음 (UTC 00:00~00:01 사이에 실행 안 하는 한). 나머지 케이스도 일부 실패 가능.

- [ ] **Step 3: 커밋**

```bash
git add apps/collector/src/queue/item-mapper.test.ts
git commit -m "test: raw_items time 폴백 UTC 자정 계약 테스트 추가

publishedAt이 null일 때 time이 UTC 자정으로 절삭되어야
중복 방지 UNIQUE 제약이 재수집 간에 유지된다는 계약을 테스트로 고정.
구현은 다음 커밋에서.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: `item-mapper.ts`에 `startOfUtcDay` 구현

**Files:**

- Modify: `apps/collector/src/queue/item-mapper.ts:70-111`

- [ ] **Step 1: 헬퍼 함수 추가**

`apps/collector/src/queue/item-mapper.ts` 파일에서 `toDate` 함수 바로 아래(27행 `}` 다음 빈 줄)에 아래 함수를 추가한다.

```typescript
/**
 * publishedAt이 없는 아이템을 위한 time 폴백.
 *
 * TimescaleDB UNIQUE (source, source_id, item_type, time) 제약은 시간 컬럼을
 * 포함해야 하는데, publishedAt이 null일 때 `new Date()`를 쓰면 재수집마다
 * time이 달라져 UNIQUE가 무력화되어 중복이 쌓인다.
 *
 * 수집 시각을 UTC 자정으로 절삭하면 같은 날 안에서는 time이 일정해 중복이
 * `onConflictDoNothing`으로 차단되고, 청크 분포도 날짜별로 자연스럽게 유지된다.
 */
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
```

- [ ] **Step 2: `time` 계산 변경**

같은 파일 `mapToRawItem` 함수 내부를 수정한다. 현재 77~78행:

```typescript
// time = 게시일 우선, 없으면 now (하이퍼테이블 시간축)
const time = publishedAt ?? new Date();
```

위 두 줄을 아래로 교체:

```typescript
// time = 게시일 우선, 없으면 오늘 UTC 자정 (같은 날 재수집 중복 차단용)
const time = publishedAt ?? startOfUtcDay(new Date());
```

- [ ] **Step 3: 테스트 실행해서 통과 확인**

Run:

```bash
pnpm --filter @ai-signalcraft/collector exec vitest run src/queue/item-mapper.test.ts
```

Expected: 모든 테스트 PASS. 특히 새로 추가된 3개 케이스 전부 초록불.

- [ ] **Step 4: 타입체크 + 린트**

Run:

```bash
pnpm --filter @ai-signalcraft/collector exec tsc --noEmit
pnpm lint
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add apps/collector/src/queue/item-mapper.ts
git commit -m "fix(collector): publishedAt null일 때 time을 UTC 자정으로 절삭

re-collect 시 time=new Date()로 매번 달라져 UNIQUE (source, source_id,
item_type, time) 제약이 우회되던 문제를 해결. 같은 날 안의 재수집은
동일 time을 사용해 onConflictDoNothing으로 차단된다.

naver-news 기사 7.7%(526/6820)가 publishedAt null이며 현재까지
302건이 중복으로 누적된 상태. 이 커밋 이후로는 신규 중복이 하루에 1건
이상 쌓이지 않는다(다른 날 재수집만 중복 생성 가능).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: dedup 정리 스크립트 작성 (dry-run)

**Files:**

- Create: `apps/collector/src/scripts/dedup-raw-items.ts`

- [ ] **Step 1: 스크립트 파일 생성**

`apps/collector/src/scripts/dedup-raw-items.ts`를 아래 내용으로 생성:

```typescript
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { rawItems } from '../db/schema';

/**
 * raw_items에 누적된 중복 행 정리 CLI.
 *
 * 중복 기준: (source, source_id, item_type)이 같은 여러 행.
 * 정책: fetched_at이 가장 이른 행만 남기고 나머지 DELETE.
 *
 * 사용법:
 *   pnpm --filter @ai-signalcraft/collector exec tsx src/scripts/dedup-raw-items.ts --dry-run
 *   pnpm --filter @ai-signalcraft/collector exec tsx src/scripts/dedup-raw-items.ts
 *
 * 압축된 TimescaleDB 청크의 행은 DELETE가 실패할 수 있다(제약).
 * 이 경우 에러 로그만 남기고 다음 그룹으로 진행한다.
 */

type DupGroup = {
  source: string;
  sourceId: string;
  itemType: string;
  cnt: number;
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const db = getDb();

  console.warn(`[dedup] mode=${dryRun ? 'DRY-RUN' : 'EXECUTE'}`);

  // 중복 그룹 조회 — 상위 1000개까지만 (한 번에 처리)
  const groupsRaw = await db.execute(sql`
    SELECT source, source_id AS "sourceId", item_type AS "itemType", COUNT(*)::int AS cnt
    FROM raw_items
    GROUP BY source, source_id, item_type
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 1000
  `);
  const groups = groupsRaw.rows as unknown as DupGroup[];

  if (groups.length === 0) {
    console.warn('[dedup] 중복 그룹 없음. 종료.');
    return;
  }

  const totalExtraRows = groups.reduce((s, g) => s + (g.cnt - 1), 0);
  console.warn(`[dedup] 중복 그룹 ${groups.length}개, 삭제 대상 행 ${totalExtraRows}개`);
  console.warn('[dedup] 상위 5개 그룹:');
  for (const g of groups.slice(0, 5)) {
    console.warn(`  - ${g.source} / ${g.itemType} / ${g.sourceId}: ${g.cnt}건`);
  }

  if (dryRun) {
    console.warn('[dedup] dry-run 종료. 실제 삭제하려면 --dry-run 플래그 없이 실행.');
    return;
  }

  let deleted = 0;
  let failed = 0;

  for (const g of groups) {
    try {
      const res = await db.execute(sql`
        WITH ranked AS (
          SELECT ctid,
                 ROW_NUMBER() OVER (
                   PARTITION BY source, source_id, item_type
                   ORDER BY fetched_at ASC
                 ) AS rn
          FROM ${rawItems}
          WHERE source = ${g.source}
            AND source_id = ${g.sourceId}
            AND item_type = ${g.itemType}
        )
        DELETE FROM ${rawItems}
        WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1)
      `);
      const rowCount = (res as unknown as { rowCount?: number }).rowCount ?? 0;
      deleted += rowCount;
    } catch (err) {
      failed++;
      console.warn(
        `[dedup] 삭제 실패 ${g.source}/${g.itemType}/${g.sourceId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  console.warn(`[dedup] 완료. 삭제 ${deleted}개, 실패 그룹 ${failed}개.`);
}

main()
  .catch((err) => {
    console.error('[dedup] fatal:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
```

- [ ] **Step 2: 타입체크**

Run:

```bash
pnpm --filter @ai-signalcraft/collector exec tsc --noEmit
```

Expected: 에러 없음. `DupGroup` 타입, drizzle `sql` 템플릿 사용 모두 정상.

- [ ] **Step 3: dry-run 실행**

Run (개발 DB가 운영 DB 5435를 공유하므로 결과가 실측과 일치해야 함):

```bash
pnpm --filter @ai-signalcraft/collector exec tsx src/scripts/dedup-raw-items.ts --dry-run
```

Expected output 예시:

```
[dedup] mode=DRY-RUN
[dedup] 중복 그룹 N개, 삭제 대상 행 ~302개
[dedup] 상위 5개 그룹:
  - naver-news / article / ext_www_incheonilbo_com_...: 4건
  ...
[dedup] dry-run 종료. 실제 삭제하려면 --dry-run 플래그 없이 실행.
```

삭제 대상 행이 **약 304개**(naver-news 302 + dcinside 2)로 리포트되어야 정상. 크게 다르면 쿼리 로직 재검토.

- [ ] **Step 4: 커밋**

```bash
git add apps/collector/src/scripts/dedup-raw-items.ts
git commit -m "feat(collector): raw_items 중복 정리 스크립트 추가

(source, source_id, item_type) 기준 중복 그룹에서 fetched_at이 가장
이른 행만 남기고 나머지를 DELETE. --dry-run 플래그로 사전 확인 가능.

실측 운영 DB에서 naver-news 기사 302건, dcinside 기사 2건의 누적
중복이 있으며 이 스크립트로 일괄 정리한다. 압축된 청크의 행이 삭제
실패할 경우 에러 로그 후 다음 그룹으로 진행.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: dedup 스크립트 실제 실행 + 검증

**Files:** (변경 없음 — 운영 작업만)

- [ ] **Step 1: 실제 실행**

Run:

```bash
pnpm --filter @ai-signalcraft/collector exec tsx src/scripts/dedup-raw-items.ts
```

Expected: `[dedup] 완료. 삭제 ~304개, 실패 그룹 0개.`

실패 그룹이 0이 아니면 로그 캡처해서 보관. TimescaleDB 압축 청크 이슈가 원인일 수 있음.

- [ ] **Step 2: 검증 쿼리**

Run:

```bash
docker exec krdn-timescaledb psql -U postgres -d ais_collection -c \
  "SELECT (COUNT(*) - COUNT(DISTINCT (source, source_id, item_type)))::int AS remaining_dups FROM raw_items;"
```

Expected: `remaining_dups` = 0 (또는 실패 그룹이 있던 경우 그 수만큼).

- [ ] **Step 3: 소스별 검증**

Run:

```bash
docker exec krdn-timescaledb psql -U postgres -d ais_collection -c \
  "SELECT source, item_type, COUNT(*) AS total, COUNT(DISTINCT (source, source_id, item_type))::int AS distinct_keys, (COUNT(*) - COUNT(DISTINCT (source, source_id, item_type)))::int AS dups FROM raw_items GROUP BY source, item_type ORDER BY source, item_type;"
```

Expected: 모든 행의 `dups` 컬럼이 0.

- [ ] **Step 4: 결과 기록 (커밋 없음)**

이 단계는 운영 작업이므로 커밋 대상 없음. 실행 로그를 사용자에게 보고만 한다.

---

### Task 5: 전체 회귀 테스트 + 마무리

**Files:** (변경 없음)

- [ ] **Step 1: collector 전체 테스트 실행**

Run:

```bash
pnpm --filter @ai-signalcraft/collector test
```

Expected: 모든 테스트 PASS. 신규 3개를 포함해 `item-mapper.test.ts`가 초록불이어야 함.

- [ ] **Step 2: 모노레포 린트**

Run:

```bash
pnpm lint
```

Expected: 에러 없음.

- [ ] **Step 3: 최종 상태 확인**

Run:

```bash
git log --oneline -3
git status
```

Expected:

- 최근 3커밋이 이 플랜의 Task 1·2·3 결과
- working tree clean (또는 플랜 외 기존 변경 파일만 남음)

---

## 수용 기준 (spec 재인용)

- [x] `pnpm --filter @ai-signalcraft/collector test` — 신규 테스트 3개 포함 전체 통과 (Task 5 Step 1)
- [x] dry-run 스크립트가 ~304건 중복 리포트 (Task 3 Step 3)
- [x] 실행 후 `COUNT(*) - COUNT(DISTINCT ...) = 0` (Task 4 Step 2)
- [ ] 배포 후 24시간 모니터링 — 이 플랜 스코프 밖 (운영 관찰 항목)

---

## Self-Review

- **Spec 커버리지**: spec 섹션 2(해결책)→Task 1·2, 섹션 4(TDD)→Task 1·2, 섹션 5(정리 스크립트)→Task 3·4, 섹션 8(수용 기준)→Task 5 + Task 4. 누락 없음.
- **Placeholder**: "TBD/TODO/appropriate/similar to" 없음. 모든 코드 블록에 실제 코드.
- **타입·시그니처 일관성**: `startOfUtcDay`(구현)와 `startOfUtcDayForTest`(테스트 헬퍼) 이름 의도적으로 분리. `DupGroup` 타입은 스크립트 내부에서만 사용, 외부 노출 없음.
- **YAGNI**: 배포 자동화·CI 알림·모니터링 대시보드는 이 PR에서 제외.
