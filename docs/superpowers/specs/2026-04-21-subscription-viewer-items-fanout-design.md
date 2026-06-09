# @ais:sub/259 뷰어 빈 화면 — 기사·댓글 쿼리 분리 재설계

## Context

커밋 `6683ca5 feat(subscriptions): 수집 데이터 뷰어 + 네이버 기사-댓글 fan-out 연결`이 구독별 수집 데이터 뷰어(`/subscriptions/[id]/items`)와 네이버 기사-댓글 연계 UI를 도입했다. 그러나 실제 운영 데이터 @ais:sub/259(기사 826·댓글 12192)에서 **피드가 완전히 빈 화면**으로 렌더되는 결함이 발견됐다.

DB와 tRPC 호출 검증(`raw_items`에 259 기사 824·댓글 12192 정상 존재, `parent_source_id` 100% NOT NULL) 끝에 확정된 근본 원인은 **한 쿼리에 기사·댓글을 섞어 가져오고 클라이언트에서 `itemType !== 'comment'`로 필터하는 구조** 자체가 아래 세 결함을 동시에 유발하는 것이다.

1. `items.query`가 `ORDER BY time DESC`로 정렬 → 댓글(최근 1주 집중, 12192건)이 기사(5개월 분산, 824건)를 밀어내 limit 50을 잠식 (측정: limit 500에서도 댓글 481 : 기사 19)
2. 서버 응답 직전 `apps/collector/src/server/trpc/items.ts` L142-149가 모든 댓글의 `source`를 `naver-comments → naver-news`로 덮어써 응답이 DB 저장 상태와 불일치
3. 클라이언트 `item-feed.tsx` L48이 `feedItems = allItems.filter(i => i.itemType !== 'comment')` — 댓글만 로드된 첫 페이지는 피드 빈 상태 분기(L100-106)로 떨어짐

**의도한 결과**: 피드는 기사/영상만으로 페이지네이션되어 안정적으로 보이고, 댓글은 선택된 기사에 한해 상세 패널에서 lazy load. 정규화 해킹을 제거해 응답이 저장 상태와 일치.

## Goals / Non-goals

**Goals**

- 피드 쿼리가 기사(+영상)만 대상으로 시간순 페이지네이션
- 기사-댓글 "연계"는 상세 패널이 열릴 때 `(source, sourceId)`로 lazy load
- `source` 덮어쓰기 제거
- 댓글 수 배지(`commentCountByParent`)와 네이버 fan-out 매칭은 표시 계층에서만 수행

**Non-goals**

- `raw_items` 스키마/하이퍼테이블 변경
- 분석 파이프라인(`items.query` mode=all 소비자) 동작 변경
- 수집 스케줄러/수집기 수정
- 네이버 외 소스 fan-out 재설계

## Architecture

### collector tRPC `items.query` 확장 (하위 호환)

추가 입력:

```ts
scope: z.enum(['feed', 'comments-for-parent', 'all']).default('all'),
parent: z.object({
  source: z.enum(SOURCE_ENUM),
  sourceId: z.string(),
}).optional(),  // scope='comments-for-parent'일 때 필수
```

| scope                 | WHERE                                                                                                                                  | ORDER BY                                                   | 용도                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------- |
| `feed`                | `item_type IN ('article','video')` 강제 + 기존 필터                                                                                    | `COALESCE(published_at, time) DESC`, cursor는 `fetched_at` | 뷰어 피드                   |
| `comments-for-parent` | `item_type='comment' AND parent_source_id=${parent.sourceId}`; 네이버면 `source='naver-comments'` 치환, 그 외는 `source=parent.source` | `time ASC`, cursor `fetched_at`                            | 상세 패널 댓글              |
| `all`                 | 기존 그대로                                                                                                                            | 기존 그대로                                                | 분석 파이프라인 (회귀 없음) |

fan-out source 치환은 오직 `scope='comments-for-parent' AND parent.source='naver-news'` 분기 안에서만.

**L142-149 `r.source = 'naver-news'` 루프 삭제**. 응답은 저장 상태 그대로.

### web tRPC 래퍼

`apps/web/src/server/trpc/routers/subscriptions.ts`:

- `queryItems`: collector 호출 시 `scope: 'feed'` 고정 전달 (외부 시그니처 불변)
- `queryComments` 신규:
  ```ts
  input: z.object({
    subscriptionId: z.number().int().positive(),
    parent: z.object({ source: z.enum(SOURCE_ENUM), sourceId: z.string() }),
    cursor: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(500).default(100),
  })
  → collector items.query { scope: 'comments-for-parent', ... }
  ```

### 프론트엔드

- `useInfiniteItems` — 변화 없음(scope는 서버가 자동). 클라이언트 필터 로직 제거.
- `use-comments-for-parent.ts` — 신규. `useInfiniteQuery`로 선택 기사 댓글 페이지네이션.
- `item-detail-panel.tsx` — `allItems` prop 제거, 댓글 훅 사용, 로딩/에러/빈 상태 분기.
- `item-feed.tsx` — `feedItems`/`commentItems` 분리 로직 삭제, `onSelectItem`이 item 1개만 전달.
- `page.tsx` — `commentItems` 상태 제거, 콜백 시그니처 맞춤.
- `item-filter-bar.tsx` — `bySourceAndType`에서 article/comment 분리해 "기사 N · 댓글 M" 표시(선택).

## Critical Files

수정:

- `apps/collector/src/server/trpc/items.ts` — scope 입력, 분기 로직, L142-149 제거
- `apps/web/src/server/trpc/routers/subscriptions.ts` — queryItems에 scope='feed' 전달, queryComments 신규
- `apps/web/src/app/subscriptions/[id]/items/page.tsx`
- `apps/web/src/components/subscriptions/items/item-feed.tsx`
- `apps/web/src/components/subscriptions/items/item-detail-panel.tsx`
- `apps/web/src/components/subscriptions/items/item-filter-bar.tsx` (선택)

신규:

- `apps/web/src/hooks/use-comments-for-parent.ts`
- `apps/collector/src/server/trpc/items.test.ts` (scope별 SQL 스냅샷 + fan-out 치환 단위 테스트)

## Build Sequence

**Phase A — collector 백엔드**

1. `items.query` 입력에 `scope`/`parent` 추가, default `'all'`
2. `scope='feed'` 분기 구현
3. `scope='comments-for-parent'` 분기 구현 (네이버 치환 포함)
4. L142-149 source 덮어쓰기 제거
5. 테스트 추가

**Phase B — web tRPC 래퍼** 6. `queryItems`에 `scope: 'feed'` 전달 7. `queryComments` 신규 래퍼

**Phase C — 프론트엔드** 8. `use-comments-for-parent.ts` 생성 9. `item-detail-panel.tsx` 훅 연결 10. `item-feed.tsx` 분리 로직 제거 11. `page.tsx` 콜백/상태 정리 12. `item-filter-bar.tsx` 통계 분리 (선택)

**Phase D — 검증** 13. 로컬 E2E (`/subscriptions/259/items`) 14. `rg -n "naver-comments" packages/core apps/collector` 회귀 스캔 15. 배포 순서: collector → web

## Edge Cases

| 케이스                                    | 동작                                                         |
| ----------------------------------------- | ------------------------------------------------------------ |
| 기사 0 · 댓글 N 기간                      | 피드 빈 상태, 통계 "기사 0 · 댓글 N"                         |
| 기사 N · 수집 댓글 0                      | 카드 배지 `metrics.commentCount` 우선, 상세 패널 "댓글 없음" |
| `parent_source_id IS NULL` 댓글           | `queryComments`가 자연 제외                                  |
| 기사 `sourceId` 충돌 (다른 source에 중복) | `parent.source` 명시로 해결                                  |
| 분석 호출(`scope` 미지정)                 | default `'all'` → 기존 동작                                  |
| 기사 변경 시 댓글 상태                    | `queryKey`에 `sourceId` 포함 → 자동 리셋                     |

## Verification

**수동 E2E**

1. `pnpm dev:all` → `/subscriptions/259/items`
2. 피드에 기사 카드 ≥ 1건 렌더 확인 (30일 기준 824건 중 최근 50건)
3. 임의 기사 클릭 → 상세 패널 댓글 목록이 해당 sourceId 기준으로 표시, `metrics.commentCount`와 배지 일치
4. 기간 필터 변경 시 피드만 재로딩, 상세 패널 변동 없음
5. DevTools Network: 응답의 `source` 필드에 `naver-comments`가 원본 그대로(덮어쓰기 제거 확인)

**자동**

- `items.test.ts` 추가: scope별 SQL 스냅샷, fan-out 치환 분기

**DB 무결성 (read-only)**

```sql
-- 피드가 비지 않음을 보장하는 기사 시점 분포
SELECT date_trunc('day', time) d, COUNT(*)
FROM raw_items WHERE subscription_id=259 AND item_type='article'
GROUP BY 1 ORDER BY 1 DESC LIMIT 10;

-- 댓글 parent 매칭율
SELECT COUNT(*) total,
       COUNT(*) FILTER (WHERE c.parent_source_id = a.source_id) matched
FROM raw_items c
LEFT JOIN raw_items a ON a.source_id=c.parent_source_id
  AND a.source='naver-news' AND a.item_type='article'
WHERE c.subscription_id=259 AND c.item_type='comment';
```

## Risks

| 리스크                                          | 영향             | 완화                                                                                     |
| ----------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| 분석 모듈이 덮어쓴 `source='naver-news'`에 의존 | 분석 회귀        | Phase D에서 grep 스캔; 필요 시 `source IN ('naver-news','naver-comments')` 패턴으로 수정 |
| `published_at IS NULL` 기사 누락                | 오래된 기사 숨김 | `COALESCE(published_at, time)` fallback                                                  |
| 정렬에 인덱스 부적합                            | 느린 쿼리        | 현 규모 문제 없음; 후속 과제로 인덱스 추가 검토                                          |
| lazy load 왕복 증가                             | UX               | React Query staleTime 60s로 완충                                                         |
| 배포 역순                                       | 500 에러         | collector→web 순서 준수; scope optional이라 구버전 호환                                  |

## Non-goals / YAGNI

- 댓글 검색/정렬 옵션(추천순 등)
- 유튜브 영상 댓글 fan-out
- 피드 렌더 시 댓글 bulk preload
- itemType 토글 UI ("영상만 보기" 등)
