# 관리자 URL 입력 → 데이터 소스 자동 추가

## Context

ai-signalcraft는 현재 5개 데이터 소스(naver-news, youtube, dcinside, fmkorea, clien)가 코드에 하드코딩되어 있다. 새 소스를 추가하려면 수집기 클래스를 구현하고 `init.ts`/`worker-config.ts`/`flows.ts`/`trigger-form-data.ts`를 모두 수정한 뒤 재배포해야 한다.

목표: 관리자가 `/admin/sources`에서 URL을 입력하면 새 데이터 소스가 DB에 등록되고, 이후 `/dashboard`의 분석 트리거 폼에 사용자 정의 소스 체크박스로 자동 노출된다. v1은 RSS/Atom 피드와 HTML 크롤링(CSS 셀렉터 입력) 두 가지 어댑터만 지원한다. 기존 5개 하드코딩 소스는 건드리지 않고 DB 동적 소스와 **나란히** 공존시킨다 — 이것이 리스크를 최소화하는 핵심 결정이다.

YouTube 채널 URL과 기존 커뮤니티의 추가 갤러리/게시판 재사용은 같은 `data_sources` 스키마와 factory 패턴 위에서 v2로 점진 확장할 수 있도록 설계만 열어둔다.

## 핵심 설계 결정

**1. 하드코딩 소스는 그대로 두고 동적 소스를 나란히 추가한다.** 기존 5개를 DB로 마이그레이션하면 `pipeline-worker.ts`의 `normalize-naver` / `normalize-youtube`(2차 댓글 수집 포함) / `normalize-community-*` 분기 로직과 `persist`의 source 키 기반 처리가 전부 연쇄 수정 대상이 된다. 대신 동적 소스는 새 adapter type(`rss`/`html`)과 새 normalize 분기(`normalize-feed`) 하나로 격리한다.

**2. `articles`에 `dataSourceId uuid` FK 컬럼을 추가한다.** 기존 행은 null. 새 RSS/HTML 행은 `source = 'rss' | 'html'`, `dataSourceId = <uuid>`, `sourceId = sha1(url)`. 기존 `(source, sourceId)` unique index는 그대로 유지되므로 중복 제거가 계속 동작한다.

**3. 동적 소스는 전체 피드 수집. 키워드 필터는 분석 단계에 위임한다.** `RssCollector`/`HtmlCollector`는 `CollectionOptions.keyword`를 무시하고 소스의 최근 N개 항목을 yield한다. 하위 분석 모듈은 이미 `articles.content`의 텍스트 유사도/키워드 매칭을 수행하므로 추가 변경 불필요.

**4. DB 조회를 워커가 아닌 `flows.ts`에서 한다.** Flow 생성 시점에 `data_sources` 행을 읽어 **직렬화 가능한 스냅샷**(id/adapterType/name/config)을 각 collector job의 `data`에 심는다. 워커는 DB에 재질의하지 않고 factory에 스냅샷을 넘겨 Collector 인스턴스를 만든다 — BullMQ 재실행 시 일관성 유지 + 워커의 DB 의존성 최소화.

## 흐름도

```
┌─────────────┐   /admin/sources    ┌──────────────┐
│  Admin UI   │────────create──────▶│ tRPC         │──── INSERT ──▶  data_sources
│ SourceForm  │                     │ sources.*    │
└─────────────┘                     └──────────────┘
                                          │
                                          │ (list enabled)
                                          ▼
┌─────────────┐                     ┌──────────────┐
│ Dashboard   │────── trigger ─────▶│ analysis.    │
│TriggerForm  │  sources+customIds  │   trigger    │
└─────────────┘                     └──────┬───────┘
                                           │ SELECT data_sources WHERE id IN (customIds)
                                           ▼
                                   ┌───────────────┐
                                   │ flows.ts      │
                                   │ triggerColl() │
                                   └──────┬────────┘
                                          │
      ┌───────────────────────────────────┼──────────────────────────┐
      ▼                                   ▼                          ▼
┌──────────────┐              ┌──────────────────┐        ┌──────────────────┐
│ HARDCODED    │              │  HARDCODED       │        │  DYNAMIC         │
│ normalize-   │              │  normalize-      │        │  normalize-feed  │
│   naver      │              │   community-*    │        │   (source=rss|   │
│ (+comments)  │              │                  │        │    html, dsId)   │
└──────┬───────┘              └────────┬─────────┘        └────────┬─────────┘
       │                               │                          │
       ▼                               ▼                          ▼
┌──────────────┐              ┌──────────────────┐        ┌──────────────────┐
│ collect-     │              │ collect-         │        │ collect-feed     │
│  naver-news  │              │   dcinside/fm/   │        │  (factory build  │
│              │              │   clien          │        │   RssCollector)  │
└──────┬───────┘              └────────┬─────────┘        └────────┬─────────┘
       └───────────────────────────────┴──────────────────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ persist (기존 +  │
                              │ generic feed     │
                              │ handler 추가)    │
                              └──────────┬───────┘
                                         │
                                         ▼
                                     articles (+ dataSourceId)
```

## 변경 사항

### 1. DB 스키마 — `data_sources` 테이블 + `articles.dataSourceId` 컬럼

**신규**: `packages/core/src/db/schema/sources.ts`

```ts
export const dataSources = pgTable('data_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(), // 표시명 ("한겨레 RSS")
  adapterType: text('adapter_type', { enum: ['rss', 'html'] }).notNull(), // v2: + 'youtube-channel', 'community'
  url: text('url').notNull(),
  config: jsonb('config').$type<Record>(), // HTML: { selectors }, RSS: {}
  enabled: boolean('enabled').notNull().default(true),
  defaultLimit: integer('default_limit').notNull().default(50),
  lastCollectedAt: timestamp('last_collected_at'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**수정**: `packages/core/src/db/schema/collections.ts`

- `articles`, `videos`, `comments` 세 테이블에 `dataSourceId: uuid('data_source_id').references(() => dataSources.id, { onDelete: 'set null' })` 추가. 모두 nullable, 기존 행에 영향 없음.
- `articles_source_id_idx` unique index는 유지. 새 RSS/HTML 행은 `source='rss'|'html'`, `sourceId=sha1(url)`로 고유성 보장.

**수정**: `packages/core/src/db/schema/index.ts` — `export * from './sources';` 추가.

마이그레이션은 `pnpm db:push`로 진행. 운영 DB(192.168.0.5:5438)는 공유 리소스이므로 반영 전 스냅샷 확인 필요.

### 2. 신규 수집기

**`packages/collectors/src/adapters/rss.ts`** (신규)

- 의존성: `rss-parser` (ESM 호환, Node 표준) — `packages/collectors/package.json`에 추가
- 시그니처: `new RssCollector({ feedUrl: string, maxItems?: number })`
- `Collector` 인터페이스 구현. `source = 'rss'`, `collect()`는 `keyword` 무시하고 feed parse 결과를 `NaverArticle` 형태(`sourceId`, `url`, `title`, `content`, `author`, `publisher`, `publishedAt`, `rawData`)로 **한 번에 yield**.
- `sourceId` = `sha1(item.link)`.

**`packages/collectors/src/adapters/html.ts`** (신규)

- 의존성: 기존 `cheerio` 재사용 (BrowserCollector는 쓰지 않음 — 정적 페이지 전제로 v1은 `fetch` + cheerio)
- 시그니처: `new HtmlCollector({ pageUrl: string, selectors: { item: string, title: string, link: string, body?: string, date?: string }, maxItems?: number })`
- `source = 'html'`. `fetch(pageUrl)` → cheerio로 `selectors.item` 순회 → 각 항목을 article shape로 yield.
- SSRF 방어: `pageUrl`/추출된 링크의 host를 `isPrivateIp()` 체크(사설 대역 차단). 유틸은 `packages/collectors/src/utils/url-guard.ts` (신규)에 배치.
- JS 렌더가 필요한 페이지는 item 0개 반환 → 관리자 UI에서 "항목이 없습니다" 표시. Playwright fallback은 v2.

**`packages/collectors/src/adapters/factory.ts`** (신규)

```ts
export interface DataSourceSnapshot {
  id: string;
  name: string;
  adapterType: 'rss' | 'html';
  url: string;
  config: Record | null;
  defaultLimit: number;
}
export function buildDynamicCollector(src: DataSourceSnapshot): Collector {
  switch (src.adapterType) {
    case 'rss':
      return new RssCollector({ feedUrl: src.url, maxItems: src.defaultLimit });
    case 'html':
      return new HtmlCollector({
        pageUrl: src.url,
        selectors: src.config?.selectors,
        maxItems: src.defaultLimit,
      });
  }
}
```

- `packages/collectors/src/adapters/index.ts`에 `RssCollector`, `HtmlCollector`, `buildDynamicCollector`, `DataSourceSnapshot` export 추가.
- `packages/collectors/src/init.ts`는 **수정 없음** — dynamic 수집기는 registry에 등록하지 않고 factory로만 생성.

### 3. `CollectionTrigger` 확장

**수정**: `packages/core/src/types/index.ts`

```ts
export const CollectionTriggerSchema = z.object({
  keyword: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  sources: z.array(z.enum(['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'])).optional(),
  customSourceIds: z.array(z.string().uuid()).optional(), // 신규 — data_sources.id
  limits: z.object({ ... }).optional(),
});
```

### 4. `flows.ts` — 동적 children 추가

**수정**: `packages/core/src/queue/flows.ts` (L17-158)

- 기존 하드코딩 `if (enabledSources.includes(...))` 블록 5개는 **그대로 유지**.
- 맨 아래 `const flow = await getFlowProducer().add(...)` 직전에 추가:

```ts
if (params.customSourceIds && params.customSourceIds.length > 0) {
  const { db, dataSources } = await import('../db');
  const rows = await db.query.dataSources.findMany({
    where: and(inArray(dataSources.id, params.customSourceIds), eq(dataSources.enabled, true)),
  });
  for (const row of rows) {
    const snapshot: DataSourceSnapshot = {
      id: row.id,
      name: row.name,
      adapterType: row.adapterType,
      url: row.url,
      config: row.config,
      defaultLimit: row.defaultLimit,
    };
    children.push({
      name: `normalize-feed-${row.id}`,
      queueName: 'pipeline',
      data: { source: row.adapterType, dataSourceSnapshot: snapshot, flowId, dbJobId },
      children: [
        {
          name: `collect-feed-${row.id}`,
          queueName: 'collectors',
          data: {
            ...params,
            source: row.adapterType,
            dataSourceSnapshot: snapshot,
            maxItems: row.defaultLimit,
            flowId,
            dbJobId,
          },
        },
      ],
    });
  }
}
```

- DB에서 `lastCollectedAt`은 persist 단계에서 갱신(후술).

### 5. `collector-worker.ts` — factory 분기 추가

**수정**: `packages/core/src/queue/collector-worker.ts` (L18-22)

- `job.data.dataSourceSnapshot`이 있으면 `buildDynamicCollector(snapshot)` 호출, 없으면 기존 `getCollector(source)` 경로 유지.
- `pKey = progressKey(source, job.data.dataSourceSnapshot?.id)` — 동적 소스는 progress 키를 `ds_${id.slice(0,8)}`로 생성.
- `countBySourceType('rss' | 'html', items)`는 기본 경로로 흘러 `{posts, comments:0}` 반환. 대신 `{articles: count, comments: 0}`를 반환하도록 `countBySourceType`에 `if (source === 'rss' || source === 'html') return { articles: count, comments: 0 }` 분기 추가.

**수정**: `packages/core/src/queue/worker-config.ts`

- `progressKey(source: string, dataSourceId?: string)` 시그니처 확장. dataSourceId가 있으면 `ds_${dataSourceId.slice(0, 8)}` 반환.
- `countBySourceType`에 rss/html 분기 추가 (위).

### 6. `pipeline-worker.ts` — `normalize-feed-*` + `persist` 확장

**수정**: `packages/core/src/queue/pipeline-worker.ts`

- L32 `if (job.name.startsWith('normalize-'))` 블록 안에 신규 케이스 추가:

```ts
if (job.name.startsWith('normalize-feed-')) {
  // 동적 소스: 2차 댓글 수집 없음 — 자식 collector 결과를 results에 그대로 담아 전달
  const childValues = await job.getChildrenValues();
  for (const value of Object.values(childValues)) {
    const r = value as { source: string; items: unknown[]; count: number };
    const key = `feed_${job.data.dataSourceSnapshot.id}`;
    results[key] = { ...r, dataSourceSnapshot: job.data.dataSourceSnapshot };
  }
}
```

- `persist` 블록(L276-)에 기존 하드코딩 처리 후, `Object.entries(results)` 중 `feed_`로 시작하는 키를 처리하는 Step 6 추가:

```ts
for (const [key, value] of Object.entries(results)) {
  if (!key.startsWith('feed_')) continue;
  const { items, dataSourceSnapshot } = value as any;
  const normalized = items.map((it: any) => normalizeFeedArticle(it, dataSourceSnapshot));
  await persistArticles(jobIdForDb, normalized);
}
await db
  .update(dataSources)
  .set({ lastCollectedAt: new Date() })
  .where(eq(dataSources.id, snapshot.id));
```

**수정**: `packages/core/src/pipeline/normalize.ts`

- 신규 함수 `normalizeFeedArticle(item, snapshot)`:

```ts
export function normalizeFeedArticle(
  item: any,
  snapshot: DataSourceSnapshot,
): typeof articles.$inferInsert {
  return {
    source: snapshot.adapterType, // 'rss' | 'html'
    sourceId: item.sourceId, // sha1(url) — collector가 이미 생성
    dataSourceId: snapshot.id,
    url: item.url,
    title: item.title,
    content: item.content,
    author: item.author,
    publisher: snapshot.name,
    publishedAt: toDate(item.publishedAt),
    rawData: item.rawData,
  };
}
```

### 7. tRPC — `sources` 라우터

**신규**: `apps/web/src/server/trpc/routers/admin/sources.ts`

|
Procedure
|
Auth
|
입력
|
동작
|
|

---

## |

## |

## |

|
|
`list`
|
`systemAdminProcedure`
|

- |
  전체(enabled/disabled) 반환, 관리 UI용
  |
  |
  `listEnabled`
  |
  `protectedProcedure`
  |
- |
  enabled만 반환, 트리거 폼용
  |
  |
  `create`
  |
  `systemAdminProcedure`
  |
  `{name, adapterType, url, config?, defaultLimit?}`
  |
  URL validate(
  `new URL()`

* http/https whitelist) → insert
  |
  |
  `update`
  |
  `systemAdminProcedure`
  |
  `{id, ...patch}`
  |
  |
  |
  `delete`
  |
  `systemAdminProcedure`
  |
  `{id}`
  |
  soft delete (
  `enabled=false`
  ). 기존
  `articles.dataSourceId`
  보존
  |
  |
  `test`
  |
  `systemAdminProcedure`
  |
  `{adapterType, url, config?}`
  |
  DB 저장 없이
  `buildDynamicCollector({..., defaultLimit: 5})`
  → 첫 yield 5건 반환
  |
  |
  `detectType`
  |
  `systemAdminProcedure`
  |
  `{url}`
  |
  간단 휴리스틱:
  `.rss`
  /
  `.xml`
  /
  `/feed`
  /
  `/rss`
  →
  `rss`
  , 그 외 →
  `html`
  |

`listEnabled`는 반드시 `protectedProcedure`여야 일반 사용자의 트리거 폼이 읽을 수 있다.

**수정**: `apps/web/src/server/trpc/routers/admin/index.ts` — `sources: sourcesRouter` 등록.

**수정**: 최상위 router (`apps/web/src/server/trpc/root.ts` 혹은 `routers/index.ts`, 실제 위치 확인 필요) — `listEnabled`는 공용이므로 `sources` 네임스페이스를 admin 바깥에도 노출하거나, admin 라우터에 두고 public procedure로 만든다. 후자가 더 간단 — `admin.sources.listEnabled`를 `protectedProcedure`로 선언하면 admin 경로 안이지만 누구나 호출 가능.

### 8. 관리자 UI

**신규**: `apps/web/src/app/admin/sources/page.tsx`

- `trpc.admin.sources.list` 호출 → 테이블 렌더: 이름 / 타입 / URL / 활성 / lastCollectedAt / 액션.
- "소스 추가" 버튼 → `<SourceFormDialog>` 열림.

**신규**: `apps/web/src/components/admin/source-form-dialog.tsx`

- 단계: ① URL 입력 → `detectType.useMutation()` → adapterType 자동 선택 → ② HTML인 경우 `selectors` 필드 폼 표시 → ③ "테스트" 버튼 → `test.useMutation()` → 샘플 5건 미리보기 → ④ "저장" → `create.useMutation()` → dialog 닫기 + list 갱신.

**수정**: `apps/web/src/app/admin/layout.tsx` (L18) — `NAV_ITEMS`에 `{ href: '/admin/sources', label: '데이터 소스', icon: Rss }` 추가 (`lucide-react`의 `Rss` 아이콘).

### 9. 트리거 폼 통합

**수정**: `apps/web/src/components/analysis/trigger-form.tsx` (L46-L244)

- `const { data: customSources } = useQuery({ queryKey: ['sources', 'enabled'], queryFn: () => trpcClient.admin.sources.listEnabled.query() })` 추가.
- `customSourceIds` 상태 추가: `const [customSourceIds, setCustomSourceIds] = useState<string[]>([])`.
- `SOURCE_OPTIONS` 렌더 블록 아래에 "사용자 정의 소스" 그룹을 추가: `customSources`가 있으면 그룹 헤더와 체크박스 리스트 렌더.
- `handleSubmit`의 `triggerMutation.mutate(...)`에 `customSourceIds` 필드 추가.
- `disabled={... || (sources.length === 0 && customSourceIds.length === 0)}`로 버튼 제약 완화.
- **`trigger-form-data.ts`와 `ALL_SOURCES`/`SOURCE_OPTIONS`/`SourceId` 타입은 건드리지 않는다** — 하드코딩 5개 그룹을 그대로 유지.

**수정**: `apps/web/src/server/trpc/routers/analysis.ts` (L18-L40) — `trigger` input에 `customSourceIds: z.array(z.string().uuid()).optional()` 추가, `triggerCollection(...)` 호출에 전달.

**수정**: `apps/web/src/components/dashboard/collected-data-shared.tsx` (L51-57) — `SOURCE_LABELS`에 `rss: 'RSS'`, `html: '웹'` 추가. 특정 소스명은 `articles.dataSourceId` JOIN으로 조회해야 정확하지만, v1에선 타입 라벨만 표시.

### 10. 의존성

**수정**: `packages/collectors/package.json` — `"rss-parser": "^3.13.0"` 추가.

## 구현 순서

의존 순서대로. 각 단계가 이전 단계 위에서 로컬 확인 가능하도록 구성.

1. **스키마**: `sources.ts` 신규 + `collections.ts`에 `dataSourceId` 추가 + `index.ts` export → `pnpm db:push` 로컬 검증.
2. **Collector 계층**: `rss-parser` 설치 → `utils/url-guard.ts` → `rss.ts` → `html.ts` → `factory.ts` → `adapters/index.ts` export → unit test 3개 (rss fixture, html fixture, factory 분기).
3.

아래는 플랜 파일의 전체 내용입니다. 로컬에서 /root/.claude/plans/inherited-noodling-moore.md 또는 원하는 경로에 저장해 사용하세요.

# 관리자 URL 입력 → 데이터 소스 자동 추가

## Context

ai-signalcraft는 현재 5개 데이터 소스(naver-news, youtube, dcinside, fmkorea, clien)가 코드에 하드코딩되어 있다. 새 소스를 추가하려면 수집기 클래스를 구현하고 `init.ts`/`worker-config.ts`/`flows.ts`/`trigger-form-data.ts`를 모두 수정한 뒤 재배포해야 한다.

목표: 관리자가 `/admin/sources`에서 URL을 입력하면 새 데이터 소스가 DB에 등록되고, 이후 `/dashboard`의 분석 트리거 폼에 사용자 정의 소스 체크박스로 자동 노출된다. v1은 RSS/Atom 피드와 HTML 크롤링(CSS 셀렉터 입력) 두 가지 어댑터만 지원한다. 기존 5개 하드코딩 소스는 건드리지 않고 DB 동적 소스와 **나란히** 공존시킨다 — 이것이 리스크를 최소화하는 핵심 결정이다.

YouTube 채널 URL과 기존 커뮤니티의 추가 갤러리/게시판 재사용은 같은 `data_sources` 스키마와 factory 패턴 위에서 v2로 점진 확장할 수 있도록 설계만 열어둔다.

## 핵심 설계 결정

**1. 하드코딩 소스는 그대로 두고 동적 소스를 나란히 추가한다.** 기존 5개를 DB로 마이그레이션하면 `pipeline-worker.ts`의 `normalize-naver` / `normalize-youtube`(2차 댓글 수집 포함) / `normalize-community-*` 분기 로직과 `persist`의 source 키 기반 처리가 전부 연쇄 수정 대상이 된다. 대신 동적 소스는 새 adapter type(`rss`/`html`)과 새 normalize 분기(`normalize-feed`) 하나로 격리한다.

**2. `articles`에 `dataSourceId uuid` FK 컬럼을 추가한다.** 기존 행은 null. 새 RSS/HTML 행은 `source = 'rss' | 'html'`, `dataSourceId = <uuid>`, `sourceId = sha1(url)`. 기존 `(source, sourceId)` unique index는 그대로 유지되므로 중복 제거가 계속 동작한다.

**3. 동적 소스는 전체 피드 수집. 키워드 필터는 분석 단계에 위임한다.** `RssCollector`/`HtmlCollector`는 `CollectionOptions.keyword`를 무시하고 소스의 최근 N개 항목을 yield한다. 하위 분석 모듈은 이미 `articles.content`의 텍스트 유사도/키워드 매칭을 수행하므로 추가 변경 불필요.

**4. DB 조회를 워커가 아닌 `flows.ts`에서 한다.** Flow 생성 시점에 `data_sources` 행을 읽어 **직렬화 가능한 스냅샷**(id/adapterType/name/config)을 각 collector job의 `data`에 심는다. 워커는 DB에 재질의하지 않고 factory에 스냅샷을 넘겨 Collector 인스턴스를 만든다 — BullMQ 재실행 시 일관성 유지 + 워커의 DB 의존성 최소화.

## 흐름도

```
┌─────────────┐   /admin/sources    ┌──────────────┐
│  Admin UI   │────────create──────▶│ tRPC         │──── INSERT ──▶  data_sources
│ SourceForm  │                     │ sources.*    │
└─────────────┘                     └──────────────┘
                                          │
                                          │ (list enabled)
                                          ▼
┌─────────────┐                     ┌──────────────┐
│ Dashboard   │────── trigger ─────▶│ analysis.    │
│TriggerForm  │  sources+customIds  │   trigger    │
└─────────────┘                     └──────┬───────┘
                                           │ SELECT data_sources WHERE id IN (customIds)
                                           ▼
                                   ┌───────────────┐
                                   │ flows.ts      │
                                   │ triggerColl() │
                                   └──────┬────────┘
                                          │
      ┌───────────────────────────────────┼──────────────────────────┐
      ▼                                   ▼                          ▼
┌──────────────┐              ┌──────────────────┐        ┌──────────────────┐
│ HARDCODED    │              │  HARDCODED       │        │  DYNAMIC         │
│ normalize-   │              │  normalize-      │        │  normalize-feed  │
│   naver      │              │   community-*    │        │   (source=rss|   │
│ (+comments)  │              │                  │        │    html, dsId)   │
└──────┬───────┘              └────────┬─────────┘        └────────┬─────────┘
       │                               │                          │
       ▼                               ▼                          ▼
┌──────────────┐              ┌──────────────────┐        ┌──────────────────┐
│ collect-     │              │ collect-         │        │ collect-feed     │
│  naver-news  │              │   dcinside/fm/   │        │  (factory build  │
│              │              │   clien          │        │   RssCollector)  │
└──────┬───────┘              └────────┬─────────┘        └────────┬─────────┘
       └───────────────────────────────┴──────────────────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ persist (기존 +  │
                              │ generic feed     │
                              │ handler 추가)    │
                              └──────────┬───────┘
                                         │
                                         ▼
                                     articles (+ dataSourceId)
```

## 변경 사항

### 1. DB 스키마 — `data_sources` 테이블 + `articles.dataSourceId` 컬럼

**신규**: `packages/core/src/db/schema/sources.ts`

```ts
export const dataSources = pgTable('data_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(), // 표시명 ("한겨레 RSS")
  adapterType: text('adapter_type', { enum: ['rss', 'html'] }).notNull(), // v2: + 'youtube-channel', 'community'
  url: text('url').notNull(),
  config: jsonb('config').$type<Record>(), // HTML: { selectors }, RSS: {}
  enabled: boolean('enabled').notNull().default(true),
  defaultLimit: integer('default_limit').notNull().default(50),
  lastCollectedAt: timestamp('last_collected_at'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**수정**: `packages/core/src/db/schema/collections.ts`

- `articles`, `videos`, `comments` 세 테이블에 `dataSourceId: uuid('data_source_id').references(() => dataSources.id, { onDelete: 'set null' })` 추가. 모두 nullable, 기존 행에 영향 없음.
- `articles_source_id_idx` unique index는 유지. 새 RSS/HTML 행은 `source='rss'|'html'`, `sourceId=sha1(url)`로 고유성 보장.

**수정**: `packages/core/src/db/schema/index.ts` — `export * from './sources';` 추가.

마이그레이션은 `pnpm db:push`로 진행. 운영 DB(192.168.0.5:5438)는 공유 리소스이므로 반영 전 스냅샷 확인 필요.

### 2. 신규 수집기

**`packages/collectors/src/adapters/rss.ts`** (신규)

- 의존성: `rss-parser` (ESM 호환, Node 표준) — `packages/collectors/package.json`에 추가
- 시그니처: `new RssCollector({ feedUrl: string, maxItems?: number })`
- `Collector` 인터페이스 구현. `source = 'rss'`, `collect()`는 `keyword` 무시하고 feed parse 결과를 `NaverArticle` 형태(`sourceId`, `url`, `title`, `content`, `author`, `publisher`, `publishedAt`, `rawData`)로 **한 번에 yield**.
- `sourceId` = `sha1(item.link)`.

**`packages/collectors/src/adapters/html.ts`** (신규)

- 의존성: 기존 `cheerio` 재사용 (BrowserCollector는 쓰지 않음 — 정적 페이지 전제로 v1은 `fetch` + cheerio)
- 시그니처: `new HtmlCollector({ pageUrl: string, selectors: { item: string, title: string, link: string, body?: string, date?: string }, maxItems?: number })`
- `source = 'html'`. `fetch(pageUrl)` → cheerio로 `selectors.item` 순회 → 각 항목을 article shape로 yield.
- SSRF 방어: `pageUrl`/추출된 링크의 host를 `isPrivateIp()` 체크(사설 대역 차단). 유틸은 `packages/collectors/src/utils/url-guard.ts` (신규)에 배치.
- JS 렌더가 필요한 페이지는 item 0개 반환 → 관리자 UI에서 "항목이 없습니다" 표시. Playwright fallback은 v2.

**`packages/collectors/src/adapters/factory.ts`** (신규)

```ts
export interface DataSourceSnapshot {
  id: string;
  name: string;
  adapterType: 'rss' | 'html';
  url: string;
  config: Record | null;
  defaultLimit: number;
}
export function buildDynamicCollector(src: DataSourceSnapshot): Collector {
  switch (src.adapterType) {
    case 'rss':
      return new RssCollector({ feedUrl: src.url, maxItems: src.defaultLimit });
    case 'html':
      return new HtmlCollector({
        pageUrl: src.url,
        selectors: src.config?.selectors,
        maxItems: src.defaultLimit,
      });
  }
}
```

- `packages/collectors/src/adapters/index.ts`에 `RssCollector`, `HtmlCollector`, `buildDynamicCollector`, `DataSourceSnapshot` export 추가.
- `packages/collectors/src/init.ts`는 **수정 없음** — dynamic 수집기는 registry에 등록하지 않고 factory로만 생성.

### 3. `CollectionTrigger` 확장

**수정**: `packages/core/src/types/index.ts`

```ts
export const CollectionTriggerSchema = z.object({
  keyword: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  sources: z.array(z.enum(['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'])).optional(),
  customSourceIds: z.array(z.string().uuid()).optional(), // 신규 — data_sources.id
  limits: z.object({ ... }).optional(),
});
```

### 4. `flows.ts` — 동적 children 추가

**수정**: `packages/core/src/queue/flows.ts` (L17-158)

- 기존 하드코딩 `if (enabledSources.includes(...))` 블록 5개는 **그대로 유지**.
- 맨 아래 `const flow = await getFlowProducer().add(...)` 직전에 추가:

```ts
if (params.customSourceIds && params.customSourceIds.length > 0) {
  const { db, dataSources } = await import('../db');
  const rows = await db.query.dataSources.findMany({
    where: and(inArray(dataSources.id, params.customSourceIds), eq(dataSources.enabled, true)),
  });
  for (const row of rows) {
    const snapshot: DataSourceSnapshot = {
      id: row.id,
      name: row.name,
      adapterType: row.adapterType,
      url: row.url,
      config: row.config,
      defaultLimit: row.defaultLimit,
    };
    children.push({
      name: `normalize-feed-${row.id}`,
      queueName: 'pipeline',
      data: { source: row.adapterType, dataSourceSnapshot: snapshot, flowId, dbJobId },
      children: [
        {
          name: `collect-feed-${row.id}`,
          queueName: 'collectors',
          data: {
            ...params,
            source: row.adapterType,
            dataSourceSnapshot: snapshot,
            maxItems: row.defaultLimit,
            flowId,
            dbJobId,
          },
        },
      ],
    });
  }
}
```

- DB에서 `lastCollectedAt`은 persist 단계에서 갱신(후술).

### 5. `collector-worker.ts` — factory 분기 추가

**수정**: `packages/core/src/queue/collector-worker.ts` (L18-22)

- `job.data.dataSourceSnapshot`이 있으면 `buildDynamicCollector(snapshot)` 호출, 없으면 기존 `getCollector(source)` 경로 유지.
- `pKey = progressKey(source, job.data.dataSourceSnapshot?.id)` — 동적 소스는 progress 키를 `ds_${id.slice(0,8)}`로 생성.
- `countBySourceType('rss' | 'html', items)`는 기본 경로로 흘러 `{posts, comments:0}` 반환. 대신 `{articles: count, comments: 0}`를 반환하도록 `countBySourceType`에 `if (source === 'rss' || source === 'html') return { articles: count, comments: 0 }` 분기 추가.

**수정**: `packages/core/src/queue/worker-config.ts`

- `progressKey(source: string, dataSourceId?: string)` 시그니처 확장. dataSourceId가 있으면 `ds_${dataSourceId.slice(0, 8)}` 반환.
- `countBySourceType`에 rss/html 분기 추가 (위).

### 6. `pipeline-worker.ts` — `normalize-feed-*` + `persist` 확장

**수정**: `packages/core/src/queue/pipeline-worker.ts`

- L32 `if (job.name.startsWith('normalize-'))` 블록 안에 신규 케이스 추가:

```ts
if (job.name.startsWith('normalize-feed-')) {
  // 동적 소스: 2차 댓글 수집 없음 — 자식 collector 결과를 results에 그대로 담아 전달
  const childValues = await job.getChildrenValues();
  for (const value of Object.values(childValues)) {
    const r = value as { source: string; items: unknown[]; count: number };
    const key = `feed_${job.data.dataSourceSnapshot.id}`;
    results[key] = { ...r, dataSourceSnapshot: job.data.dataSourceSnapshot };
  }
}
```

- `persist` 블록(L276-)에 기존 하드코딩 처리 후, `Object.entries(results)` 중 `feed_`로 시작하는 키를 처리하는 Step 6 추가:

```ts
for (const [key, value] of Object.entries(results)) {
  if (!key.startsWith('feed_')) continue;
  const { items, dataSourceSnapshot } = value as any;
  const normalized = items.map((it: any) => normalizeFeedArticle(it, dataSourceSnapshot));
  await persistArticles(jobIdForDb, normalized);
}
await db
  .update(dataSources)
  .set({ lastCollectedAt: new Date() })
  .where(eq(dataSources.id, snapshot.id));
```

**수정**: `packages/core/src/pipeline/normalize.ts`

- 신규 함수 `normalizeFeedArticle(item, snapshot)`:

```ts
export function normalizeFeedArticle(
  item: any,
  snapshot: DataSourceSnapshot,
): typeof articles.$inferInsert {
  return {
    source: snapshot.adapterType, // 'rss' | 'html'
    sourceId: item.sourceId, // sha1(url) — collector가 이미 생성
    dataSourceId: snapshot.id,
    url: item.url,
    title: item.title,
    content: item.content,
    author: item.author,
    publisher: snapshot.name,
    publishedAt: toDate(item.publishedAt),
    rawData: item.rawData,
  };
}
```

### 7. tRPC — `sources` 라우터

**신규**: `apps/web/src/server/trpc/routers/admin/sources.ts`

|
Procedure
|
Auth
|
입력
|
동작
|
|

---

## |

## |

## |

|
|
`list`
|
`systemAdminProcedure`
|

- |
  전체(enabled/disabled) 반환, 관리 UI용
  |
  |
  `listEnabled`
  |
  `protectedProcedure`
  |
- |
  enabled만 반환, 트리거 폼용
  |
  |
  `create`
  |
  `systemAdminProcedure`
  |
  `{name, adapterType, url, config?, defaultLimit?}`
  |
  URL validate(
  `new URL()`

* http/https whitelist) → insert
  |
  |
  `update`
  |
  `systemAdminProcedure`
  |
  `{id, ...patch}`
  |
  |
  |
  `delete`
  |
  `systemAdminProcedure`
  |
  `{id}`
  |
  soft delete (
  `enabled=false`
  ). 기존
  `articles.dataSourceId`
  보존
  |
  |
  `test`
  |
  `systemAdminProcedure`
  |
  `{adapterType, url, config?}`
  |
  DB 저장 없이
  `buildDynamicCollector({..., defaultLimit: 5})`
  → 첫 yield 5건 반환
  |
  |
  `detectType`
  |
  `systemAdminProcedure`
  |
  `{url}`
  |
  간단 휴리스틱:
  `.rss`
  /
  `.xml`
  /
  `/feed`
  /
  `/rss`
  →
  `rss`
  , 그 외 →
  `html`
  |

`listEnabled`는 반드시 `protectedProcedure`여야 일반 사용자의 트리거 폼이 읽을 수 있다.

**수정**: `apps/web/src/server/trpc/routers/admin/index.ts` — `sources: sourcesRouter` 등록.

**수정**: 최상위 router (`apps/web/src/server/trpc/root.ts` 혹은 `routers/index.ts`, 실제 위치 확인 필요) — `listEnabled`는 공용이므로 `sources` 네임스페이스를 admin 바깥에도 노출하거나, admin 라우터에 두고 public procedure로 만든다. 후자가 더 간단 — `admin.sources.listEnabled`를 `protectedProcedure`로 선언하면 admin 경로 안이지만 누구나 호출 가능.

### 8. 관리자 UI

**신규**: `apps/web/src/app/admin/sources/page.tsx`

- `trpc.admin.sources.list` 호출 → 테이블 렌더: 이름 / 타입 / URL / 활성 / lastCollectedAt / 액션.
- "소스 추가" 버튼 → `<SourceFormDialog>` 열림.

**신규**: `apps/web/src/components/admin/source-form-dialog.tsx`

- 단계: ① URL 입력 → `detectType.useMutation()` → adapterType 자동 선택 → ② HTML인 경우 `selectors` 필드 폼 표시 → ③ "테스트" 버튼 → `test.useMutation()` → 샘플 5건 미리보기 → ④ "저장" → `create.useMutation()` → dialog 닫기 + list 갱신.

**수정**: `apps/web/src/app/admin/layout.tsx` (L18) — `NAV_ITEMS`에 `{ href: '/admin/sources', label: '데이터 소스', icon: Rss }` 추가 (`lucide-react`의 `Rss` 아이콘).

### 9. 트리거 폼 통합

**수정**: `apps/web/src/components/analysis/trigger-form.tsx` (L46-L244)

- `const { data: customSources } = useQuery({ queryKey: ['sources', 'enabled'], queryFn: () => trpcClient.admin.sources.listEnabled.query() })` 추가.
- `customSourceIds` 상태 추가: `const [customSourceIds, setCustomSourceIds] = useState<string[]>([])`.
- `SOURCE_OPTIONS` 렌더 블록 아래에 "사용자 정의 소스" 그룹을 추가: `customSources`가 있으면 그룹 헤더와 체크박스 리스트 렌더.
- `handleSubmit`의 `triggerMutation.mutate(...)`에 `customSourceIds` 필드 추가.
- `disabled={... || (sources.length === 0 && customSourceIds.length === 0)}`로 버튼 제약 완화.
- **`trigger-form-data.ts`와 `ALL_SOURCES`/`SOURCE_OPTIONS`/`SourceId` 타입은 건드리지 않는다** — 하드코딩 5개 그룹을 그대로 유지.

**수정**: `apps/web/src/server/trpc/routers/analysis.ts` (L18-L40) — `trigger` input에 `customSourceIds: z.array(z.string().uuid()).optional()` 추가, `triggerCollection(...)` 호출에 전달.

**수정**: `apps/web/src/components/dashboard/collected-data-shared.tsx` (L51-57) — `SOURCE_LABELS`에 `rss: 'RSS'`, `html: '웹'` 추가. 특정 소스명은 `articles.dataSourceId` JOIN으로 조회해야 정확하지만, v1에선 타입 라벨만 표시.

### 10. 의존성

**수정**: `packages/collectors/package.json` — `"rss-parser": "^3.13.0"` 추가.

## 구현 순서

의존 순서대로. 각 단계가 이전 단계 위에서 로컬 확인 가능하도록 구성.

1. **스키마**: `sources.ts` 신규 + `collections.ts`에 `dataSourceId` 추가 + `index.ts` export → `pnpm db:push` 로컬 검증.
2. **Collector 계층**: `rss-parser` 설치 → `utils/url-guard.ts` → `rss.ts` → `html.ts` → `factory.ts` → `adapters/index.ts` export → unit test 3개 (rss fixture, html fixture, factory 분기).
3. **Types + Flows**: `CollectionTriggerSchema`에 `customSourceIds` 추가 → `flows.ts`에 dynamic children 블록 추가.
4. **Worker**: `worker-config.ts`의 `progressKey`/`countBySourceType` 확장 → `collector-worker.ts` factory 분기 → `pipeline-worker.ts` `normalize-feed-*` 케이스 + persist Step 6 → `normalize.ts`에 `normalizeFeedArticle`.
5. **tRPC 라우터**: `admin/sources.ts` 신규 → `admin/index.ts` 등록.
6. **Admin UI**: `/admin/sources/page.tsx` + `source-form-dialog.tsx` → `layout.tsx`에 메뉴 추가.
7. **트리거 폼 통합**: `trigger-form.tsx`에 `listEnabled` 쿼리 + 체크박스 → `analysis.ts` router input 확장 → `SOURCE_LABELS`에 rss/html 추가.

기존 하드코딩 소스는 1-7 전 단계에서 **회귀 없이** 동작해야 한다. 각 단계 후 `pnpm dev:all` 기동해 기존 네이버 트리거가 정상인지 확인.

## 검증

**단위 테스트** (`packages/collectors`):

- `rss.test.ts` — 샘플 RSS/Atom XML fixture 2종 파싱, `sourceId`는 sha1 해시로 일관.
- `html.test.ts` — 고정 HTML fixture에서 셀렉터로 5개 item 추출. SSRF 테스트: `http://192.168.0.5/` 호출 차단 확인.
- `factory.test.ts` — adapterType별 인스턴스 타입 확인.

**통합 테스트** (로컬 `pnpm dev:all` + 실제 Redis/DB):

1. `pnpm db:push` → `data_sources` 테이블 생성, `articles.data_source_id` 컬럼 추가 확인 (`pnpm db:studio`).
2. `/admin/sources` 접속 → 네비 메뉴 확인 → "RSS 추가" → `https://www.hani.co.kr/rss/` 입력 → `detectType` → `rss` 자동 선택 → `test` 버튼 → 5건 미리보기 → 저장.
3. `/dashboard` 접속 → 트리거 폼의 "사용자 정의 소스"에 "한겨레 RSS" 체크박스 노출 확인.
4. 키워드 입력 + 커스텀 소스만 체크 + 하드코딩 소스 해제 → "분석 실행" → BullMQ 대시보드(ais-dev prefix)에서 `collect-feed-<uuid>` → `normalize-feed-<uuid>` → `persist` 순차 실행 확인.
5. `articles` 테이블에 `source='rss'`, `data_source_id=<uuid>`, `publisher='한겨레 RSS'` 행 삽입 확인.
6. 분석 결과 화면에서 해당 기사가 분석 대상에 포함되는지 확인.
7. **회귀**: 동일한 트리거를 네이버 + 유튜브 + 커뮤니티 3종으로만 실행 → 기존 플로우 완전 동일 동작 확인.
8. `/admin/sources`에서 해당 소스 비활성 → 다음 트리거에서 체크박스 미노출 확인.

**보안 체크**:

- `admin.sources.create/update/delete/test/detectType`: 모두 `systemAdminProcedure` (기존 `jobs.ts` 패턴). `listEnabled`만 `protectedProcedure`.
- URL 입력은 `new URL()` 파싱 + 프로토콜 whitelist (`http:`/`https:`). HTML 수집기는 SSRF 가드(사설 IP 차단) 통과.
- `config.selectors`는 자유 문자열 jsonb. XSS 방지를 위해 렌더 시 텍스트로만 출력.

## 주의 사항

- `data_sources.adapterType`은 현재 `['rss', 'html']`로 제한하지만 v2에서 `['youtube-channel', 'community']`를 추가할 수 있도록 enum이 아닌 text 컬럼으로 저장하고 런타임 zod 검증. (Drizzle에선 `text('adapter_type', { enum: [...] })`를 쓰되 마이그레이션에서 enum 확장 필요.)
- `dataSources.config`의 jsonb는 어댑터별 자유 스키마이므로 tRPC 레벨에서 adapterType별 discriminated union으로 검증.
- `pipeline-worker.ts`의 `normalize-*` 블록은 취소(`isPipelineCancelled`) 체크가 공통 패턴이므로 `normalize-feed-*` 분기에도 동일하게 적용.
- 기존 DB의 `articles.dataSourceId`는 null로 남으며, 조회 시 dataSourceId JOIN은 LEFT JOIN이어야 한다.
- RSS parser는 node-fetch 기반이라 timeout과 UA 헤더 명시 필요(`{ headers: { 'User-Agent': 'AI-SignalCraft/1.0' }, timeout: 15000 }`).
- `/admin/sources/page.tsx`는 `layout.tsx`가 `'use client'`이므로 클라이언트 컴포넌트로 작성.
- BullMQ jobName에 uuid 포함 시 길이 제한 없음(~500자). 그대로 사용 가능.

## 범위 외 (v2 후속)

- **YouTube 채널 URL**: 신규 `YoutubeChannelCollector`(`channels.list` + `playlistItems.list`) + adapter type `youtube-channel` + `normalize-feed` 재사용(혹은 video 전용 branch). 현재 `YoutubeVideosCollector`를 수정하지 않고 별도 클래스로 추가.
- **커뮤니티 재인스턴스화**: `CommunityBaseCollector`의 `baseUrl`/`buildSearchUrl`을 생성자 주입형으로 리팩토링 후 adapter type `community-instance` + config `{site, boardId}`로 등록.
- **Playwright HTML fallback**: JS 렌더 페이지 감지 시 자동 전환.
- **특정 소스 필터링 UI**: `SOURCE_LABELS`가 아닌 `dataSourceId` 조인으로 정확한 소스명 표시.
