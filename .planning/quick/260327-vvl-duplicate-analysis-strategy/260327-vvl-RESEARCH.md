# 동일 키워드/겹치는 날짜의 분석 중복 실행 전략 - Research

**Researched:** 2026-03-27
**Domain:** 데이터 소유권 모델, 중복 수집 전략, 분석 결과 일관성
**Confidence:** HIGH (코드베이스 직접 분석 기반)

## Summary

현재 시스템은 articles/videos/comments 테이블에서 `source + sourceId`로 unique index를 걸고, upsert 시 `jobId`를 마지막 수집 job으로 덮어쓴다. 이로 인해 날짜가 겹치는 두 분석 작업을 실행하면, 먼저 실행된 Job A의 기사가 나중에 실행된 Job B로 "이동"하여 Job A의 분석 결과가 사후적으로 불완전해지는 심각한 데이터 무결성 문제가 있다.

핵심 문제는 **1:N 관계(기사는 하나의 job에만 속함)로 모델링한 것이 실제 도메인(기사는 여러 분석 작업에서 참조될 수 있음)과 불일치**하는 것이다. 이를 해결하는 세 가지 방안을 분석한 결과, **방안 B (다대다 조인 테이블)가 가장 적합**하다.

**Primary recommendation:** articles/videos/comments에서 jobId 컬럼을 제거하고, `article_jobs`/`video_jobs`/`comment_jobs` 조인 테이블을 도입하여 N:M 관계로 전환한다. upsert 시 기존 데이터는 건드리지 않고 조인 레코드만 추가한다.

## 현재 문제 분석

### 근본 원인

```
persist.ts의 onConflictDoUpdate:
  jobId: sql`excluded.job_id`  -- 이 한 줄이 문제의 원인
```

기사(article)는 본질적으로 job에 독립적인 엔티티다. "네이버 뉴스 기사 #12345"는 어떤 분석 작업이 수집했든 동일한 기사다. 그런데 현재 스키마는 기사가 **하나의 job에만 소속**되도록 모델링되어 있어, 새 job이 같은 기사를 수집하면 소유권이 이전된다.

### 영향 범위

| 영향 | 설명 |
|------|------|
| **분석 결과 무결성** | Job A 완료 후 Job B 실행 시, Job A의 기사가 빠져나가 A의 분석 리포트와 실제 데이터가 불일치 |
| **데이터 조회** | `loadAnalysisInput(jobA.id)` 결과가 시간이 지나면서 줄어듦 |
| **감사 추적** | 어떤 job이 어떤 기사를 실제로 분석했는지 추적 불가 |
| **재분석** | 과거 job을 재분석하면 원래와 다른 데이터셋으로 실행됨 |

## 해결 방안 비교

### 방안 A: 중복 실행 방지 (가장 단순)

**개념:** 동일 keyword + 겹치는 날짜 범위의 job 생성을 차단하거나 경고

**구현:**
```typescript
// analysis.ts trigger에서 겹치는 job 검사
const overlapping = await db.select()
  .from(collectionJobs)
  .where(and(
    eq(collectionJobs.keyword, input.keyword),
    lte(collectionJobs.startDate, new Date(input.endDate)),
    gte(collectionJobs.endDate, new Date(input.startDate)),
    inArray(collectionJobs.status, ['completed', 'running', 'pending']),
  ));

if (overlapping.length > 0) {
  throw new TRPCError({
    code: 'CONFLICT',
    message: `겹치는 분석 작업이 존재합니다: Job #${overlapping[0].id}`,
  });
}
```

| 장점 | 단점 |
|------|------|
| 구현 최소 (트리거 로직에 검사만 추가) | 사용자 자유도 제한 (날짜 확장/축소 불가) |
| DB 스키마 변경 없음 | 근본 문제 미해결 (기존 데이터 여전히 취약) |
| 마이그레이션 불필요 | "3/1~15 분석 후 3/1~25로 확장" 같은 합리적 시나리오 차단 |

**구현 복잡도:** LOW (코드 10줄)
**DB 마이그레이션:** 불필요
**권장 여부:** 임시 방편으로만 사용. 근본 해결 아님

---

### 방안 B: 다대다 조인 테이블 (권장)

**개념:** 기사/영상/댓글과 job의 관계를 N:M으로 변경

**스키마 변경:**
```typescript
// 새 조인 테이블
export const articleJobs = pgTable('article_jobs', {
  articleId: integer('article_id').references(() => articles.id).notNull(),
  jobId: integer('job_id').references(() => collectionJobs.id).notNull(),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  // 복합 PK로 중복 방지
  uniqueIndex('article_jobs_pk').on(table.articleId, table.jobId),
]);

export const videoJobs = pgTable('video_jobs', {
  videoId: integer('video_id').references(() => videos.id).notNull(),
  jobId: integer('job_id').references(() => collectionJobs.id).notNull(),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('video_jobs_pk').on(table.videoId, table.jobId),
]);

export const commentJobs = pgTable('comment_jobs', {
  commentId: integer('comment_id').references(() => comments.id).notNull(),
  jobId: integer('job_id').references(() => collectionJobs.id).notNull(),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('comment_jobs_pk').on(table.commentId, table.jobId),
]);
```

**persist.ts 변경:**
```typescript
export async function persistArticles(jobId: number, data: (typeof articles.$inferInsert)[]) {
  if (data.length === 0) return [];

  // 1. 기사 upsert (jobId 덮어쓰기 제거)
  const upserted = await getDb()
    .insert(articles)
    .values(deduped)
    .onConflictDoUpdate({
      target: [articles.source, articles.sourceId],
      set: {
        // jobId 제거 -- 더 이상 덮어쓰지 않음
        title: sql`excluded.title`,
        content: sql`excluded.content`,
        rawData: sql`excluded.raw_data`,
        collectedAt: sql`excluded.collected_at`,
      },
    })
    .returning();

  // 2. 조인 테이블에 관계 추가 (이미 있으면 무시)
  await getDb()
    .insert(articleJobs)
    .values(upserted.map(a => ({ articleId: a.id, jobId })))
    .onConflictDoNothing();

  return upserted;
}
```

**data-loader.ts 변경:**
```typescript
export async function loadAnalysisInput(jobId: number): Promise<AnalysisInput> {
  // 조인 테이블 경유 조회
  const articleRows = await getDb()
    .select({
      title: articles.title,
      content: articles.content,
      publisher: articles.publisher,
      publishedAt: articles.publishedAt,
      source: articles.source,
    })
    .from(articles)
    .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
    .where(eq(articleJobs.jobId, jobId));

  // videos, comments도 동일한 패턴
}
```

| 장점 | 단점 |
|------|------|
| 도메인 모델과 정확히 일치 | 조인 테이블 3개 추가 (스키마 복잡도 약간 증가) |
| 기존 분석 결과 무결성 보장 | 데이터 마이그레이션 필요 (기존 jobId -> 조인 레코드) |
| 데이터 재활용 자연스러움 (이미 수집된 기사는 조인만 추가) | 조회 시 JOIN 필요 (미미한 성능 영향) |
| 감사 추적 가능 (어떤 job이 어떤 기사를 수집했는지) | persist 로직 2단계 (upsert + 조인 삽입) |
| articles 테이블에서 jobId 컬럼 제거 가능 | |

**구현 복잡도:** MEDIUM (스키마 3테이블 + persist 3함수 + data-loader 1함수 + 마이그레이션)
**DB 마이그레이션:** 필요 (아래 상세)

**마이그레이션 절차:**
```sql
-- 1. 조인 테이블 생성
CREATE TABLE article_jobs (article_id INT REFERENCES articles(id), job_id INT REFERENCES collection_jobs(id), collected_at TIMESTAMPTZ DEFAULT now(), UNIQUE(article_id, job_id));
CREATE TABLE video_jobs (video_id INT REFERENCES videos(id), job_id INT REFERENCES collection_jobs(id), collected_at TIMESTAMPTZ DEFAULT now(), UNIQUE(video_id, job_id));
CREATE TABLE comment_jobs (comment_id INT REFERENCES comments(id), job_id INT REFERENCES collection_jobs(id), collected_at TIMESTAMPTZ DEFAULT now(), UNIQUE(comment_id, job_id));

-- 2. 기존 데이터 이전 (기존 jobId 기반)
INSERT INTO article_jobs (article_id, job_id, collected_at)
SELECT id, job_id, collected_at FROM articles WHERE job_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO video_jobs (video_id, job_id, collected_at)
SELECT id, job_id, collected_at FROM videos WHERE job_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO comment_jobs (comment_id, job_id, collected_at)
SELECT id, job_id, collected_at FROM comments WHERE job_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. (선택) articles/videos/comments에서 job_id 컬럼 제거
-- 주의: 이 단계는 코드 변경이 모두 배포된 후 실행
ALTER TABLE articles DROP COLUMN job_id;
ALTER TABLE videos DROP COLUMN job_id;
ALTER TABLE comments DROP COLUMN job_id;
```

---

### 방안 C: 스냅샷 방식 (분석 시점 데이터 고정)

**개념:** 분석 실행 시 사용한 기사 ID 목록을 analysis_results 또는 별도 테이블에 저장

**구현:**
```typescript
// analysis_results 또는 collectionJobs에 snapshot 필드 추가
export const collectionJobs = pgTable('collection_jobs', {
  // ... 기존 필드
  articleSnapshot: jsonb('article_snapshot').$type<number[]>(), // 분석에 사용된 article IDs
  videoSnapshot: jsonb('video_snapshot').$type<number[]>(),
  commentSnapshot: jsonb('comment_snapshot').$type<number[]>(),
});
```

| 장점 | 단점 |
|------|------|
| 기존 스키마 최소 변경 (컬럼 3개 추가) | JSONB 배열은 FK 제약 불가 (정합성 보장 어려움) |
| 분석 재현성 완벽 보장 | 기사 삭제 시 orphan ID 문제 |
| 마이그레이션 단순 | 데이터 재활용 문제 미해결 (여전히 재수집 발생) |
| | jobId 덮어쓰기 문제 자체는 여전히 존재 |

**구현 복잡도:** LOW-MEDIUM
**DB 마이그레이션:** 컬럼 추가만
**권장 여부:** 방안 B의 보조 수단으로만 (분석 재현성 보장용)

---

## 권장 전략: 방안 B + 부분적 방안 A

### 1단계: 조인 테이블 도입 (방안 B)
- `article_jobs`, `video_jobs`, `comment_jobs` 조인 테이블 생성
- `persist.ts` 수정: upsert에서 jobId 덮어쓰기 제거, 조인 레코드 추가
- `data-loader.ts` 수정: JOIN 기반 조회로 변경
- 기존 데이터 마이그레이션 실행

### 2단계: 사용자 경고 (방안 A의 소프트 버전)
- 중복 실행을 **차단하지 않되**, 겹치는 job이 있으면 UI에서 경고 표시
- "이미 '윤석열' 3/1~15 분석이 존재합니다. 겹치는 기사는 재수집 없이 재활용됩니다."
- 사용자가 확인 후 계속 진행 가능

### 3단계: 데이터 재활용 최적화 (선택)
- 수집 단계에서 이미 DB에 있는 기사는 스크래핑 스킵
- 조인 레코드만 추가하여 "이 job도 이 기사를 참조함"을 기록
- 수집 시간 및 외부 요청 절감

## 추가 고려사항

### articles 테이블의 jobId 컬럼 처리

**단계적 접근 권장:**
1. 조인 테이블 도입 + 코드에서 조인 테이블 사용으로 전환
2. jobId 컬럼은 당분간 유지 (하위 호환)하되, persist에서 더 이상 업데이트하지 않음
3. 충분한 검증 후 jobId 컬럼 제거

### 성능 영향

| 쿼리 | 현재 | 변경 후 | 영향 |
|------|------|---------|------|
| 기사 조회 (by jobId) | `WHERE job_id = ?` | `JOIN article_jobs ON ... WHERE job_id = ?` | 미미 (인덱스 사용) |
| 기사 upsert | 1 쿼리 | 2 쿼리 (upsert + 조인 insert) | 약간 증가 |
| 기사 수 집계 | `COUNT(*) WHERE job_id = ?` | `COUNT(*) FROM article_jobs WHERE job_id = ?` | 미미 |

조인 테이블에 `(job_id)` 인덱스를 추가하면 성능 차이는 무시할 수 있는 수준이다. 현재 데이터 규모(소규모 분석팀, 수동 트리거)에서는 전혀 문제되지 않음.

### 영향받는 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `packages/core/src/db/schema/collections.ts` | 조인 테이블 3개 추가, articles/videos/comments의 jobId 옵셔널화 |
| `packages/core/src/db/schema/index.ts` | 새 테이블 export |
| `packages/core/src/pipeline/persist.ts` | upsert 후 조인 레코드 삽입 로직 추가 |
| `packages/core/src/analysis/data-loader.ts` | JOIN 기반 조회로 변경 |
| `apps/web/src/server/trpc/routers/analysis.ts` | (선택) 중복 경고 로직 추가 |
| Drizzle migration | 새 마이그레이션 파일 생성 |

### 기존 분석 결과에 대한 영향

마이그레이션 시 기존 `articles.job_id` 값을 `article_jobs`로 복사하므로, **기존 완료된 분석 결과의 조회는 정상 동작한다.** 단, 이미 jobId가 덮어씌워진 과거 데이터는 복구 불가 (원래 어떤 job이 수집했는지 정보가 유실된 상태).

## Common Pitfalls

### Pitfall 1: 마이그레이션 중 데이터 유실
**What goes wrong:** 조인 테이블 생성 전에 jobId 컬럼을 삭제하면 관계 정보 유실
**How to avoid:** 반드시 "조인 테이블 생성 + 데이터 복사 + 검증 + 컬럼 삭제" 순서 준수

### Pitfall 2: persist 트랜잭션 미사용
**What goes wrong:** upsert 성공 후 조인 insert 실패 시 데이터 불일치
**How to avoid:** upsert + 조인 insert를 하나의 트랜잭션으로 묶기
```typescript
await db.transaction(async (tx) => {
  const upserted = await tx.insert(articles).values(...).onConflictDoUpdate(...).returning();
  await tx.insert(articleJobs).values(...).onConflictDoNothing();
});
```

### Pitfall 3: 조인 테이블 인덱스 누락
**What goes wrong:** `loadAnalysisInput`의 JOIN 쿼리 성능 저하
**How to avoid:** `article_jobs(job_id)`, `video_jobs(job_id)`, `comment_jobs(job_id)`에 인덱스 추가

## Sources

### Primary (HIGH confidence)
- 프로젝트 소스 코드 직접 분석: `collections.ts`, `analysis.ts`, `persist.ts`, `data-loader.ts`, `runner.ts`
- PostgreSQL 공식 문서: JOIN 테이블 패턴, upsert 동작

### Secondary (MEDIUM confidence)
- Drizzle ORM 다대다 관계 패턴 (기존 프로젝트 코드 스타일 기반 추론)

## Metadata

**Confidence breakdown:**
- 문제 분석: HIGH - 코드 직접 확인
- 방안 B 설계: HIGH - 표준 DB 패턴 (조인 테이블)
- 마이그레이션 절차: HIGH - SQL 기본 작업
- 성능 영향: HIGH - 데이터 규모가 작아 병목 없음

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (안정적 도메인)
