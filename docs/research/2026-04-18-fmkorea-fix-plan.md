# 에펨코리아 스크래핑 4가지 갭 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 에펨코리아 수집기의 4가지 실측 갭(대댓글 감지, 댓글 페이지네이션, 검색 메타데이터, 짧은 본문)을 수정하여 데이터 완전성을 확보한다.

**Architecture:** `fmkorea.ts`의 `parseComments()`, `fetchPost()`, `parseSearchResults()` 3개 메서드를 수정. 새 파일 없이 기존 파일만 변경. 테스트는 실제 DOM HTML 스냅샷 기반 유닛 테스트.

**Tech Stack:** TypeScript, Cheerio, Vitest, fetch API

**진단 리포트:** `docs/research/2026-04-18-fmkorea-scraping-diagnosis.md`

---

## File Map

| 파일                                                       | 변경 유형 | 역할                 |
| ---------------------------------------------------------- | --------- | -------------------- |
| `packages/collectors/src/adapters/fmkorea.ts`              | Modify    | G1~G4 전부 수정      |
| `packages/collectors/tests/fmkorea.test.ts`                | Modify    | 유닛 테스트 추가     |
| `packages/collectors/tests/fixtures/fmkorea-comments.html` | Create    | 댓글 DOM 스냅샷      |
| `packages/collectors/tests/fixtures/fmkorea-search.html`   | Create    | 검색 결과 DOM 스냅샷 |
| `packages/collectors/tests/fixtures/fmkorea-post.html`     | Create    | 본문 DOM 스냅샷      |

---

### Task 1: 테스트 픽스처 생성 (댓글 DOM 스냅샷)

**Files:**

- Create: `packages/collectors/tests/fixtures/fmkorea-comments.html`
- Create: `packages/collectors/tests/fixtures/fmkorea-search.html`
- Create: `packages/collectors/tests/fixtures/fmkorea-post.html`

- [ ] **Step 1: 댓글 DOM 픽스처 생성**

실측된 에펨코리아 댓글 HTML 구조를 축약 재현. 일반 댓글 + 대댓글(depth 1~3) + 일반 댓글 순서.

`packages/collectors/tests/fixtures/fmkorea-comments.html`:

```html
<ul class="fdb_lst_ul">
  <!-- 일반 댓글 -->
  <li id="comment_100" class="fdb_itm clear  comment-103">
    <div class="meta">
      <span class="member_plate">유저A</span>
      <span class="date">2026.04.17 10:30</span>
    </div>
    <div class="xe_content">일반 댓글 내용입니다.</div>
    <span class="voted_count">5</span>
  </li>
  <!-- 대댓글 depth 1 -->
  <li id="comment_103" class="fdb_itm clear re bg1  comment-106" style="margin-left:2%">
    <div class="meta">
      <span class="member_plate">유저B</span>
      <span class="date">2026.04.17 10:35</span>
    </div>
    <div class="xe_content">대댓글 depth 1</div>
    <span class="voted_count">2</span>
  </li>
  <!-- 대댓글 depth 2 -->
  <li id="comment_106" class="fdb_itm clear re bg0  comment-109" style="margin-left:4%">
    <div class="meta">
      <span class="member_plate">유저C</span>
      <span class="date">2026.04.17 10:40</span>
    </div>
    <div class="xe_content">대댓글 depth 2</div>
    <span class="voted_count">0</span>
  </li>
  <!-- 대댓글 depth 3 -->
  <li id="comment_109" class="fdb_itm clear re bg1  comment-112" style="margin-left:6%">
    <div class="meta">
      <span class="member_plate">유저D</span>
      <span class="date">2026.04.17 10:45</span>
    </div>
    <div class="xe_content">대댓글 depth 3</div>
    <span class="voted_count">1</span>
  </li>
  <!-- 다른 일반 댓글 -->
  <li id="comment_200" class="fdb_itm clear  comment-203">
    <div class="meta">
      <span class="member_plate">유저E</span>
      <span class="date">2026.04.17 11:00</span>
    </div>
    <div class="xe_content">두 번째 일반 댓글</div>
    <span class="voted_count">3</span>
  </li>
</ul>
```

- [ ] **Step 2: 검색 결과 DOM 픽스처 생성**

`packages/collectors/tests/fixtures/fmkorea-search.html`:

```html
<ul class="searchResult">
  <li>
    <dl>
      <dt>
        <a href="/9717731660">[주식] 전략지도 장중 브리핑</a>
        <span class="reply">[<em>20</em>]</span>
      </dt>
      <dd>본문 미리보기 텍스트...</dd>
    </dl>
    <address>
      <strong>작성자A</strong>
      | <span class="time">2026-04-17 11:24</span> | <span class="recom">추천 수</span>
      <span class="recomNum">52</span>
    </address>
  </li>
  <li>
    <dl>
      <dt>
        <a href="/9717800735">[주식] 미국 입장에서 이란, 북한 차이</a>
        <span class="reply">[<em>3</em>]</span>
      </dt>
      <dd>본문 미리보기...</dd>
    </dl>
    <address>
      <strong>작성자B</strong>
      | <span class="time">2026-04-17 10:16</span> | <span class="recom">추천 수</span>
      <span class="recomNum">3</span>
    </address>
  </li>
</ul>
```

- [ ] **Step 3: 본문 DOM 픽스처 생성**

`packages/collectors/tests/fixtures/fmkorea-post.html`:

```html
<html>
  <body>
    <h1 class="page_name">정치/시사</h1>
    <div class="member_plate">게시글작성자</div>
    <span class="date m_no">2026.04.17 14:16</span>
    <span class="count">조회 1234</span>
    <span class="voted_count">56</span>
    <div class="rd_body">
      <div class="xe_content">
        <p>이것은 본문 내용입니다. 충분히 긴 텍스트를 포함합니다.</p>
        <p>두 번째 문단입니다.</p>
      </div>
    </div>
    <!-- 댓글 페이지네이션 (cpage) -->
    <div class="fdb_lst_ul_wrap">
      <ul class="fdb_lst_ul">
        <li id="comment_500" class="fdb_itm clear  comment-503">
          <div class="meta">
            <span class="member_plate">댓글러1</span>
            <span class="date">2026.04.17 15:00</span>
          </div>
          <div class="xe_content">첫 댓글</div>
          <span class="voted_count">1</span>
        </li>
      </ul>
    </div>
    <!-- cpage 링크 -->
    <a href="/9717731660?document_srl=9717731660&mid=politics&cpage=2#9717731660_comment">2</a>
    <a href="/9717731660?document_srl=9717731660&mid=politics&cpage=3#9717731660_comment">3</a>
  </body>
</html>
```

- [ ] **Step 4: 커밋**

```bash
git add packages/collectors/tests/fixtures/
git commit -m "test: 에펨코리아 테스트 픽스처 추가 (댓글/검색/본문 DOM 스냅샷)"
```

---

### Task 2: G1 — 대댓글 감지 수정 (Critical)

**Files:**

- Modify: `packages/collectors/src/adapters/fmkorea.ts:360-398` (parseComments 메서드)
- Modify: `packages/collectors/tests/fmkorea.test.ts`

- [ ] **Step 1: 대댓글 감지 테스트 작성**

`packages/collectors/tests/fmkorea.test.ts`에 추가:

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as cheerio from 'cheerio';

// parseComments는 private이므로 HTML 파싱 결과를 검증하는 통합 방식 사용.
// FMKoreaCollector를 상속한 테스트용 클래스로 protected/private 메서드 노출.
class TestFMKoreaCollector extends FMKoreaCollector {
  public testParseComments($: cheerio.CheerioAPI, postSourceId: string, maxComments: number) {
    return (this as any).parseComments($, postSourceId, maxComments);
  }
}

describe('FMKoreaCollector parseComments', () => {
  const html = readFileSync(resolve(__dirname, 'fixtures/fmkorea-comments.html'), 'utf-8');
  const $ = cheerio.load(html);
  const collector = new TestFMKoreaCollector();

  it('일반 댓글과 대댓글을 모두 수집', () => {
    const comments = collector.testParseComments($, 'fm_test', 100);
    expect(comments.length).toBe(5);
  });

  it('대댓글(re 클래스)의 parentId가 설정됨', () => {
    const comments = collector.testParseComments($, 'fm_test', 100);
    // 일반 댓글: parentId = null
    expect(comments[0].parentId).toBeNull();
    // 대댓글 depth 1: parentId = 부모(일반 댓글)의 sourceId
    expect(comments[1].parentId).toBe('fm_comment_103');
    // 대댓글 depth 2: parentId = depth 1 댓글의 sourceId
    expect(comments[2].parentId).toBe('fm_comment_106');
    // 대댓글 depth 3: parentId = depth 2 댓글의 sourceId
    expect(comments[3].parentId).toBe('fm_comment_109');
    // 두 번째 일반 댓글: parentId = null
    expect(comments[4].parentId).toBeNull();
  });

  it('대댓글의 작성자/내용/추천수가 올바르게 추출됨', () => {
    const comments = collector.testParseComments($, 'fm_test', 100);
    expect(comments[1].author).toBe('유저B');
    expect(comments[1].content).toContain('대댓글 depth 1');
    expect(comments[1].likeCount).toBe(2);
  });

  it('maxComments 제한이 동작', () => {
    const comments = collector.testParseComments($, 'fm_test', 3);
    expect(comments.length).toBe(3);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd packages/collectors && pnpm test -- --run tests/fmkorea.test.ts
```

Expected: FAIL — `parentId`가 전부 null (기존 `fdb_itm_answer` 감지 실패).

- [ ] **Step 3: parseComments 메서드 수정**

`packages/collectors/src/adapters/fmkorea.ts`의 `parseComments` 메서드를 **전체 교체**:

```typescript
/** HTML에서 댓글 파싱 — re 클래스로 대댓글 감지, id 속성으로 부모 추적 */
private parseComments(
  $: cheerio.CheerioAPI,
  postSourceId: string,
  maxComments: number,
): CommunityComment[] {
  const comments: CommunityComment[] = [];
  const $items = $('.fdb_lst_ul > li.fdb_itm');
  if ($items.length === 0) return comments;

  $items.each((_, el) => {
    if (comments.length >= maxComments) return;
    const $li = $(el);

    const content = sanitizeContent($li.find('.xe_content').first().html() ?? '');
    if (!content) return;

    // comment_srl: class="... comment-{srl}" 에서 추출
    const classAttr = $li.attr('class') ?? '';
    const srlMatch = classAttr.match(/comment-(\d+)/);
    const commentSrl = srlMatch ? srlMatch[1] : `${postSourceId}_c${comments.length}`;

    // 대댓글 판별: re 클래스 존재
    const isReply = $li.hasClass('re');

    // 부모 댓글: id="comment_{parentSrl}" — 대댓글일 때 id의 번호가 부모의 comment_srl
    let parentId: string | null = null;
    if (isReply) {
      const idAttr = $li.attr('id') ?? '';
      const parentMatch = idAttr.match(/comment_(\d+)/);
      if (parentMatch) {
        parentId = `fm_comment_${parentMatch[1]}`;
      }
    }

    const author = $li.find('.member_plate, .author').first().text().trim() || '익명';
    const dateText = $li.find('.date, .regdate').first().text().trim();

    comments.push({
      sourceId: `fm_comment_${commentSrl}`,
      parentId,
      content,
      author,
      likeCount: parseInt($li.find('.voted_count').first().text() || '0', 10),
      dislikeCount: 0,
      publishedAt: parseDateText(dateText),
      rawData: { dateText, isReply },
    });
  });

  return comments;
}
```

핵심 변경:

- `fdb_itm_answer` → `re` 클래스로 대댓글 감지
- `data-parent` → `id="comment_{parentSrl}"` 에서 부모 추적
- `$el.closest('li, .fdb_itm')` → `$('.fdb_lst_ul > li.fdb_itm').each()` — 댓글 단위 직접 순회 (xe_content 기반이 아닌 li 단위)
- selectors.comment 폴백 로직 제거 — `fdb_lst_ul > li.fdb_itm` 직접 사용

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd packages/collectors && pnpm test -- --run tests/fmkorea.test.ts
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/collectors/src/adapters/fmkorea.ts packages/collectors/tests/fmkorea.test.ts
git commit -m "fix(fmkorea): 대댓글 감지 수정 — re 클래스 + id 기반 부모 추적

기존 fdb_itm_answer 클래스는 에펨 DOM에 존재하지 않음.
실제 구조: re 클래스 = 대댓글, id=comment_{parentSrl} = 부모 참조."
```

---

### Task 3: G2 — 댓글 cpage 페이지네이션

**Files:**

- Modify: `packages/collectors/src/adapters/fmkorea.ts:268-358` (fetchPost 메서드)
- Modify: `packages/collectors/tests/fmkorea.test.ts`

- [ ] **Step 1: cpage 파싱 테스트 작성**

`packages/collectors/tests/fmkorea.test.ts`에 추가:

```typescript
class TestFMKoreaCollector extends FMKoreaCollector {
  // 이미 Task 2에서 추가한 클래스에 메서드 추가
  public testParseCpageMax($: cheerio.CheerioAPI): number {
    return (this as any).parseCpageMax($);
  }
}

describe('FMKoreaCollector cpage 파싱', () => {
  it('cpage 링크에서 최대 페이지 번호를 추출', () => {
    const html = readFileSync(resolve(__dirname, 'fixtures/fmkorea-post.html'), 'utf-8');
    const $ = cheerio.load(html);
    const collector = new TestFMKoreaCollector();
    const maxCpage = collector.testParseCpageMax($);
    expect(maxCpage).toBe(3);
  });

  it('cpage 링크가 없으면 1 반환', () => {
    const $ = cheerio.load('<html><body><div class="fdb_lst_ul"></div></body></html>');
    const collector = new TestFMKoreaCollector();
    expect(collector.testParseCpageMax($)).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd packages/collectors && pnpm test -- --run tests/fmkorea.test.ts
```

Expected: FAIL — `parseCpageMax` 메서드 미존재.

- [ ] **Step 3: parseCpageMax 메서드 추가 + fetchPost에 cpage 순회 로직 추가**

`packages/collectors/src/adapters/fmkorea.ts`에 새 private 메서드 추가:

```typescript
/** 본문 HTML에서 댓글 최대 cpage 추출 */
private parseCpageMax($: cheerio.CheerioAPI): number {
  let max = 1;
  $('a[href*="cpage="]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/cpage=(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return max;
}
```

`fetchPost` 메서드의 댓글 수집 부분을 수정 — 기존 `this.parseComments($, sourceId, maxComments)` 호출 부분을:

```typescript
// 댓글 수집 — 1페이지(현재 HTML) + cpage 2~N 추가 fetch
let comments = this.parseComments($, sourceId, maxComments);
const maxCpage = this.parseCpageMax($);
if (maxCpage > 1 && comments.length < maxComments) {
  // document_srl 추출 (URL에서)
  const docSrlMatch = url.match(/\/(\d+)/);
  const docSrl = docSrlMatch ? docSrlMatch[1] : null;
  if (docSrl) {
    for (let cp = 2; cp <= maxCpage; cp++) {
      if (comments.length >= maxComments) break;
      try {
        const cpageUrl = `${url}?document_srl=${docSrl}&cpage=${cp}`;
        const cookies = await page
          .context()
          .cookies('https://www.fmkorea.com')
          .catch(() => []);
        const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        const cpRes = await fetch(cpageUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            Referer: url,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
        });
        if (cpRes.ok) {
          const cpHtml = await cpRes.text();
          const cp$ = cheerio.load(cpHtml);
          const remaining = maxComments - comments.length;
          const pageComments = this.parseComments(cp$, sourceId, remaining);
          comments = comments.concat(pageComments);
        }
      } catch {
        console.warn(`[fmkorea] 댓글 cpage=${cp} fetch 실패: ${url}`);
      }
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
    }
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd packages/collectors && pnpm test -- --run tests/fmkorea.test.ts
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/collectors/src/adapters/fmkorea.ts packages/collectors/tests/fmkorea.test.ts
git commit -m "feat(fmkorea): 댓글 cpage 페이지네이션 지원

100건 이상 댓글 게시글에서 cpage=2~N을 순회하여 전체 댓글 수집.
fetch 기반으로 추가 요청, 실패 시 경고만 출력하고 계속 진행."
```

---

### Task 4: G3 — 검색 결과 메타데이터 추출

**Files:**

- Modify: `packages/collectors/src/adapters/fmkorea.ts:203-262` (parseSearchResults 메서드)
- Modify: `packages/collectors/tests/fmkorea.test.ts`

- [ ] **Step 1: 검색 메타데이터 테스트 작성**

`packages/collectors/tests/fmkorea.test.ts`에 추가:

```typescript
describe('FMKoreaCollector parseSearchResults', () => {
  const collector = new TestFMKoreaCollector();

  it('작성자, 추천수, 댓글수를 추출', () => {
    const html = readFileSync(resolve(__dirname, 'fixtures/fmkorea-search.html'), 'utf-8');
    const results = collector.testParseSearchResults(html);
    expect(results.length).toBe(2);

    expect(results[0].author).toBe('작성자A');
    expect(results[0].recomCount).toBe(52);
    expect(results[0].commentCount).toBe(20);
    expect(results[0].publishedAt).toBeInstanceOf(Date);

    expect(results[1].author).toBe('작성자B');
    expect(results[1].recomCount).toBe(3);
    expect(results[1].commentCount).toBe(3);
  });
});
```

`TestFMKoreaCollector`에 메서드 추가:

```typescript
public testParseSearchResults(html: string) {
  return (this as any).parseSearchResults(html);
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd packages/collectors && pnpm test -- --run tests/fmkorea.test.ts
```

Expected: FAIL — `author`, `recomCount`, `commentCount` 속성이 반환값에 없음.

- [ ] **Step 3: parseSearchResults 메서드 수정**

`parseSearchResults`의 반환 타입을 확장하고 1차 파서에서 메타데이터 추출 추가:

```typescript
protected parseSearchResults(
  html: string,
): { url: string; title: string; publishedAt?: Date | null; author?: string; recomCount?: number; commentCount?: number }[] {
  const $ = cheerio.load(html);
  const results: { url: string; title: string; publishedAt?: Date | null; author?: string; recomCount?: number; commentCount?: number }[] = [];

  const parseFmTime = (text: string): Date | null => {
    const m = text.trim().match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
    if (!m) return null;
    const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T${m[4].padStart(2, '0')}:${m[5].padStart(2, '0')}:00+09:00`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  // 1차: 검색 결과 <li> 블록 순회 — 메타데이터 전부 추출
  $('ul.searchResult > li').each((_, li) => {
    const $li = $(li);
    const $a = $li.find('dt > a').first();
    const href = $a.attr('href');
    const title = $a.text().trim();
    if (!href || !title) return;
    const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

    const timeText = $li.find('address .time').first().text().trim();
    const publishedAt = parseFmTime(timeText);

    // 작성자: address > strong
    const author = $li.find('address > strong').first().text().trim() || undefined;
    // 추천수: .recomNum
    const recomText = $li.find('.recomNum').first().text().trim();
    const recomCount = recomText ? parseInt(recomText, 10) : undefined;
    // 댓글수: .reply > em
    const commentText = $li.find('.reply em').first().text().trim();
    const commentCount = commentText ? parseInt(commentText, 10) : undefined;

    results.push({ url, title, publishedAt, author, recomCount, commentCount });
  });
  if (results.length > 0) return results;

  // 2차/3차 폴백은 기존 코드 유지 (메타데이터 없이)
  for (const selector of this.selectors.list) {
    $(selector).each((_, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim();
      if (href && title) {
        const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        results.push({ url, title });
      }
    });
    if (results.length > 0) break;
  }

  if (results.length === 0) {
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const title = $(el).text().trim();
      if (title.length > 5 && (href.match(/\/\d{6,}/) || href.includes('document_srl='))) {
        const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        if (!results.some((r) => r.url === url)) {
          results.push({ url, title });
        }
      }
    });
  }

  return results;
}
```

**주의:** `CommunityBaseCollector`의 `parseSearchResults` 추상 메서드 반환 타입은 `{ url: string; title: string; publishedAt?: Date | null }[]`이므로, 추가 필드(`author`, `recomCount`, `commentCount`)는 optional이라 타입 호환됨. 상위 클래스의 타입을 변경할 필요 없음.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd packages/collectors && pnpm test -- --run tests/fmkorea.test.ts
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/collectors/src/adapters/fmkorea.ts packages/collectors/tests/fmkorea.test.ts
git commit -m "feat(fmkorea): 검색 결과에서 작성자/추천수/댓글수 추출

address > strong (작성자), .recomNum (추천수), .reply em (댓글수) 추출.
사전 필터 및 데이터 완전성 향상."
```

---

### Task 5: G4 — 짧은 본문 개선

**Files:**

- Modify: `packages/collectors/src/adapters/fmkorea.ts:308-313` (fetchPost 본문 추출 부분)
- Modify: `packages/collectors/tests/fmkorea.test.ts`

- [ ] **Step 1: 짧은 본문 개선 테스트 작성**

`packages/collectors/tests/fmkorea.test.ts`에 추가:

```typescript
describe('FMKoreaCollector 본문 추출', () => {
  it('이미지만 있는 게시글에서 img alt/src 텍스트 추출', () => {
    const html = `
      <div class="xe_content">
        <img src="https://img.fmkorea.com/test.jpg" alt="테스트 이미지 설명">
        <img src="https://img.fmkorea.com/test2.jpg">
      </div>
    `;
    const $ = cheerio.load(html);
    const content = extractContentWithMedia($);
    expect(content.length).toBeGreaterThan(20);
    expect(content).toContain('테스트 이미지 설명');
  });

  it('동영상 URL이 있는 게시글에서 URL 추출', () => {
    const html = `
      <div class="xe_content">
        <iframe src="https://www.youtube.com/embed/abc123"></iframe>
      </div>
    `;
    const $ = cheerio.load(html);
    const content = extractContentWithMedia($);
    expect(content).toContain('youtube.com');
  });

  it('텍스트가 충분한 게시글은 기존대로 텍스트만 반환', () => {
    const html = `
      <div class="xe_content">
        <p>이것은 충분히 긴 본문 내용입니다. 여러 문장이 포함되어 있어 본문으로 적합합니다.</p>
      </div>
    `;
    const $ = cheerio.load(html);
    const content = extractContentWithMedia($);
    expect(content).toContain('충분히 긴 본문');
    expect(content).not.toContain('[이미지]');
  });
});
```

여기서 `extractContentWithMedia`는 `fmkorea.ts` 내부 로직의 단위 테스트를 위해 분리한 함수. 실제로는 fetchPost 내의 본문 추출 로직을 분리.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd packages/collectors && pnpm test -- --run tests/fmkorea.test.ts
```

Expected: FAIL — `extractContentWithMedia` 미정의.

- [ ] **Step 3: 본문 추출 로직 개선**

`fmkorea.ts`에 private 메서드 추가:

```typescript
/** xe_content에서 텍스트 + 미디어 참조 추출 (이미지/영상만 글 대응) */
private extractContent($: cheerio.CheerioAPI): string {
  let content = '';
  for (const selector of this.selectors.content) {
    const $el = $(selector).first();
    if (!$el.length) continue;

    // 텍스트 추출
    content = sanitizeContent($el.html() ?? '');
    if (content.length > 20) return content;

    // 텍스트가 짧으면 미디어 참조 보강
    const mediaParts: string[] = [];
    if (content) mediaParts.push(content);

    // img alt 텍스트 또는 [이미지: URL]
    $el.find('img').each((_, img) => {
      const alt = $(img).attr('alt')?.trim();
      const src = $(img).attr('src') ?? '';
      if (alt && alt.length > 2) {
        mediaParts.push(alt);
      } else if (src) {
        mediaParts.push(`[이미지: ${src}]`);
      }
    });

    // iframe (YouTube 등) → [영상: URL]
    $el.find('iframe').each((_, iframe) => {
      const src = $(iframe).attr('src') ?? '';
      if (src) mediaParts.push(`[영상: ${src}]`);
    });

    // video > source → [영상: URL]
    $el.find('video source, video[src]').each((_, v) => {
      const src = $(v).attr('src') ?? '';
      if (src) mediaParts.push(`[영상: ${src}]`);
    });

    const joined = mediaParts.join(' ').trim();
    if (joined.length > content.length) content = joined;
    if (content.length > 10) break;
  }
  return content;
}
```

`fetchPost`에서 본문 추출 부분 수정 — 기존:

```typescript
let content = '';
for (const selector of this.selectors.content) {
  content = sanitizeContent($(selector).first().html() ?? '');
  if (content.length > 10) break;
}
```

교체:

```typescript
const content = this.extractContent($);
```

`rawData`에 본문 fallback 여부 플래그 추가:

```typescript
rawData: { dateText, originalUrl: url, contentFallback: content === title || content.length < 20 },
```

테스트에서 import할 수 있도록 `TestFMKoreaCollector`에 메서드 추가:

```typescript
public testExtractContent($: cheerio.CheerioAPI): string {
  return (this as any).extractContent($);
}
```

테스트의 `extractContentWithMedia` → `collector.testExtractContent` 로 수정.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd packages/collectors && pnpm test -- --run tests/fmkorea.test.ts
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/collectors/src/adapters/fmkorea.ts packages/collectors/tests/fmkorea.test.ts
git commit -m "fix(fmkorea): 이미지/영상만 게시글의 본문 추출 개선

xe_content 텍스트가 짧을 때 img alt, iframe src, video src를 보강.
rawData.contentFallback 플래그 추가."
```

---

### Task 6: 전체 테스트 + lint 검증

**Files:**

- 없음 (검증만)

- [ ] **Step 1: 전체 테스트 실행**

```bash
cd packages/collectors && pnpm test
```

Expected: PASS (기존 테스트 + 신규 테스트 모두)

- [ ] **Step 2: lint 실행**

```bash
pnpm lint
```

Expected: 에러 없음

- [ ] **Step 3: 타입 체크**

```bash
pnpm build --filter @ai-signalcraft/collectors
```

Expected: 빌드 성공 (타입 호환 확인)

- [ ] **Step 4: 최종 커밋 (필요 시)**

lint/format 자동 수정이 있었다면:

```bash
git add -A && git commit -m "style: lint/format 자동 수정"
```
