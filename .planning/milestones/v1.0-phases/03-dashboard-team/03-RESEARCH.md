# Phase 3: Dashboard + Team - Research

**Researched:** 2026-03-24
**Domain:** Next.js App Router full-stack dashboard (tRPC, NextAuth, shadcn/ui, Recharts)
**Confidence:** HIGH

## Summary

Phase 3는 apps/web 디렉토리에 완전한 대시보드 앱을 구축하는 단계다. 현재 web 앱은 빈 셸(layout.tsx, page.tsx만 존재)이며, 모든 의존성(shadcn/ui, Tailwind CSS 4, tRPC 11, NextAuth v5 beta, TanStack Query 5, Recharts 3, next-themes)을 새로 설치해야 한다. 기존 core 패키지에 분석 결과 스키마(8개 모듈 Zod 타입), DB 스키마(collectionJobs, analysisResults, analysisReports), BullMQ 트리거 함수(triggerCollection, triggerAnalysis)가 이미 구현되어 있어 tRPC 라우터에서 직접 호출할 수 있다.

대시보드는 4개 탭(분석 실행 / 결과 대시보드 / AI 리포트 / 히스토리) 구조이며, 다크모드 기본의 데이터 밀도 높은 UI를 shadcn/ui 카드 기반으로 구성한다. 인증은 NextAuth.js v5(beta)의 Credentials + Google OAuth를 사용하며, Drizzle Adapter로 users/accounts/sessions 테이블을 관리한다. 팀 기능은 teams/team_members/invitations 테이블 추가로 구현한다.

**Primary recommendation:** shadcn/ui 초기화 + Tailwind 4 + tRPC 11 세팅을 첫 Plan에서 완료하고, 이후 인증 -> 대시보드 탭별 -> 팀 기능 순서로 진행한다.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 단일 페이지 + 탭 구조. 상단 네비게이션 바에 Logo, 탭, 사용자 메뉴 배치.
- **D-02:** 4개 탭 구성: 분석 실행 | 결과 대시보드 | AI 리포트 | 히스토리.
- **D-03:** 데이터 대시보드 전문 툴 느낌. 다크모드 기본, 카드 기반 레이아웃, 데이터 밀도 높음. Grafana/Mixpanel 참고.
- **D-04:** 분석 실행 탭은 단일 폼 카드 -- 키워드 입력 + 소스 체크박스(All/네이버/유튜브) + 기간 선택 + 실행 버튼. 아래에 최근 실행 목록 표시.
- **D-05:** 고정 그리드 레이아웃으로 차트 배치 (드래그 커스터마이즈 없음).
- **D-06:** 감성 비율은 Pie/Donut 차트, 시계열 트렌드는 Line 차트 (Recharts via shadcn 차트 컴포넌트).
- **D-07:** 키워드/연관어는 워드클라우드로 시각화. React 워드클라우드 라이브러리 활용.
- **D-08:** 리스크/기회는 카드 리스트 + 영향도 프로그레스 바로 표현. 긴급도별 정렬, 색상 코딩.
- **D-09:** 마크다운 렌더링 + 왼쪽 섹션 네비게이션 구조. PDF 내보내기 버튼 상단 배치.
- **D-10:** Phase 2에서 생성된 마크다운 리포트를 전용 렌더러로 표시. 섹션별 빠른 이동 지원.
- **D-11:** TanStack Query refetchInterval 폴링 방식 (2~5초 간격). SSE/WebSocket 불필요.
- **D-12:** 단계별 프로그레스 바 (수집 -> 정규화 -> 분석 -> 리포트) + 소스별(네이버/유튜브) 수집 건수 표시. Phase 1 DB 데이터 직접 활용.
- **D-13:** 에러 발생 시 인라인 에러 표시 + 재시도 버튼. 성공한 소스 결과는 유지 (Phase 1 부분실패 허용 정책 계승).
- **D-14:** NextAuth.js 5.x -- Credentials(이메일/비밀번호) + Google OAuth 프로바이더 병행.
- **D-15:** 팀원 역할은 2단계: Admin(팀원 초대/제거 + 전체 기능) / Member(분석 실행 + 결과 조회).
- **D-16:** 팀원 초대는 이메일 초대 링크 방식. 관리자가 이메일 입력 -> 초대 링크 발송 -> 클릭 시 회원가입/로그인. 메일 서버(Resend 또는 Nodemailer) 필요.
- **D-17:** 히스토리 탭에서 과거 분석 목록 조회 (날짜, 키워드, 상태). 클릭 시 해당 결과 대시보드/리포트로 이동.
- **D-18:** Phase 2에서 저장된 analysis_results, analysis_reports 테이블 기반으로 조회.

### Claude's Discretion

- shadcn/ui 컴포넌트 조합 및 테마 세부 설정
- 그리드 레이아웃 세부 크기/배치 비율
- 워드클라우드 라이브러리 선택 (react-wordcloud 등)
- 마크다운 렌더러 라이브러리 선택 (react-markdown 등)
- 폼 유효성 검증 세부 로직
- 로딩 스켈레톤 및 빈 상태(empty state) 디자인
- tRPC 라우터 구조 및 API 엔드포인트 설계
- DB 테이블 추가 필요 시 스키마 설계 (users, teams, invitations 등)
- 폴링 간격 세부 조정 (2초 vs 5초)
- 메일 서버 선택 및 설정

### Deferred Ideas (OUT OF SCOPE)

- 재분석(기존 수집 데이터 재처리) 트리거 기능 -- Planner 판단에 위임
- 드래그 기반 대시보드 커스터마이즈 -- 고정 그리드로 결정
- 분석 결과 비교 뷰 (A vs B 나란히) -- 히스토리에서 조회만 가능
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                  | Research Support                                                                            |
| ------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| DASH-01 | 분석 실행 트리거 UI (인물/키워드 입력, 소스 선택, 기간 설정) | tRPC mutation -> triggerCollection() + triggerAnalysis(). shadcn Form + DatePicker 컴포넌트 |
| DASH-02 | 파이프라인 실행 상태 모니터링 (진행률, 작업별 상태)          | TanStack Query refetchInterval 폴링. collectionJobs.progress JSONB 필드 직접 조회           |
| DASH-03 | 감성 분석 시각화 (긍정/부정/중립 비율 차트, 시계열 트렌드)   | Recharts PieChart(sentimentRatio) + LineChart(dailyMentionTrend). shadcn chart 컴포넌트     |
| DASH-04 | 키워드/연관어 시각화 (워드클라우드)                          | @isoterik/react-word-cloud (d3-cloud 기반). topKeywords + relatedKeywords 데이터            |
| DASH-05 | AI 리포트 뷰어 (섹션 네비게이션, 전문 표시)                  | react-markdown + remark-gfm. analysisReports.markdownContent 렌더링                         |
| DASH-06 | 분석 히스토리 목록 (과거 분석 결과 조회)                     | tRPC query -> collectionJobs + analysisReports JOIN. DataTable 컴포넌트                     |
| DASH-07 | 리스크/기회 대시보드 (리스크 맵, 기회 매트릭스)              | shadcn Card + Progress 컴포넌트. risk-map/opportunity 모듈 결과 시각화                      |
| TEAM-01 | 사용자 인증 (이메일/비밀번호 로그인)                         | NextAuth v5 beta + Credentials provider + bcryptjs. @auth/drizzle-adapter                   |
| TEAM-02 | 팀 멤버 관리 (초대, 역할 할당)                               | teams/team_members/invitations DB 테이블. Resend API로 초대 이메일 발송                     |
| TEAM-03 | 분석 결과 팀 공유 (동일 분석 결과 팀원 전체 접근)            | collectionJobs에 teamId FK 추가. tRPC 미들웨어에서 팀 소속 검증                             |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **패키지 매니저:** pnpm 사용 (bun 보조)
- **Node.js:** v24.14.0 사용 중
- **보안:** API 키/비밀번호 하드코딩 금지, .env 커밋 금지
- **커밋:** 한국어 메시지, feat/fix/docs 등 타입 prefix
- **FSD 아키텍처:** 10개+ 페이지, 2개+ 도메인이면 FSD 적용 고려 -- 이 프로젝트는 단일 페이지+탭 구조이므로 FSD 미적용, @/ alias 기반 기능 폴더 구조로 충분
- **GSD 워크플로우:** Edit/Write 전에 GSD 명령 경유
- **인프라:** 운영 서버(192.168.0.5) PostgreSQL 활용, Redis 6380/6381

## Standard Stack

### Core

| Library      | Version      | Purpose           | Why Standard                                      |
| ------------ | ------------ | ----------------- | ------------------------------------------------- |
| Next.js      | 16.2.1       | App Router 풀스택 | 이미 설치됨. Server Components + API Routes       |
| React        | 19.x         | UI 라이브러리     | Next.js 16 번들                                   |
| TypeScript   | 5.8.x        | 타입 안전성       | 이미 설치됨                                       |
| Tailwind CSS | 4.2.2        | 스타일링          | shadcn/ui 필수. v4는 설정 파일 불필요 (CSS-first) |
| shadcn/ui    | latest (CLI) | UI 컴포넌트       | 대시보드 카드/차트/테이블/폼. Copy-paste 모델     |
| next-themes  | 0.4.6        | 다크모드 토글     | shadcn/ui 공식 다크모드 솔루션                    |

### API & Data

| Library        | Version | Purpose        | Why Standard                                             |
| -------------- | ------- | -------------- | -------------------------------------------------------- |
| tRPC           | 11.15.0 | 타입 안전 API  | @trpc/server + @trpc/client + @trpc/tanstack-react-query |
| TanStack Query | 5.95.2  | 서버 상태 관리 | tRPC 통합. refetchInterval로 폴링                        |
| Drizzle ORM    | 0.40.x  | DB 쿼리        | core 패키지에 이미 설치. web에서 공유                    |
| Zod            | 3.24.x  | 스키마 검증    | tRPC input 검증 + 분석 결과 타입                         |

### Authentication

| Library               | Version       | Purpose       | Why Standard                               |
| --------------------- | ------------- | ------------- | ------------------------------------------ |
| next-auth             | 5.0.0-beta.30 | 인증          | Credentials + Google OAuth. v5 beta가 최신 |
| @auth/drizzle-adapter | 1.11.1        | DB 어댑터     | NextAuth + Drizzle 연결                    |
| bcryptjs              | 3.0.3         | 비밀번호 해싱 | Credentials provider용                     |

### Visualization

| Library                    | Version | Purpose               | Why Standard                                                  |
| -------------------------- | ------- | --------------------- | ------------------------------------------------------------- |
| Recharts                   | 3.8.0   | 차트 (Pie, Line, Bar) | shadcn chart 컴포넌트 기반                                    |
| @isoterik/react-word-cloud | 1.3.0   | 워드클라우드          | d3-cloud 기반, React 19 호환, 경량(7KB), 애니메이션/툴팁 내장 |
| react-markdown             | 10.1.0  | 마크다운 렌더링       | AI 리포트 뷰어용. remark-gfm 플러그인                         |
| remark-gfm                 | latest  | GFM 지원              | 테이블, 체크리스트 등                                         |

### Email

| Library | Version | Purpose     | Why Standard                                          |
| ------- | ------- | ----------- | ----------------------------------------------------- |
| Resend  | 6.9.4   | 이메일 발송 | 팀 초대 이메일. 무료 3,000건/월. API 키 방식으로 간단 |

### Alternatives Considered

| Instead of                 | Could Use                    | Tradeoff                                                                                                 |
| -------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| @isoterik/react-word-cloud | @cp949/react-wordcloud 1.0.1 | cp949는 react-wordcloud의 React 19 호환 포크. isoterik은 더 가볍고 d3-cloud 직접 활용, 커스터마이즈 용이 |
| Resend                     | Nodemailer                   | Nodemailer는 SMTP 서버 필요. Resend는 API 호출만으로 발송. 소규모 팀에 Resend가 적합                     |
| next-auth v5 beta          | Lucia Auth                   | NextAuth가 Next.js 생태계 표준. beta이지만 App Router 통합 안정적. Lucia는 더 low-level                  |
| react-markdown             | @mdx-js/mdx                  | MDX는 과도함. 순수 마크다운 렌더링에 react-markdown이 가볍고 적합                                        |

**Installation:**

```bash
# Web 앱 의존성 (apps/web)
pnpm --filter @ai-signalcraft/web add @trpc/server@latest @trpc/client@latest @trpc/tanstack-react-query@latest @tanstack/react-query@latest next-auth@beta @auth/drizzle-adapter bcryptjs recharts react-markdown remark-gfm @isoterik/react-word-cloud next-themes resend zod

pnpm --filter @ai-signalcraft/web add -D @types/bcryptjs tailwindcss @tailwindcss/postcss

# shadcn/ui 초기화 (interactive)
cd apps/web && npx shadcn@latest init

# 워크스페이스 의존성
pnpm --filter @ai-signalcraft/web add @ai-signalcraft/core@workspace:*
```

## Architecture Patterns

### Recommended Project Structure

```
apps/web/src/
├── app/                         # Next.js App Router (라우팅만)
│   ├── layout.tsx               # 루트 레이아웃 (ThemeProvider, TRPCProvider)
│   ├── page.tsx                 # 메인 대시보드 (탭 구조)
│   ├── api/
│   │   ├── trpc/[trpc]/route.ts # tRPC HTTP 핸들러
│   │   └── auth/[...nextauth]/route.ts  # NextAuth 핸들러
│   ├── login/page.tsx           # 로그인 페이지
│   └── invite/[token]/page.tsx  # 초대 수락 페이지
├── server/                      # 서버 전용 코드
│   ├── trpc/
│   │   ├── init.ts              # tRPC 초기화 (context, middleware)
│   │   ├── router.ts            # 루트 라우터
│   │   └── routers/
│   │       ├── analysis.ts      # 분석 트리거/결과 조회
│   │       ├── pipeline.ts      # 파이프라인 상태 모니터링
│   │       ├── report.ts        # 리포트 조회/PDF
│   │       ├── history.ts       # 히스토리 목록
│   │       └── team.ts          # 팀 관리/초대
│   └── auth.ts                  # NextAuth 설정
├── components/
│   ├── ui/                      # shadcn/ui 컴포넌트 (자동 생성)
│   ├── layout/
│   │   ├── top-nav.tsx          # 상단 네비게이션 바
│   │   └── tab-layout.tsx       # 탭 컨테이너
│   ├── analysis/
│   │   ├── trigger-form.tsx     # 분석 실행 폼
│   │   ├── recent-jobs.tsx      # 최근 실행 목록
│   │   └── pipeline-monitor.tsx # 파이프라인 진행률
│   ├── dashboard/
│   │   ├── sentiment-chart.tsx  # 감성 비율 Pie/Donut
│   │   ├── trend-chart.tsx      # 시계열 Line 차트
│   │   ├── word-cloud.tsx       # 워드클라우드
│   │   ├── risk-cards.tsx       # 리스크 카드 리스트
│   │   └── opportunity-cards.tsx# 기회 카드 리스트
│   ├── report/
│   │   ├── report-viewer.tsx    # 마크다운 렌더러
│   │   └── section-nav.tsx      # 섹션 네비게이션
│   ├── history/
│   │   └── history-table.tsx    # 히스토리 DataTable
│   └── team/
│       ├── invite-form.tsx      # 팀원 초대 폼
│       └── member-list.tsx      # 팀원 목록
├── lib/
│   ├── trpc.ts                  # tRPC 클라이언트 설정
│   └── utils.ts                 # 유틸리티 (cn 등, shadcn 생성)
└── hooks/
    └── use-pipeline-status.ts   # 파이프라인 폴링 훅
```

### Pattern 1: tRPC v11 + TanStack Query + Server Components

**What:** tRPC v11의 queryOptions 패턴으로 서버에서 prefetch하고 클라이언트에서 hydrate

**When to use:** 모든 데이터 페칭 (결과 조회, 히스토리, 팀 목록 등)

```typescript
// server/trpc/init.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth';
import { db } from '@ai-signalcraft/core';

const t = initTRPC.context<{ session: Awaited<ReturnType<typeof getServerSession>> }>().create();

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, session: ctx.session } });
});
export const router = t.router;
```

```typescript
// lib/trpc.ts (클라이언트)
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/server/trpc/router';

export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/api/trpc' })],
});
```

### Pattern 2: TanStack Query 폴링으로 파이프라인 모니터링

**What:** refetchInterval을 사용한 파이프라인 상태 폴링

**When to use:** DASH-02 파이프라인 모니터링

```typescript
// hooks/use-pipeline-status.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';

export function usePipelineStatus(jobId: number | null) {
  return useQuery({
    ...trpc.pipeline.getStatus.queryOptions({ jobId: jobId! }),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // 완료/실패 시 폴링 중단
      if (status === 'completed' || status === 'failed') return false;
      return 3000; // 3초 간격
    },
  });
}
```

### Pattern 3: NextAuth v5 + Drizzle Adapter + Credentials

**What:** NextAuth v5 beta로 이메일/비밀번호 + Google OAuth 병행 인증

**When to use:** TEAM-01 인증

```typescript
// server/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@ai-signalcraft/core';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        // DB에서 사용자 조회 + bcrypt.compare
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' }, // Credentials 사용 시 JWT 필수
});
```

### Pattern 4: shadcn Chart with Recharts

**What:** shadcn/ui의 ChartContainer로 Recharts 차트를 테마 시스템에 통합

**When to use:** DASH-03, DASH-06 모든 차트

```typescript
// components/dashboard/sentiment-chart.tsx
'use client';
import { PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartConfig = {
  positive: { label: '긍정', color: 'hsl(var(--chart-1))' },
  negative: { label: '부정', color: 'hsl(var(--chart-2))' },
  neutral:  { label: '중립', color: 'hsl(var(--chart-3))' },
};

export function SentimentChart({ data }: { data: { positive: number; negative: number; neutral: number } }) {
  const chartData = [
    { name: 'positive', value: data.positive },
    { name: 'negative', value: data.negative },
    { name: 'neutral', value: data.neutral },
  ];
  return (
    <ChartContainer config={chartConfig}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} />
      </PieChart>
    </ChartContainer>
  );
}
```

### Anti-Patterns to Avoid

- **Server Actions for 읽기 전용 데이터:** Server Actions는 mutation 전용. 읽기는 tRPC query + TanStack Query 사용
- **useEffect + fetch 패턴:** tRPC queryOptions로 대체. 타입 안전성 + 캐싱 + 자동 갱신
- **NextAuth JWT에 민감 정보 저장:** JWT에는 userId, role만. 팀 정보는 DB 조회
- **클라이언트에서 DB 직접 접근:** 반드시 tRPC 라우터를 경유. 인증/권한 미들웨어 적용

## Don't Hand-Roll

| Problem       | Don't Build          | Use Instead                       | Why                                                      |
| ------------- | -------------------- | --------------------------------- | -------------------------------------------------------- |
| 인증 시스템   | 자체 JWT 발급/검증   | NextAuth v5 + Drizzle Adapter     | 세션 관리, 토큰 갱신, CSRF 보호 등 수십 가지 엣지 케이스 |
| 차트 렌더링   | SVG 직접 생성        | Recharts + shadcn ChartContainer  | 반응형, 툴팁, 애니메이션, 다크모드 자동 처리             |
| 폼 검증       | 자체 validation 로직 | Zod + tRPC input validation       | 클라이언트/서버 양쪽 검증 일관성                         |
| 비밀번호 해싱 | 자체 해싱 로직       | bcryptjs                          | salt 생성, timing attack 방어                            |
| 다크모드      | CSS 변수 수동 관리   | next-themes + shadcn 테마         | SSR 깜빡임 방지, 시스템 설정 연동                        |
| 이메일 발송   | SMTP 직접 연결       | Resend API                        | 스팸 방지, 전달률 관리, 템플릿                           |
| 데이터 테이블 | table 태그 수동 구성 | shadcn DataTable (TanStack Table) | 정렬, 필터, 페이지네이션 내장                            |
| 워드클라우드  | canvas/SVG 직접 배치 | @isoterik/react-word-cloud        | d3-cloud 알고리즘(spiral placement), 충돌 감지           |

**Key insight:** 대시보드는 "조합(composition)" 작업이다. 개별 컴포넌트를 만드는 것이 아니라 검증된 라이브러리를 올바르게 조합하는 것이 핵심이다.

## Common Pitfalls

### Pitfall 1: NextAuth v5 Credentials + Database Session 충돌

**What goes wrong:** Credentials provider는 기본 database session strategy와 호환되지 않아 세션이 null 반환
**Why it happens:** Credentials provider는 authorize()에서 반환한 user 객체를 adapter에 저장하지 않음 (OAuth와 달리)
**How to avoid:** `session: { strategy: 'jwt' }` 명시적 설정. JWT callback에서 userId/role 주입
**Warning signs:** 로그인 성공 후 getServerSession()이 null 반환

### Pitfall 2: tRPC v11 + App Router 설정 복잡도

**What goes wrong:** tRPC v11의 Server/Client 분리가 명확하지 않으면 hydration mismatch 발생
**Why it happens:** Server Components에서 tRPC caller 사용과 Client Components에서 TanStack Query 사용을 혼동
**How to avoid:** server/trpc/ 디렉토리에 서버 전용 코드 격리. 'use client' 컴포넌트에서만 useQuery 사용. Server Components에서는 createCaller 사용
**Warning signs:** "hydration mismatch" 에러, "window is not defined" 에러

### Pitfall 3: Tailwind CSS 4 + shadcn/ui 호환성

**What goes wrong:** Tailwind CSS 4는 tailwind.config.js 대신 CSS-first 설정. 기존 shadcn/ui 가이드가 v3 기준
**Why it happens:** shadcn/ui CLI가 최신 Tailwind 4를 지원하지만, 수동 설정 시 v3 패턴을 따라가기 쉬움
**How to avoid:** `npx shadcn@latest init` CLI로 초기화하면 자동으로 Tailwind 4 호환 설정 생성. 수동으로 tailwind.config.js 생성하지 않기
**Warning signs:** "Cannot find module 'tailwindcss'" 에러, CSS 변수가 적용되지 않음

### Pitfall 4: collectionJobs 테이블에 teamId 없음

**What goes wrong:** 팀 기능 추가 시 기존 collectionJobs 레코드가 특정 팀에 속하지 않아 조회 불가
**Why it happens:** Phase 1에서 팀 개념 없이 설계됨
**How to avoid:** collectionJobs에 teamId nullable FK 추가하는 마이그레이션 실행. 기존 레코드는 null 허용
**Warning signs:** 팀 필터링 쿼리에서 빈 결과

### Pitfall 5: 워드클라우드 SSR 에러

**What goes wrong:** 워드클라우드 라이브러리가 `window`/`document` 참조하여 SSR 실패
**Why it happens:** d3-cloud 내부적으로 Canvas API 사용
**How to avoid:** 워드클라우드 컴포넌트를 `'use client'`로 선언하고 `dynamic(() => import('./word-cloud'), { ssr: false })` 사용
**Warning signs:** "document is not defined" 에러

### Pitfall 6: NextAuth v5 beta API 불안정

**What goes wrong:** next-auth@beta API가 GA와 달라 문서 혼동
**Why it happens:** v5는 아직 beta. v4 문서와 v5 문서가 혼재
**How to avoid:** 반드시 https://authjs.dev 공식 문서의 v5 가이드 참조. next-auth.js.org는 v4 문서
**Warning signs:** import 경로 에러, 타입 불일치

## DB Schema Additions (Auth + Team)

Phase 3에서 추가해야 할 DB 스키마:

```typescript
// packages/core/src/db/schema/auth.ts (NextAuth 표준 + 팀 확장)

// NextAuth 필수 테이블 (DrizzleAdapter가 기대하는 스키마)
export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  hashedPassword: text('hashed_password'), // Credentials용
  role: text('role', { enum: ['admin', 'member'] })
    .notNull()
    .default('member'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  /* NextAuth 표준 */
});
export const sessions = pgTable('sessions', {
  /* NextAuth 표준 */
});
export const verificationTokens = pgTable('verification_tokens', {
  /* NextAuth 표준 */
});

// 팀 기능 테이블
export const teams = pgTable('teams', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  createdBy: text('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teamMembers = pgTable('team_members', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer('team_id')
    .references(() => teams.id)
    .notNull(),
  userId: text('user_id')
    .references(() => users.id)
    .notNull(),
  role: text('role', { enum: ['admin', 'member'] })
    .notNull()
    .default('member'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const invitations = pgTable('invitations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer('team_id')
    .references(() => teams.id)
    .notNull(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  role: text('role', { enum: ['admin', 'member'] })
    .notNull()
    .default('member'),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**collectionJobs 테이블 변경:**

```typescript
// teamId 컬럼 추가 (nullable -- 기존 레코드 호환)
teamId: integer('team_id').references(() => teams.id),
```

## tRPC Router Design

```
appRouter
├── analysis
│   ├── trigger        (mutation) -- 키워드/소스/기간으로 분석 실행
│   ├── getResults     (query)    -- jobId별 분석 결과 조회 (8개 모듈)
│   └── getReport      (query)    -- jobId별 AI 리포트 조회
├── pipeline
│   ├── getStatus      (query)    -- jobId별 파이프라인 상태 (폴링용)
│   └── retry          (mutation) -- 실패한 작업 재시도
├── history
│   ├── list           (query)    -- 팀 분석 히스토리 목록 (페이지네이션)
│   └── getDetail      (query)    -- 특정 분석 상세 (결과+리포트)
├── team
│   ├── getCurrent     (query)    -- 현재 팀 정보 + 멤버 목록
│   ├── invite         (mutation) -- 이메일 초대 발송
│   ├── removeMember   (mutation) -- 멤버 제거 (admin only)
│   └── acceptInvite   (mutation) -- 초대 수락
└── user
    └── getProfile     (query)    -- 현재 사용자 프로필
```

## Code Examples

### Analysis Trigger (tRPC mutation -> BullMQ)

```typescript
// server/trpc/routers/analysis.ts
import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { triggerCollection, db, collectionJobs } from '@ai-signalcraft/core';

export const analysisRouter = router({
  trigger: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(100),
        sources: z.array(z.enum(['naver', 'youtube'])).min(1),
        startDate: z.string(), // ISO 날짜
        endDate: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 1. collectionJobs 레코드 생성
      const [job] = await db
        .insert(collectionJobs)
        .values({
          keyword: input.keyword,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          status: 'pending',
          teamId: ctx.session.user.teamId,
        })
        .returning();

      // 2. BullMQ 트리거
      await triggerCollection(
        {
          keyword: input.keyword,
          startDate: input.startDate,
          endDate: input.endDate,
        },
        job.id,
      );

      return { jobId: job.id };
    }),
});
```

### Pipeline Status 폴링

```typescript
// server/trpc/routers/pipeline.ts
import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { db, collectionJobs, analysisResults } from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';

export const pipelineRouter = router({
  getStatus: protectedProcedure.input(z.object({ jobId: z.number() })).query(async ({ input }) => {
    const job = await db.query.collectionJobs.findFirst({
      where: eq(collectionJobs.id, input.jobId),
    });

    // 분석 모듈 진행 상태도 함께 조회
    const moduleStatuses = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.jobId, input.jobId));

    return {
      status: job?.status,
      progress: job?.progress,
      modules: moduleStatuses.map((m) => ({
        name: m.module,
        status: m.status,
      })),
    };
  }),
});
```

## State of the Art

| Old Approach                     | Current Approach                              | When Changed      | Impact                                             |
| -------------------------------- | --------------------------------------------- | ----------------- | -------------------------------------------------- |
| NextAuth v4 (next-auth)          | NextAuth v5 beta (next-auth@beta)             | 2024              | Auth() API, 미들웨어 통합, App Router 네이티브     |
| tRPC v10 + createNextApiHandler  | tRPC v11 + queryOptions + fetchRequestHandler | 2024              | Server Components prefetch, TanStack Query v5 통합 |
| Tailwind CSS v3 (config-based)   | Tailwind CSS v4 (CSS-first)                   | 2025              | tailwind.config.js 불필요, @import "tailwindcss"   |
| shadcn/ui add chart (Recharts 2) | shadcn/ui chart (Recharts 3)                  | 2025              | ChartContainer + 자동 다크모드                     |
| useQuery(queryKey, queryFn)      | useQuery(queryOptions())                      | TanStack Query v5 | queryOptions 패턴으로 서버/클라이언트 공유         |

**Deprecated/outdated:**

- `@trpc/next`: tRPC v11에서는 사용하지 않음. `@trpc/tanstack-react-query`로 대체
- `next-auth/react` SessionProvider: v5에서는 `auth()` 서버 함수 사용 권장
- `tailwind.config.js`: Tailwind 4에서는 CSS 파일에서 직접 설정

## Open Questions

1. **NextAuth v5 beta 안정성**
   - What we know: v5 beta.30이 최신. v5 stable은 아직 출시되지 않음
   - What's unclear: beta에서 GA까지 breaking change 가능성
   - Recommendation: beta 사용하되, auth.ts를 단일 파일로 격리하여 향후 마이그레이션 용이하게 구성

2. **기존 collectionJobs 데이터 마이그레이션**
   - What we know: teamId 컬럼이 없는 기존 레코드 존재 가능
   - What's unclear: 기존 데이터를 특정 팀에 할당할지 여부
   - Recommendation: teamId nullable로 추가. 기존 데이터는 null 유지. "팀 없는 작업" 허용 또는 첫 번째 팀 생성 시 기존 작업 자동 할당

3. **Google OAuth 설정**
   - What we know: Google Cloud Console에서 OAuth 2.0 Client ID 필요
   - What's unclear: 사용자가 이미 Google Cloud 프로젝트를 보유하는지
   - Recommendation: Credentials 인증을 먼저 구현, Google OAuth는 환경변수 있을 때만 활성화

## Environment Availability

| Dependency | Required By | Available | Version                 | Fallback                            |
| ---------- | ----------- | --------- | ----------------------- | ----------------------------------- |
| Node.js    | 전체        | YES       | 24.14.0                 | --                                  |
| pnpm       | 패키지 관리 | YES       | 10.28.2                 | --                                  |
| PostgreSQL | 데이터 저장 | YES       | 16.x (192.168.0.5:5433) | --                                  |
| Redis      | BullMQ/캐싱 | YES       | 7.x (192.168.0.5:6380)  | --                                  |
| Resend API | 이메일 발송 | UNKNOWN   | --                      | Nodemailer + SMTP (환경변수로 분기) |

**Missing dependencies with no fallback:**

- 없음 -- 모든 핵심 의존성이 이미 가용

**Missing dependencies with fallback:**

- Resend API Key: 없으면 이메일 발송 불가. 초대 기능을 콘솔 로그 + 직접 URL 복사로 대체 가능
- Google OAuth Client ID/Secret: 없으면 Credentials 인증만 사용

## Validation Architecture

### Test Framework

| Property           | Value                                                  |
| ------------------ | ------------------------------------------------------ |
| Framework          | Vitest 3.x                                             |
| Config file        | 없음 -- Wave 0에서 apps/web/vitest.config.ts 생성 필요 |
| Quick run command  | `pnpm --filter @ai-signalcraft/web test`               |
| Full suite command | `pnpm test`                                            |

### Phase Requirements to Test Map

| Req ID  | Behavior                                                   | Test Type | Automated Command                                                                                        | File Exists? |
| ------- | ---------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------- | ------------ |
| DASH-01 | 분석 트리거 mutation이 collectionJobs 생성 + BullMQ 트리거 | unit      | `pnpm --filter @ai-signalcraft/web vitest run src/server/trpc/routers/analysis.test.ts -t "trigger"`     | Wave 0       |
| DASH-02 | 파이프라인 상태 query가 job status + module statuses 반환  | unit      | `pnpm --filter @ai-signalcraft/web vitest run src/server/trpc/routers/pipeline.test.ts`                  | Wave 0       |
| DASH-03 | 감성 차트 컴포넌트가 sentimentRatio 데이터로 렌더링        | unit      | `pnpm --filter @ai-signalcraft/web vitest run src/components/dashboard/sentiment-chart.test.tsx`         | Wave 0       |
| DASH-04 | 워드클라우드가 topKeywords 데이터로 렌더링                 | unit      | `pnpm --filter @ai-signalcraft/web vitest run src/components/dashboard/word-cloud.test.tsx`              | Wave 0       |
| DASH-05 | 마크다운 리포트가 섹션 네비게이션과 함께 렌더링            | unit      | `pnpm --filter @ai-signalcraft/web vitest run src/components/report/report-viewer.test.tsx`              | Wave 0       |
| DASH-06 | 히스토리 목록이 페이지네이션과 함께 조회                   | unit      | `pnpm --filter @ai-signalcraft/web vitest run src/server/trpc/routers/history.test.ts`                   | Wave 0       |
| DASH-07 | 리스크/기회 카드가 영향도 순 정렬로 렌더링                 | unit      | `pnpm --filter @ai-signalcraft/web vitest run src/components/dashboard/risk-cards.test.tsx`              | Wave 0       |
| TEAM-01 | Credentials 로그인 성공/실패                               | unit      | `pnpm --filter @ai-signalcraft/web vitest run src/server/auth.test.ts`                                   | Wave 0       |
| TEAM-02 | 팀 초대 생성 + 토큰 유효성 검증                            | unit      | `pnpm --filter @ai-signalcraft/web vitest run src/server/trpc/routers/team.test.ts`                      | Wave 0       |
| TEAM-03 | 팀 소속 사용자만 해당 팀 분석 결과 접근 가능               | unit      | `pnpm --filter @ai-signalcraft/web vitest run src/server/trpc/routers/analysis.test.ts -t "team access"` | Wave 0       |

### Sampling Rate

- **Per task commit:** `pnpm --filter @ai-signalcraft/web test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/vitest.config.ts` -- Vitest + React Testing Library 설정
- [ ] `apps/web/src/test/setup.ts` -- jsdom 환경 설정, mock 공통 설정
- [ ] Framework install: `pnpm --filter @ai-signalcraft/web add -D @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom`

## Sources

### Primary (HIGH confidence)

- 프로젝트 코드 직접 확인: `packages/core/src/db/schema/`, `packages/core/src/analysis/`, `packages/core/src/queue/flows.ts`
- npm registry 직접 조회: 모든 패키지 버전 `npm view` 확인 (2026-03-24)
- shadcn/ui 공식: https://ui.shadcn.com/docs/dark-mode/next
- tRPC 공식: https://trpc.io/docs/client/nextjs

### Secondary (MEDIUM confidence)

- [tRPC 11 Setup for Next.js App Router](https://dev.to/matowang/trpc-11-setup-for-nextjs-app-router-2025-33fo) -- v11 + App Router 실전 패턴
- [Auth.js Drizzle Adapter](https://authjs.dev/getting-started/adapters/drizzle) -- 공식 문서
- [Auth.js v5 + Drizzle 통합 가이드](https://reetesh.in/blog/authentication-using-auth.js-v5-and-drizzle-for-next.js-app-router) -- 실전 예제
- [@isoterik/react-word-cloud](https://github.com/isoteriksoftware/react-word-cloud) -- React 19 호환 워드클라우드

### Tertiary (LOW confidence)

- NextAuth v5 beta API 세부 동작 -- beta 단계로 변경 가능성 있음

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - 모든 패키지 버전 npm 직접 확인. 기존 프로젝트 코드와 호환성 검증
- Architecture: HIGH - tRPC v11 + App Router 공식 문서 기반. 기존 core 패키지 구조 확인
- Pitfalls: HIGH - NextAuth v5 Credentials 이슈는 공식 GitHub discussion에서 확인된 알려진 문제
- DB Schema: MEDIUM - NextAuth DrizzleAdapter 스키마는 공식 문서 기반이나 v5 beta 변경 가능성

**Research date:** 2026-03-24
**Valid until:** 2026-04-07 (NextAuth beta 빠른 업데이트 주기 고려 7일)
