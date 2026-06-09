# 에펨코리아 스크래핑 진단 리포트

> **날짜**: 2026-04-18
> **대상**: `packages/collectors/src/adapters/fmkorea.ts` + `community-base-collector.ts`
> **방법**: 프로덕션 DB 분석 + 실제 사이트 DOM 실측 + 코드 리뷰

## 진단 요약

현재 구현은 **B+ 수준**으로, 기본 수집·안티봇·성능이 잘 되어 있지만 4가지 실측 갭이 확인됨.

| #   | 갭                               | 심각도       | 영향                                        |
| --- | -------------------------------- | ------------ | ------------------------------------------- |
| G1  | 대댓글 전혀 감지 못함            | **Critical** | DB 8225건 댓글 중 parent_id 0건             |
| G2  | 댓글 페이지네이션 미처리 (cpage) | **High**     | 댓글 100+건 글에서 1페이지만 수집           |
| G3  | 검색 결과 메타데이터 미추출      | Medium       | 작성자·추천수·댓글수를 검색단계에서 놓침    |
| G4  | 짧은 본문 (10~19자) 182건        | Low          | content = title 복사 (xe_content 추출 실패) |

## G1: 대댓글 감지 실패 (Critical)

### 현상

- DB `comments` 테이블에서 `source='fmkorea'` 8225건 **전부** `parent_id = NULL`
- 대댓글이 하나도 감지되지 않음

### 원인

현재 코드 (`fmkorea.ts:287`):

```typescript
const depth = $parent.hasClass('fdb_itm_answer') ? '1' : '0';
```

**실제 DOM** (2026-04-18 실측):

```html
<!-- 일반 댓글 -->
<li id="comment_9718017160" class="fdb_itm clear  comment-9718017163">
  <!-- 대댓글 (depth 1) -->
</li>

<li id="comment_9720736873" class="fdb_itm clear re bg1  comment-9720736876" style="margin-left:2%">
  <!-- 대댓글 (depth 2) -->
</li>

<li id="comment_9720765672" class="fdb_itm clear re bg0  comment-9720765675" style="margin-left:4%">
  <!-- 대댓글 (depth 3) -->
</li>

<li
  id="comment_9720770223"
  class="fdb_itm clear re bg1  comment-9720770226"
  style="margin-left:6%"
></li>
```

- **`fdb_itm_answer` 클래스는 존재하지 않음** — 대댓글은 `re` 클래스로 표시
- **`data-parent` 속성도 없음** — 부모 관계는 `id` vs `class`의 comment 번호 차이로 추적
- **`margin-left`** 스타일로 depth 표시 (2% = depth 1, 4% = depth 2, ...)

### 부모 댓글 추적 방법

`<li id="comment_X" class="fdb_itm ... comment-Y">` 구조에서:

- `Y` = 해당 댓글의 실제 ID (comment_srl)
- `X` = **부모 댓글의 comment_srl** (일반 댓글은 X ≈ Y-3, 대댓글은 X = 부모의 Y)

**확인된 패턴**:
| 유형 | id (comment_X) | class (comment-Y) | margin-left |
|------|----------------|-------------------|-------------|
| 일반 | 9718017160 | 9718017163 | 없음 |
| 대댓글 depth 1 | 9720736873 | 9720736876 | 2% |
| 대댓글 depth 2 | 9720765672 | 9720765675 | 4% |
| 대댓글 depth 3 | 9720770223 | 9720770226 | 6% |

> **주의**: 일반 댓글도 `id ≠ class`이므로 단순히 `id ≠ class`로 대댓글을 판별할 수 없음.
> 대댓글 판별은 `re` 클래스 존재 여부 또는 `margin-left` 스타일로 해야 함.

### 수정 방향

```typescript
// 대댓글 감지: re 클래스 또는 margin-left 스타일
const isReply = $parent.hasClass('re') || !!$parent.css('margin-left');
const depth = isReply
  ? Math.round(parseInt($parent.css('margin-left') || '2') / 2).toString()
  : '0';

// 부모 댓글: re 클래스일 때, id 속성의 번호가 부모 comment_srl
// 단, 이 번호는 부모의 class comment-Y가 아닌 id comment_X
// → 정확한 매핑을 위해 댓글 목록을 순서대로 순회하며 가장 최근 상위 depth 댓글을 부모로 매핑
```

---

## G2: 댓글 페이지네이션 미처리 (High)

### 현상

- 70댓글 게시글에서 71개 `fdb_itm` 확인 (1페이지 분량)
- `cpage=2` 링크 존재 → 댓글 100건 이상 글에서 2페이지 이후 누락

### 실측 DOM

```
document_srl=9703004172&mid=humor&cpage=1#comment
document_srl=9703004172&mid=humor&cpage=2#comment
```

### 현재 코드

- `fetchPost()`에서 본문 HTML만 파싱 → 첫 페이지 댓글만 수집
- `cpage` 파라미터로 추가 요청하는 로직 없음

### 영향

- DB에서 게시글당 최대 댓글 수: 70건 (프로덕션 데이터 확인)
- 댓글 100건 이상 게시글에서 댓글 손실 발생

### 수정 방향

```
fetchPost() 내:
1. 본문 HTML에서 cpage 최대값 파싱
2. cpage=2 ~ cpage=N 각각 fetch (댓글 영역만)
3. 각 페이지 댓글을 comments 배열에 병합
```

---

## G3: 검색 결과 메타데이터 미추출 (Medium)

### 현상

검색 결과 HTML에 **작성자**, **추천수**, **댓글수**가 포함되어 있으나 미추출.

### 실측 DOM

```html
<address>
  <strong>다미스마고</strong> ← 작성자 | <span class="time">2026-04-17 11:24</span> ← 시간 (추출 중)
  | <span class="recom">추천 수</span> <span class="recomNum">52</span> ← 추천수
</address>
<span class="reply">[<em>20</em>]</span> ← 댓글수
```

### 현재 코드

`parseSearchResults()`에서 `url`, `title`, `publishedAt`만 추출.
`author`, `recomNum`, `reply count`는 무시.

### 개선 가치

- **사전 필터 강화**: 추천수 0, 댓글수 0인 게시글 스킵 → 안티봇 부담 절감
- **데이터 완전성**: 본문 진입 전 메타데이터 확보

---

## G4: 짧은 본문 182건 (Low)

### 현상

- `content` 길이 < 20자: 182건/1618건 (11.2%)
- 대부분 `content = title` 복사 (본문 추출 실패 시 fallback)

### 샘플

```
fm_9656229338: title="[국내축구] 오세훈" content="[국내축구] 오세훈" (10자)
```

### 원인 추정

1. 이미지/동영상만 있는 게시글 (텍스트 본문 없음)
2. `.xe_content` 셀렉터 매칭 실패 (게시판별 다른 DOM)
3. fetch 차단으로 HTML 불완전

### 현재 코드 (`fmkorea.ts:254`)

```typescript
content: content || title,  // 본문 없으면 제목으로 대체
```

### 수정 방향

- 이미지/동영상 URL도 content에 포함 (img src, video src 추출)
- 또는 content가 title과 동일하면 raw_data에 `contentFallback: true` 플래그 추가

---

## 안티봇 현황 (양호)

### 이미 대응 중 (✅)

| 메커니즘              | 대응 수준                                            |
| --------------------- | ---------------------------------------------------- |
| WASM lite_year 챌린지 | 95% — 폴링 대기, 쿠키 캐싱                           |
| HTTP 429/430          | 90% — 7가지 차단 신호 감지                           |
| Rate limiting         | 85% — 지수 백오프(10s→160s), 연속 빈 페이지 5회 허용 |
| 헤더 위조             | 80% — UA 3종 로테이션, Referer, Accept-Language      |
| 딜레이                | 90% — pageDelay 2-3.5s, postDelay 0.4-0.8s           |

### 미대응 (⚠️)

| 메커니즘             | 위험도 | 비고                                |
| -------------------- | ------ | ----------------------------------- |
| IP 로테이션/프록시   | Medium | 단일 IP → 장기 수집 시 IP ban 위험  |
| Playwright stealth   | Low    | 기본 headless → webdriver 감지 가능 |
| JS fingerprint 방어  | Low    | canvas, WebGL 핑거프린팅 미방어     |
| 동적 rate-limit 조정 | Low    | X-RateLimit 헤더 미활용             |

### 프로덕션 실적

- 최근 10개 Job 중 fmkorea `pageEmpty=0` (차단 없음)
- `reason=pageLimitReached` (80페이지 한도 도달) — **차단보다 한도가 먼저 도달**
- **결론**: 현재 안티봇 대응 충분, 프록시/stealth는 우선순위 낮음

---

## s_date/e_date 날짜 필터 검증

**실험**: `s_date=2026-04-15&e_date=2026-04-15`로 요청 → 4/18 결과 반환.

**결론**: 서버에서 무시됨 확인. `supportsDateRangeSearch() = false`는 **올바른 설정**.

---

## 성능 현황

| 지표               | 값     | 비고                   |
| ------------------ | ------ | ---------------------- |
| 검색 페이지당 결과 | 10건   | 에펨 고정              |
| 페이지 처리 시간   | ~3-4초 | fetch 전환 후          |
| 게시글당 처리 시간 | ~0.6초 | fetch 우선             |
| 80페이지 전체      | ~5-7분 | 800건 스캔, 160건 수집 |
| 사전 필터 효율     | ~40%   | preFilterSkip ~343/800 |

**bottleneck**: 페이지당 10건 × 80페이지 = 800건 최대 스캔. 날짜 필터 미지원으로 레거시 순차 모드만 가능.

---

## 우선순위 로드맵

| 순서 | 갭                          | 예상 작업량 | ROI                                      |
| ---- | --------------------------- | ----------- | ---------------------------------------- |
| 1    | G1: 대댓글 감지 수정        | 2-3시간     | **Critical** — 여론 분석 품질 직결       |
| 2    | G2: 댓글 cpage 페이지네이션 | 3-4시간     | **High** — 댓글 많은 핵심 글 누락 방지   |
| 3    | G3: 검색 메타데이터 추출    | 1-2시간     | Medium — 사전 필터 강화                  |
| 4    | G4: 짧은 본문 개선          | 1시간       | Low — 이미지/영상만 글은 자연스러운 한계 |
