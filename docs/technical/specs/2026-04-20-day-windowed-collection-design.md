# DC/Clien 일자 윈도우 수집 + 백필/증분 분리 설계

- **작성일**: 2026-04-20
- **작성자**: gon (with Claude)
- **상태**: Draft (사용자 리뷰 대기)
- **관련 코드**: `packages/collectors/src/adapters/`, `apps/collector/src/`

## 1. 배경과 목표

### 현재 한계

- DC/Clien은 검색 API에 날짜 파라미터가 없어 `collectLegacySequential` 단일 경로만 사용 → 한 날짜에 쏠리고 다른 날짜는 비는 현상이 발생한다.
- 실측(sub/37 한동훈, 2026-04-20 04:40 UTC 기준): DC가 5분 동안 오늘 04:34~00:23 KST 분만 215건 수집, 어제 이전은 0건.
- 백필 개념이 없다. 단일 run = 단일 cursor 구조라 "지난 30일치 균등 수집"이 구조적으로 불가능하다.
- Scheduler/수동 트리거 모두 동일 옵션으로 호출되어 일일 증분과 백필 의도를 구분할 수 없다.

### 목표

1. DC/Clien에 **일자 윈도우 + perDay cap** 보장 (네이버·fmkorea와 동일한 균등성 수준).
2. **일일 증분(자동)**과 **백필(수동)** 두 모드로 트리거를 분리.
3. 기존 fmkorea/네이버/youtube 경로는 변경 없음 — DC/Clien에만 신규 경로 추가.

### 비목표 (YAGNI)

- 6시간 등 더 잘게 쪼개기. DC 검색에 시각 필터가 없으므로 효율 이득이 없다.
- 별도 BullMQ 큐 분리. 현재 단일 워커로 충분, 차후 진화 여지로 둔다.
- UI 일일 증분 cap override. 표준값 고정으로 시작.

## 2. 결정된 파라미터

| 모드            | perDay | maxPages | windowDays        | 트리거               |
| --------------- | ------ | -------- | ----------------- | -------------------- |
| **incremental** | 50     | 20       | 1                 | scheduler 자동       |
| **backfill**    | 200    | 80       | 사용자 입력 (≤90) | tRPC mutation (수동) |

근거:

- incremental B안: 매일 1-2회, 일반 키워드 기준 안전한 시작값. 핫 키워드는 차후 구독별 override로 확장.
- backfill B안: 한동훈급 핫 키워드 30일 = 약 6,000건 상한 (200×30). 분당 ~30건 페이스로 차단 위험 낮음.
- 트리거 A안: scheduler는 일일 증분만, 백필은 명시적 사용자 트리거. 책임 분리 명확.

## 3. 아키텍처 변경

### 3.1 신규 컴포넌트

**`community-base-collector.ts`**

```ts
// 사이트가 "최신순 정렬은 되지만 날짜 파라미터는 없는" 경우 표시 (DC/Clien)
protected sortedByDateDescending(): boolean { return false; }

// doCollect 분기 우선순위:
// 1) supportsDateRangeSearch() → collectByDayRange (fmkorea, 네이버)
// 2) sortedByDateDescending()   → collectByDayWindowDescending (신규, DC/Clien)
// 3) 그 외                       → collectLegacySequential (변경 없음)
```

**`collectByDayWindowDescending` (신규 메서드)**

핵심:

- 사용자 [start..end]를 KST 자정 기준 일자 배열로 분할 (최신 → 오래된 순).
- 검색결과 노출 `publishedAt` (DC `span.date_time`, Clien 동일 노출)으로 사전 분기:
  - `> 현재 윈도우 상단` → 더 미래 글, skip (다음 페이지 계속)
  - `현재 윈도우 내` → perDay cap 안 차면 fetch, 차면 skip
  - `< 현재 윈도우 하단` → 다음 일자(과거)로 cursor 이동, 같은 페이지에서 계속 처리
  - `consecutiveOldInWindow ≥ 30` → 현재 윈도우는 사실상 끝, 다음 일자로 점프
- 날짜 점프 시 페이지 번호는 리셋 안 함 (검색이 단조감소이므로 이어서 진행).
- 모든 일자가 cap 충족 또는 maxPages 도달 시 종료.

**collector 어댑터**: `dcinside.ts`/`clien.ts`에 `sortedByDateDescending = true` 한 줄. 다른 변경 없음.

### 3.2 트리거 분리 (A안)

**`apps/collector/src/scheduler/scanner.ts`** — 변경

기존 자동 enqueue 시 다음을 명시:

```ts
RunOptions {
  mode: 'incremental',
  perDay: 50,
  maxPages: 20,
  windowDays: 1,
}
```

일일 증분 한정. 백필은 enqueue 안 함.

**`apps/collector/src/server/trpc/subscriptions.ts`** — 신규 mutation

```ts
backfill: protectedProcedure
  .input(
    z.object({
      subscriptionId: z.number(),
      fromDate: z.string(), // YYYY-MM-DD KST
      toDate: z.string(),
      perDay: z.number().default(200),
      maxPages: z.number().default(80),
    }),
  )
  .mutation(async ({ input }) => {
    // input 검증: windowDays = (toDate - fromDate) ≤ 90
    return enqueueRun({ ...input, mode: 'backfill' });
  });
```

**`apps/collector/src/queue/executor.ts`** — `RunOptions.mode` 추가

mode는 perDay/maxPages 기본값 결정에만 사용 후 collector에 그대로 전달.

### 3.3 데이터 흐름 변화

```
Before:
  scheduler → run (mode 없음) → collector(legacy seq, cap 없음) → 한 날짜 쏠림

After-incremental:
  scheduler → run(mode=incremental, perDay=50) → collector(dayWindow) → 어제 50건

After-backfill:
  tRPC backfill → run(mode=backfill, perDay=200, windowDays=30) → collector(dayWindow) → 30일×200건
```

## 4. 일자 윈도우 알고리즘 상세

### 4.1 의사코드

```
input: keyword, days[] (KST 자정 ms 배열, 최신→과거), perDayLimit, maxPages
state:
  pageNum = 1
  dayIdx = 0  // 현재 처리 중인 일자 index (0=가장 최신)
  perDayCount = Map<dayKey, number>
  consecutiveOldInWindow = 0
  consecutiveEmptyPages = 0
  globalSeen = Set<url>

while pageNum <= maxPages and dayIdx < days.length:
  searchUrl = buildSearchUrl(keyword, pageNum)  // 날짜 파라미터 없음
  links = loadSearchPage(searchUrl)

  if links is empty:
    consecutiveEmptyPages++
    if consecutiveEmptyPages >= 5: break (영구 차단/끝)
    backoff(10s × 2^(n-1))
    pageNum++
    continue
  consecutiveEmptyPages = 0

  for each link in links:
    if globalSeen.has(link.url): continue
    globalSeen.add(link.url)

    if not link.publishedAt:
      // 보수적 fetch (publishedAt 파싱 실패분)
      post = fetchPost(link); if post: classifyByPost(post)
      continue

    classify(link.publishedAt)

  pageNum++
  sleep(pageDelay)

function classify(publishedAt):
  while dayIdx < days.length:
    windowStart = days[dayIdx]
    windowEnd = days[dayIdx] + 86400000

    if publishedAt >= windowEnd:
      // 글이 더 미래 (이미 처리한 일자) → skip, 같은 page 계속
      return

    if publishedAt >= windowStart:
      // 현재 윈도우 내
      consecutiveOldInWindow = 0
      if perDayCount.get(windowStart) < perDayLimit:
        post = fetchPost(link)
        if post and isInRange(post.publishedAt, windowStart, windowEnd):
          yield [post]; perDayCount[windowStart]++
      // cap 차도 같은 일자 다른 글이 있을 수 있으니 dayIdx 그대로
      return

    // publishedAt < windowStart → 더 오래된 글
    consecutiveOldInWindow++
    if consecutiveOldInWindow >= 30:
      dayIdx++  // 다음 일자(과거)로 점프
      consecutiveOldInWindow = 0
      continue  // 같은 publishedAt을 새 윈도우에서 재평가
    return
```

### 4.2 핵심 불변식

| 불변식                     | 보장 방법                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| perDay cap 절대 초과 안 함 | yield 직전 cap 검증 (기존 `enforcePerDayCap` 재사용)                                                 |
| 부족분 보충 안 함          | dayIdx는 단조 증가, 과거→현재로 되돌아가지 않음                                                      |
| 단조감소 정렬 의존         | DC/Clien 검색이 `sort=latest`로 보장. `sortedByDateDescending()` 플래그가 명시적 계약                |
| dayIdx 점프 정당성         | 페이지 N에서 "현재 윈도우보다 오래된 글이 30개 연속" = 그 윈도우 글은 페이지 N 이전에 다 봤다는 의미 |

### 4.3 엣지 케이스

| 케이스                               | 처리                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `publishedAt = null` (파싱 실패)     | 보수적 fetch 후 본문에서 재파싱. 본문도 실패면 현재 윈도우 가정으로 cap 안 차면 yield (현재 동작 유지) |
| 일일 증분(windowDays=1)              | days.length=1, classify 분기 단순화. 기존 정확도와 동등 또는 향상                                      |
| 백필 windowDays=30                   | days.length=30, 모든 일자에 cap 충족 시점에 깔끔히 종료                                                |
| 한 페이지에 윈도우 글 + 과거 글 혼재 | classify가 각 link 단위로 동작하므로 자연스럽게 처리                                                   |
| maxPages 도달 시 미충족 일자 존재    | 정상 종료, stats에 `endReason='maxPagesReached'` + `unfilledDays[]` 기록                               |

## 5. 테스트 / 마이그레이션 / 위험

### 5.1 테스트 전략

| 레벨 | 대상                                    | 방법                                                                                                           |
| ---- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 단위 | `collectByDayWindowDescending` 알고리즘 | mock 검색 페이지 fixture(단조감소 정렬) + `fetchPost` stub. 일자 점프, cap 준수, consecutiveOld 임계 동작 검증 |
| 단위 | `RunOptions.mode` → 기본값 분기         | mode=incremental → perDay=50, mode=backfill → perDay=200. mode 미지정 시 backward compat (legacy 경로)         |
| 계약 | DC `span.date_time` 파싱                | 기존 `parseDateTextOrNull` 테스트에 DC 포맷 케이스 추가                                                        |
| 통합 | sub/37 한동훈 실데이터                  | dev 환경에서 mode=backfill, windowDays=7로 실행 → 일자별 분포 균등성 확인                                      |
| 회귀 | fmkorea/네이버/youtube                  | 변경 없음 확인 (기존 테스트 그대로 통과)                                                                       |

### 5.2 마이그레이션 / 롤아웃

DB 스키마 변경 **없음**. 기존 `collection_runs.trigger_type` 컬럼 ('schedule' | 'manual') 의미 매핑:

- `schedule` = incremental
- `manual` = backfill

**단계:**

1. `community-base-collector.ts` 신규 메서드 추가 (기존 분기 영향 없음)
2. `dcinside.ts` / `clien.ts`에 `sortedByDateDescending = true` 플래그
3. `executor.ts`에 `mode` 파라미터 처리 (기본값 = 'incremental')
4. `scanner.ts`에서 자동 enqueue 시 mode='incremental' 명시
5. `subscriptions.ts` tRPC에 `backfill` mutation 추가
6. (선택) UI에 백필 버튼 — 별도 작업으로 분리

### 5.3 모니터링

- `endReason` 메타(maxPagesReached, allDaysFilled, blocked)를 logCollectionEnd로 stdout 기록
- 백필 mutation 호출 시 trigger_type='manual' + items_collected/items_new로 dashboard 가시성 확보 (기존 UI 활용)

### 5.4 위험과 완화

| 위험                                     | 영향                                  | 완화                                                                                                     |
| ---------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| DC가 향후 검색 정렬을 바꿈 (latest 깨짐) | dayIdx 점프 로직 오작동 → 데이터 누락 | `sortedByDateDescending` 플래그를 collector 단위로 명시. 깨지면 false로 강등하면 즉시 legacy 경로로 회귀 |
| 백필 도중 차단                           | run 실패 + 일부 일자만 채워짐         | 일자별 yield라 partial commit 보장. 동일 윈도우로 재실행 시 dedup으로 자연 보충                          |
| 핫 키워드 백필이 워커 점유 (단일 큐)     | 일일 증분 지연                        | 1차는 사용자가 backfill 시점 통제(A안). 빈도 늘면 별도 큐로 진화                                         |
| 검색결과 publishedAt 파싱 실패율 ↑       | 보수적 fetch 증가 → 비용 증가         | 기존 `parseDateTextOrNull` 폴백 그대로. 실패율 모니터링 후 셀렉터 보강                                   |
| windowDays 너무 큼 (예: 365)             | 시간 폭발                             | tRPC input 검증: `windowDays ≤ 90` 강제                                                                  |

### 5.5 변경 파일 요약

| 파일                                                           | 변경                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/collectors/src/adapters/community-base-collector.ts` | `sortedByDateDescending()` 추가, doCollect 분기 +1, `collectByDayWindowDescending` 신규 |
| `packages/collectors/src/adapters/dcinside.ts`                 | `sortedByDateDescending = true` 한 줄                                                   |
| `packages/collectors/src/adapters/clien.ts`                    | 동일                                                                                    |
| `packages/collectors/src/adapters/base.ts` (또는 types)        | `CollectionOptions`에 `mode?: 'incremental' \| 'backfill'` 추가                         |
| `apps/collector/src/queue/executor.ts`                         | `RunOptions.mode` 처리, mode별 perDay/maxPages 기본값                                   |
| `apps/collector/src/scheduler/scanner.ts`                      | enqueue 시 mode='incremental' 명시                                                      |
| `apps/collector/src/server/trpc/subscriptions.ts`              | `backfill` mutation 신규                                                                |
| `packages/collectors/tests/dcinside.test.ts`                   | 일자 윈도우 알고리즘 케이스 추가                                                        |

## 6. 향후 진화 여지

- **incremental cap 구독별 override**: 핫 키워드 식별 후 perDay 상향
- **별도 큐 분리**: 백필 빈도가 늘어 일일 증분과 충돌 시 별도 BullMQ queue로 분리, 우선순위/동시성 별도 튜닝
- **시간대 단위 윈도우**: 사이트가 시각 필터 API를 추가하면 6시간 등 더 잘게
- **fmkorea-style date param 지원**: DC가 향후 검색 API를 확장하면 `supportsDateRangeSearch=true`로 승격
