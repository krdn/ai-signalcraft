# Manipulation Dashboard 설계 (Phase 3)

> **Phase 2.5 후속.** Phase 2 (Stage 5 detection) + Phase 2.5 (구독 토글) 완료. 이 스펙은 `manipulation_runs/_signals/_evidence` 데이터를 웹 대시보드에 노출한다.

**날짜**: 2026-04-28
**관련 커밋**: `957d31f` (baseline fix), `b71cb65` (toggle CRIT-1 fix)
**E2E 검증된 데이터 (Phase 2 dryrun)**: jobId=273, subscriptionId=37, runId=`25bc0a41-c398-4022-93b8-e9790a0914a9`, manipulationScore=57.21, 7 signals, 29 evidence cards

## 목표

저장된 manipulation 결과를 두 진입점에서 보여준다:

1. **`/showcase/[jobId]`** — 5번째 탭 "조작 신호" — 단발 분석의 점수·신호·증거 상세
2. **`/subscriptions/[id]`** — 새 탭 "조작 분석" — 해당 구독의 시계열 추이 + 잡 표

## 비목표 (YAGNI)

- 알림 (Slack/email) — Phase 4
- 필터·검색·익스포트 — Phase 4
- 글로벌 `/manipulation` 대시보드 — Phase 5
- Sankey 다이어그램 (cross-platform-flow는 표로) — Phase 5
- 가상화/페이지네이션 — Phase 4 (60+ 카드 시점)

## 아키텍처

```
[/showcase/[jobId]/page.tsx — 5번째 탭]
  ↓
[components/manipulation/manipulation-view.tsx]
  ├─ <ManipulationHero> (점수 + 신뢰도 + narrative)
  ├─ <SignalGrid> (7신호 × score)
  └─ <EvidenceCard>[] (rank ASC)
        ↓ kind 분기
[components/manipulation/visualizations/]
  ├─ burst-heatmap.tsx
  ├─ similarity-cluster.tsx
  ├─ vote-scatter.tsx
  ├─ media-sync-timeline.tsx
  ├─ trend-line.tsx
  ├─ cross-platform-flow.tsx (표)
  └─ temporal-bars.tsx

[/subscriptions/[id]/page.tsx — 새 탭]
  ↓
[components/manipulation/timeseries-view.tsx]
  ├─ <ScoreLineChart> (Recharts LineChart, 0-100, 임계선 50)
  └─ <RunsTable> (각 row: 시간/점수/신뢰도/[상세 보기 → showcase 링크])

────── 데이터 ──────

[server/trpc/routers/manipulation.ts] (신규)
  - getRunByJobId(jobId)         → run + signals + evidence
  - listRunsBySubscription(subId, limit=30) → run 요약 배열
        ↓
[packages/core/src/db/schema/manipulation.ts]
  manipulation_runs / _signals / _evidence
```

**의존성 방향**: web → core (drizzle 스키마). core 변경 없음.

## 컴포넌트 명세

### `<ManipulationView jobId={N} />`

5번째 탭 컨테이너. 상태 분기:

| `data` 상태 | UI |
|-------------|-----|
| `isLoading` | `<Skeleton />` |
| `error` | `<ErrorAlert />` |
| `null` (run 없음) | `<EmptyState>` "이 분석은 조작 신호 검출을 활성화하지 않았습니다. 구독 설정에서 토글을 켜면 다음 분석부터 표시됩니다." |
| `status='running'` | `<RunningSpinner pollInterval={5000} />` |
| `status='failed'` | `<ErrorAlert message={errorDetails.message} />` |
| `status='completed'` | `<CompletedView data={data} />` |

### `<CompletedView>` 레이아웃

```
┌─ <ManipulationHero> ────────────────────┐
│  ・그라디언트 카드 (severity 색상)      │
│  ・manipulation_score (큰 숫자)         │
│  ・confidence_factor + weights_version  │
│  ・narrative_md (react-markdown 렌더)   │
└─────────────────────────────────────────┘
┌─ <SignalGrid> ──────────────────────────┐
│  ・7신호 × {label, score, severity 색}  │
│  ・grid: md:grid-cols-7, sm:grid-cols-2 │
│  ・각 셀에 score 0-100 + 신호 한글명    │
└─────────────────────────────────────────┘
┌─ Evidence Cards (rank ASC) ─────────────┐
│  ・<EvidenceCard>가 30개 출력            │
│  ・rank ASC = 가장 중요한 증거가 위에    │
└─────────────────────────────────────────┘
```

severity 색상 매핑:
- `low` → green-100/text-green-800
- `medium` → yellow-100/text-yellow-800
- `high` → red-100/text-red-800

### `<EvidenceCard>` 구조

```typescript
type Props = { evidence: ManipulationEvidence };

// 렌더 순서:
// 1. 헤더: severity 뱃지 + signal 라벨 + title (h4)
// 2. summary (p, text-sm)
// 3. visualization 분기 (아래 참조)
// 4. <Collapsible> "원본 보기 (n건)" → rawRefs 리스트 (itemId, source, time, excerpt)
```

`switch (viz.kind)` 분기 + `default:` case는 폴백 메시지.

### 7개 visualization 컴포넌트

| Kind | Recharts 컴포넌트 | Input shape |
|------|---------------------|-----------|
| `burst-heatmap` | `<BarChart>` (zScore 색상 매핑) | `{ buckets: { ts, count, zScore }[] }` |
| `similarity-cluster` | 표/리스트 | `{ representative: string, matches: { author, source, time, text }[] }` |
| `vote-scatter` | `<ScatterChart>` (length × likes, isOutlier 강조) | `{ points: { length, likes, isOutlier }[] }` |
| `media-sync-timeline` | 표 (publisher × time × headline) | `{ cluster: string, items: { publisher, time, headline }[] }` |
| `trend-line` | `<LineChart>` (count 시계열, isChangePoint 마커) | `{ series: { ts, count, isChangePoint }[] }` |
| `cross-platform-flow` | 표 (1차) — Phase 5에 Sankey | `{ hops: { from, to, time, message, count }[] }` |
| `temporal-bars` | `<BarChart>` (current vs baseline) | `{ bars: { hour, current, baseline }[] }` |

각 컴포넌트는 입력 shape 런타임 가드:
```typescript
function BurstHeatmap({ data }: { data: VisualizationSpec }) {
  if (data.kind !== 'burst-heatmap' || !Array.isArray(data.buckets)) {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류</span>;
  }
  // ... 정상 렌더
}
```

### `<TimeseriesView subscriptionId={N} />`

```
┌─ <ScoreLineChart> ──────────────────────┐
│  ・Recharts <LineChart> dataKey=score   │
│  ・Y축 0-100 고정                        │
│  ・임계선 50 (ReferenceLine, dashed)     │
│  ・X축: startedAt (시간 순)              │
└─────────────────────────────────────────┘
┌─ <RunsTable> ───────────────────────────┐
│  시간 │ 점수 │ 신뢰도 │ 상태 │ 상세→     │
│  04/28│ 57.2 │ 0.84   │  ✓   │ /showcase/273 │
│  ...  │ ...  │ ...    │  ...│ ...       │
└─────────────────────────────────────────┘
```

빈 결과: "이 구독의 manipulation 분석 이력이 없습니다."

## tRPC Router

### `apps/web/src/server/trpc/routers/manipulation.ts` (신규)

```typescript
export const manipulationRouter = router({
  getRunByJobId: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      // 1. jobId 소유권 검증
      const [job] = await getDb().select({
        userId: collectionJobs.userId,
        teamId: collectionJobs.teamId,
      }).from(collectionJobs).where(eq(collectionJobs.id, input.jobId)).limit(1);

      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });
      const isOwner = job.userId === ctx.userId;
      const isTeamMember = job.teamId !== null && ctx.teamId === job.teamId;
      if (!isOwner && !isTeamMember) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '해당 분석에 접근할 수 없습니다' });
      }

      // 2. run 조회 (가장 최근 1건; 동일 jobId에 대해 retry로 여러 row 가능)
      const [run] = await getDb().select().from(manipulationRuns)
        .where(eq(manipulationRuns.jobId, input.jobId))
        .orderBy(desc(manipulationRuns.startedAt))
        .limit(1);
      if (!run) return null;

      // 3. signals + evidence
      const signals = await getDb().select().from(manipulationSignals)
        .where(eq(manipulationSignals.runId, run.id));
      const evidence = await getDb().select().from(manipulationEvidence)
        .where(eq(manipulationEvidence.runId, run.id))
        .orderBy(asc(manipulationEvidence.rank));

      return { ...run, signals, evidence };
    }),

  listRunsBySubscription: protectedProcedure
    .input(z.object({
      subscriptionId: z.number().int().positive(),
      limit: z.number().int().min(1).max(100).default(30),
    }))
    .query(async ({ ctx, input }) => {
      // 권한: 기존 헬퍼 재사용
      await verifySubscriptionOwnership(ctx, input.subscriptionId);

      return getDb().select({
        id: manipulationRuns.id,
        jobId: manipulationRuns.jobId,
        manipulationScore: manipulationRuns.manipulationScore,
        confidenceFactor: manipulationRuns.confidenceFactor,
        startedAt: manipulationRuns.startedAt,
        status: manipulationRuns.status,
      }).from(manipulationRuns)
        .where(eq(manipulationRuns.subscriptionId, input.subscriptionId))
        .orderBy(desc(manipulationRuns.startedAt))
        .limit(input.limit);
    }),
});
```

**Router 등록**: `apps/web/src/server/trpc/routers/index.ts` (또는 root router)에 `manipulation: manipulationRouter` 추가.

## 진입점 통합

### `/showcase/[jobId]/page.tsx`

기존 4탭에 5번째 탭 추가:
```typescript
const TABS = [
  { id: 0, label: 'Dashboard', component: <DashboardView ... /> },
  { id: 1, label: 'Report',    component: <ReportView ... /> },
  { id: 2, label: 'Advanced',  component: <AdvancedView ... /> },
  { id: 3, label: 'Explore',   component: <ExploreView ... /> },
  { id: 4, label: '조작 신호', component: <ManipulationView jobId={jobId} /> },  // 신규
];
```

### `/subscriptions/[id]/page.tsx`

기존 탭 구조 따라 신규 탭 "조작 분석" 추가. `<TimeseriesView subscriptionId={id} />` 마운트.

## 에러 처리

신규 코드는 다음 케이스를 처리한다:

| 시나리오 | 처리 |
|----------|------|
| `manipulation_runs` 행 없음 | EmptyState (구독 토글 안내 메시지 포함) |
| `status='running'` | 5초 폴링 + 스피너 |
| `status='failed'` | `errorDetails.message` 노출 |
| `evidence` 0건 (점수만 있음) | Hero + SignalGrid만, "증거 카드 없음" 안내 |
| 권한 거부 (FORBIDDEN) | 페이지 컨테이너에서 ErrorAlert |
| `visualization` schema 어긋난 데이터 | 컴포넌트 런타임 가드 → 폴백 메시지 |
| 시계열 빈 결과 | EmptyState |

## 보안

| 영역 | 검증 |
|------|------|
| `getRunByJobId` 권한 | jobId의 userId/teamId가 ctx.userId/ctx.teamId와 일치 |
| `listRunsBySubscription` 권한 | `verifySubscriptionOwnership` 헬퍼 |
| `narrativeMd` XSS | `react-markdown` 기본 모드 (raw HTML 비활성) |
| `evidence.rawRefs[].excerpt` XSS | React JSX 자동 escape — 별도 sanitize 불필요 |
| viz JSONB 파싱 오류 | 컴포넌트 런타임 가드로 화면 깨짐 방지 |

## 테스트

### tRPC router (`__tests__/manipulation.test.ts`)

```typescript
it('getRunByJobId — 권한 없음 (다른 팀의 jobId)', async () => { ... });
it('getRunByJobId — 본인 잡, run+signals+evidence join 반환', async () => { ... });
it('getRunByJobId — manipulation_runs 행 없으면 null', async () => { ... });
it('listRunsBySubscription — 권한 없음', async () => { ... });
it('listRunsBySubscription — limit 30 적용, startedAt DESC', async () => { ... });
```

`getDb()`/`verifySubscriptionOwnership` 모킹 후 호출.

### 컴포넌트 테스트

- `manipulation-view.test.tsx`: 6가지 상태 분기 (loading, error, null, running, failed, completed) 렌더링
- `evidence-card.test.tsx`: viz.kind 7개 분기 + unknown kind 폴백
- `visualizations/*.test.tsx` (7개): props 정상/잘못된 shape에서 폴백
- `timeseries-view.test.tsx`: 빈 결과 EmptyState, 30개 데이터 LineChart + 표 렌더, 상세 링크 href 검증

### E2E (수동)

1. 토글 ON 구독으로 분석 트리거 → showcase 5번째 탭에 점수+증거 카드 표시
2. 같은 구독 페이지의 새 탭에서 시계열 + 표 표시
3. 표의 "상세 보기" 클릭 → showcase로 점프 OK
4. 토글 OFF 구독의 showcase 5번째 탭 → EmptyState
5. jobId=273 (Phase 2 dryrun으로 만들어진 기존 데이터)으로도 정상 표시되는지 확인

## 파일 영향 요약

| 카테고리 | 파일 수 | 라인 (추정) |
|----------|---------|-------------|
| **신규 router + 테스트** | 2 | ~220 |
| **신규 컨테이너 컴포넌트** | 4 (view, hero, signal-grid, timeseries-view) | ~410 |
| **신규 viz 컴포넌트** | 7 + index | ~460 |
| **신규 evidence-card** | 1 | ~80 |
| **신규 컴포넌트 테스트** | ~5 | ~300 |
| **기존 페이지 수정** (showcase, subscriptions) | 2 | ~20 |
| **router 등록** | 1 | +2 |
| **합계** | ~22 | ~1,490 |

## 위험 요소

| 위험 | 영향 | 완화 |
|------|------|------|
| `visualization` JSONB가 코드와 어긋남 | 중 | 컴포넌트 런타임 가드 + 폴백 메시지 |
| 권한 검증 누락 | 높음 | router 테스트에서 isOwner=false + isTeamMember=false 케이스 명시 |
| 30개 evidence 동시 렌더 성능 | 중 | `React.memo(EvidenceCard)` |
| `narrativeMd` XSS | 낮음 | `react-markdown` 기본 모드 |
| `cross-platform-flow` 표 정보 압축률 | 낮음 | Phase 5 Sankey 업그레이드 예약 |
| Y축 범위 결정 | 낮음 | 0-100 고정, 임계선 50 |
| 같은 jobId에 retry로 여러 manipulation_run row | 낮음 | `ORDER BY started_at DESC LIMIT 1`로 최신 1건만 |

## 마이그레이션

- DB 변경 없음
- 기존 토글 OFF 잡: `manipulation_runs` 행 없음 → EmptyState
- 기존 토글 ON 분석으로 만들어진 jobId=273 → 즉시 새 UI에서 보임

## 향후 확장 (이 스펙 범위 외)

- Phase 4: 알림 (Slack/email), 필터/검색, CSV 익스포트
- Phase 5: 글로벌 `/manipulation` 대시보드, Sankey, react-window 가상화
