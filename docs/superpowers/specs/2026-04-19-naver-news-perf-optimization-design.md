# 네이버뉴스 수집기 성능 최적화 설계

## 요약

`NaverNewsCollector`의 Phase 2(기사 본문 수집)를 **Playwright 순차 처리 → fetch 병렬 처리**로 전환하여 100건 기준 300-650초 → 20-40초로 **8-16배 성능 개선**.

## 현재 구조와 병목

```
Phase 1: 검색 목록 수집 (fetch + Cheerio) ← 빠름 (~200ms/페이지)
  ↓ allArticles[] (URL + 메타데이터)
Phase 2: 기사 본문 수집 (Playwright 순차) ← 병목 (기사당 3-6초)
  ↓ yield enriched[]
```

Phase 2 병목 내역:
- `page.goto()`: 2-5초 (Chromium 렌더링)
- `page.waitForTimeout(500)`: 고정 대기
- `sleep(500~1000ms)`: rate limiting 방지 딜레이
- 합계: 기사당 3-6.5초, 100건 → 300-650초

## 핵심 발견: Playwright 불필요

네이버뉴스 기사 본문은 **SSR(Server-Side Rendering)**로 제공된다.
5개 언론사(연합뉴스/조선일보/MBC/SBS/한겨레) 실측 결과:
- `fetch` 응답: HTTP 200, ~115ms, ~200KB HTML
- `#newsct_article` 셀렉터로 본문 추출: 100% 성공
- `data-date-time` 속성으로 게시 시각 추출: 100% 성공
- **JS 렌더링 필요 없음**

## 설계

### 변경 범위

**파일**: `packages/collectors/src/adapters/naver-news.ts` (단일 파일)

### 변경 1: `fetchArticleContent` → fetch 기반 + Playwright 폴백

```
기존: fetchArticleContent(page: Page, url: string)
      → page.goto() → page.content() → cheerio.load()

신규: fetchArticleContent(url: string, fallbackPage?: Page)
      → fetch(url) → cheerio.load()
      → 실패 시 fallbackPage?.goto() (Playwright 폴백)
```

파싱 로직(`data-date-time` 추출, `contentSelectors` 순회)은 **기존 그대로** 유지.
`parseArticleHtml(html)` 공통 메서드로 추출하여 fetch/Playwright 양쪽에서 재사용.

### 변경 2: Phase 2 병렬화

```
기존: for (article of batch) { await fetchArticleContent(page, article.url); }

신규: await Promise.all(batch.map(article =>
        semaphore.acquire() → fetchArticleContent(article.url) → semaphore.release()
      ));
```

동시성 제어:
- 기본 동시성: **5** (CONCURRENCY 상수)
- 요청 간 미세 딜레이: 50-150ms (burst 방지)
- 외부 의존성 추가 없음: 간단한 세마포어 패턴 사용

### 변경 3: 적응형 Playwright 폴백

fetch 연속 실패 시 자동 Playwright 전환:

```
fetchFailCount ≥ 5 → Playwright 브라우저 기동 → 이후 기사는 Playwright로 수집
```

이렇게 하면:
- **정상 상황**: Playwright 브라우저를 아예 기동하지 않음 → 메모리 절약
- **네이버 차단/구조 변경**: 자동으로 Playwright 폴백 → 수집 실패 방지

### Phase 2 전체 흐름

```
targetArticles[] (Phase 1에서 확정, perDayLimit 이미 적용됨)
  ↓
배치 분할 (BATCH_SIZE = 10)
  ↓
배치 내 병렬 처리 (CONCURRENCY = 5)
  ├─ fetch(url) + Cheerio 파싱 (정상 경로, ~100-300ms)
  └─ fetch 실패 → Playwright 폴백 (예외 경로, ~3-5초)
  ↓
publishedAt 보정 (data-date-time)
  ↓
yield enriched[]
```

### perDayLimit과의 관계

Phase 2 병렬화는 perDayLimit과 **완전히 독립적**:
- perDayLimit은 Phase 1에서 이미 확정 (allArticles[] 크기 결정)
- Phase 2는 확정된 URL 목록의 본문만 가져옴
- 어떤 순서/동시성으로 본문을 가져오든 cap에 영향 없음
- publishedAt 보정도 cap 위반을 일으키지 않음 (enforcePerDayCap은 Phase 1에서 완료)

## 성능 예측

| 시나리오 | 현재 (순차 Playwright) | 개선 후 (fetch 병렬) | 개선율 |
|---------|----------------------|---------------------|--------|
| 50건 | 150-325초 | 10-20초 | ~15x |
| 100건 | 300-650초 | 20-40초 | ~15x |
| 200건 | 600-1300초 | 40-80초 | ~15x |

추가 이점:
- Playwright 미기동 시 메모리 ~300-500MB 절약
- Chromium 프로세스 관리 오버헤드 제거

## 리스크 및 대응

| 리스크 | 확률 | 대응 |
|--------|------|------|
| 네이버 fetch 차단 (429) | 낮음 (기사 본문은 공개) | 적응형 Playwright 폴백 자동 전환 |
| SSR 아닌 기사 존재 | 매우 낮음 (n.news.naver.com은 모두 SSR) | Playwright 폴백으로 커버 |
| 동시 요청으로 IP 차단 | 중간 | 동시성 5 제한 + 50-150ms 딜레이 |
| 기존 테스트 깨짐 | 낮음 (테스트 없음 확인 필요) | 파싱 로직 동일 유지 |

## 변경하지 않는 것

- Phase 1 (검색 목록 수집): 현재 fetch + Cheerio 방식 유지 (이미 빠름)
- perDayLimit / enforcePerDayCap 로직: 변경 없음
- TTL 재사용 로직: 변경 없음
- 검색 결과 파서 (3단계 폴백): 변경 없음
- 댓글 수집기 (`naver-comments.ts`): 변경 없음
- `naver-parser.ts` 유틸리티: 변경 없음

## 구현 단계

1. `parseArticleHtml(html)` 메서드 추출 (기존 fetchArticleContent에서 Cheerio 파싱 부분)
2. `fetchArticleContent` 시그니처 변경 (Page → url + fallbackPage?)
3. fetch 우선 로직 구현 (헤더: User-Agent, Accept-Language, Referer)
4. Phase 2에 세마포어 기반 병렬화 적용
5. 적응형 Playwright 폴백 (fetchFailCount 기반)
6. `collect()` 메서드에서 browser 기동 조건 변경 (폴백 시에만)
7. 기존 테스트 확인 및 수동 검증
