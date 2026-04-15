# 공개 대시보드 디자인 스펙

**날짜**: 2026-04-15  
**작성자**: Claude (브레인스토밍 세션)  
**상태**: 승인됨

---

## 개요

로그인 없이 접근 가능한 공개 분석 리포트 대시보드를 `/reports` 경로에 신설한다.  
목적: AI SignalCraft가 생성한 분석 결과물을 매력적으로 전시하는 영업·마케팅용 쇼케이스 페이지.

---

## 범위

- **신설 페이지**: `apps/web/src/app/reports/page.tsx`
- **기존 페이지 유지**: `/showcase/[jobId]` — 상세 페이지 그대로 사용 (카드 클릭 시 이동 대상)
- **기존 랜딩 페이지**: `/` 의 ShowcaseSection은 그대로 유지 (별도 변경 없음)

---

## 레이아웃 구조

```
┌─────────────────────────────────────────────────┐
│  SignalCraft  공개 분석 리포트  [홈] [리포트] [체험] [로그인] │  ← 상단 네비바 (sticky)
├──────────────┬──────────────────────────────────┤
│              │  AI 분석 리포트              [8건] │
│  도메인 필터  │  실제 수행된 여론 분석 결과 공개   │
│              │  ─────────────────────────────── │
│  ● 전체  (8) │  [정치] 부친상 과잉 보도 여론...  →│
│  ○ 정치  (4) │  [정치] 노란봉투법 시행 초기...   →│
│  ○ 경제  (2) │  [사회] JTBC 여조 열세로...      →│
│  ○ 사회  (2) │  [경제] ...                      →│
│              │                                  │
│  ──────────  │                                  │
│  총 수집: 2,560건│                               │
│  AI 모듈: 96개│                                  │
├──────────────┴──────────────────────────────────┤
│  "AI SignalCraft로 직접 분석해 보세요"  [무료 체험] │  ← 하단 CTA바
└─────────────────────────────────────────────────┘
```

---

## 컴포넌트 설계

### 페이지: `apps/web/src/app/reports/page.tsx`

- Server Component (메타데이터 설정 용이)
- `<ReportsDashboard />` 클라이언트 컴포넌트 렌더링

### 클라이언트 컴포넌트: `apps/web/src/components/reports/reports-dashboard.tsx`

```
ReportsDashboard
├── ReportsNav          — 상단 네비바 (홈/리포트/체험/로그인 링크)
├── ReportsSidebar      — 좌측 도메인 필터 + 통계 요약
│   ├── DomainFilterList — 필터 칩 목록 (전체 + 도메인별)
│   └── ReportsSummaryStats — 총 기사 수, 모듈 수
└── ReportsCardList     — 우측 카드 리스트
    └── ReportCard (n개) — 개별 분석 결과 카드
```

---

## 데이터 흐름

### tRPC 엔드포인트

기존 `showcase.list` 프로시저를 그대로 재사용한다.  
단, 도메인 필터를 지원하기 위해 `domain` 필드를 응답에 추가해야 한다.

**현재 `showcase.list` 응답 (추가 필요 필드)**:

```ts
{
  jobId: number;
  keyword: string;
  startDate: string;
  endDate: string;
  oneLiner: string | null;
  reportTitle: string | null;
  totalArticles: number;
  totalComments: number;
  modulesCompleted: number;
  // 추가 필요:
  domain: string; // collectionJobs.domain 컬럼에서 SELECT
}
```

### 클라이언트 필터링

도메인 필터는 **클라이언트 사이드 필터링**으로 처리한다.  
(데이터 건수가 소규모이므로 별도 API 요청 불필요)

```
전체 목록 fetch → useState(selectedDomain) → filter → 렌더링
```

---

## 라우팅 및 인증

### 미들웨어 인증 예외 추가

`apps/web/src/server/auth.config.ts`의 `isPublicPage` 조건에 `/reports` 추가:

```ts
const isPublicPage =
  nextUrl.pathname === '/' ||
  nextUrl.pathname.startsWith('/reports') ||   // ← 추가
  nextUrl.pathname.startsWith('/showcase') ||
  // ... 기존 항목들
```

### 카드 클릭 동작

카드 클릭 → `<Link href={/showcase/${item.jobId}}>` — 기존 상세 페이지 그대로 활용.

---

## UI 상세

### 상단 네비바

| 항목                 | 동작                     |
| -------------------- | ------------------------ |
| SignalCraft (브랜드) | `/` 로 이동              |
| 홈                   | `/` 로 이동              |
| 리포트               | `/reports` — active 상태 |
| 체험하기             | `/demo` 로 이동          |
| 로그인               | `/login` 로 이동         |

### 도메인 필터 칩

- 전체 + DB 실제 domain 값에서 동적 생성 (예: `political` → `정치`, `economic` → `경제`, `social` → `사회`)
- 한국어 레이블 매핑: `{ political: '정치', economic: '경제', social: '사회' }` — 매핑 없는 값은 raw 값 그대로 표시
- 각 칩에 건수 표시 (예: `정치 (4)`)
- 선택된 칩: `bg-primary/10 border-primary text-primary`
- 미선택 칩: `border-border text-muted-foreground`

### 카드

| 요소        | 내용                                             |
| ----------- | ------------------------------------------------ |
| 도메인 뱃지 | 색상 코딩 (정치=red, 경제=green, 사회=indigo 등) |
| 제목        | `item.oneLiner` (없으면 `item.reportTitle`)      |
| 통계        | 기사 수, 댓글 수, 모듈 수, 날짜 범위             |
| 우측        | 날짜 + 화살표 아이콘                             |
| 최신 항목   | `border-primary/30 bg-primary/5` 로 강조         |
| hover       | `border-primary shadow-sm -translate-y-0.5`      |

### 사이드바 하단 요약 통계

- 전체 기사 합산 수 (필터와 무관하게 항상 전체 표시)
- 전체 모듈 완료 수 합산

### 하단 CTA바

```
"AI SignalCraft로 직접 여론을 분석해 보세요"  [무료 체험 시작 →]
```

- 고정(sticky bottom) 아님 — 페이지 최하단 border-top 스타일

---

## 구현 파일 목록

| 파일                                                    | 작업                                 |
| ------------------------------------------------------- | ------------------------------------ |
| `apps/web/src/app/reports/page.tsx`                     | 신규 생성 (Server Component)         |
| `apps/web/src/components/reports/reports-dashboard.tsx` | 신규 생성 (클라이언트 메인)          |
| `apps/web/src/components/reports/reports-nav.tsx`       | 신규 생성                            |
| `apps/web/src/components/reports/reports-sidebar.tsx`   | 신규 생성                            |
| `apps/web/src/components/reports/report-card.tsx`       | 신규 생성                            |
| `apps/web/src/server/trpc/routers/showcase.ts`          | `list` 프로시저에 `domain` 필드 추가 |
| `apps/web/src/server/auth.config.ts`                    | `/reports` 공개 페이지 예외 추가     |

---

## 비기능 요구사항

- **인증**: 로그인 불필요 — `publicProcedure` 기반 기존 showcase 라우터 재사용
- **반응형**: 모바일에서 사이드바 접힘 (768px 미만: 상단 필터 칩으로 전환)
- **성능**: `staleTime: Infinity` — 쇼케이스 목록 캐시 재사용
- **접근성**: 필터 칩에 `aria-pressed`, 카드에 `aria-label`

---

## 제외 범위 (YAGNI)

- 키워드 텍스트 검색 — 현재 건수 적어 불필요
- 날짜 범위 필터 — 도메인만으로 충분
- 정렬 기준 변경 — featuredAt 기준 고정
- 상세 패널 슬라이드인 — 별도 페이지 이동으로 충분
