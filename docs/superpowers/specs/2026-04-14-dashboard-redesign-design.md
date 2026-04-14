# AI SignalCraft 대시보드 전면 리디자인 스펙

**날짜**: 2026-04-14  
**범위**: 전체 앱 (모든 탭)  
**브랜치**: `feature/dashboard-redesign`  
**방식**: 점진적 레이어 교체 (레이아웃 쉘 → 대시보드 탭 → 나머지 탭 순)

---

## 1. 핵심 결정 사항

| 항목                   | 결정                                     |
| ---------------------- | ---------------------------------------- |
| 레이아웃 구조          | 사이드바(240px) + 메인 콘텐츠            |
| 색상 모드 기본값       | 라이트 모드 (다크 모드 지원 유지)        |
| 사이드바 스타일        | 넓은 사이드바 + 분석 잡(Job) 선택기 내장 |
| 대시보드 카드 레이아웃 | Bento Box 비정형 그리드                  |
| 리디자인 범위          | 전체 앱 (분석 실행 + 모든 결과 탭)       |
| 구현 방식              | 점진적 레이어 교체                       |

---

## 2. 전체 레이아웃 구조

### 현재 구조

```
<TopNav />          // 고정 상단 네비게이션 (h-14)
<TabLayout />       // 전체 콘텐츠 (pt-18)
```

### 새 구조

```
<div class="app-shell flex h-screen overflow-hidden">
  <AppSidebar />              // 왼쪽 고정 사이드바 (w-60, 240px)
  <div class="flex-1 flex flex-col overflow-hidden">
    <AppHeader />             // 슬림 상단 헤더 (h-12)
    <main class="flex-1 overflow-y-auto">
      <PageContent />         // 스크롤 콘텐츠 (p-6)
    </main>
  </div>
</div>
```

### 상태 관리 유지

- `dashboard/page.tsx`의 `activeTab`, `activeJobId`, `isShowcase` 상태 유지
- `TabLayout` → CSS `hidden/block` 방식으로 패널 전환 유지
- `TopNav` 삭제 → `AppSidebar` + `AppHeader`로 분리

---

## 3. AppSidebar 상세 설계

### 구성 요소 (위에서 아래)

```
┌─────────────────────────┐
│ [로고] SignalCraft       │  // 상단 고정, h-16
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ 잡 선택기           │ │  // 현재 선택된 분석 잡 표시
│ │ Job #42 · 2026-04-14│ │  // 드롭다운으로 전환
│ └─────────────────────┘ │
├─────────────────────────┤
│ 분석                     │  // 섹션 레이블
│   ▶ 분석 실행  [CTA]    │  // 파란 배경 버튼
│                          │
│ 결과                     │  // 섹션 레이블
│   ◼ 대시보드  [active]  │
│   ◼ AI 리포트           │
│   ◼ 수집 데이터         │
│                          │
│ 고급                     │  // 섹션 레이블
│   ◼ 히스토리            │
│   ◼ 고급 분석           │
│   ◼ 탐색               │
├─────────────────────────┤
│ [아바타] 사용자명        │  // 하단 고정
│         이메일          │
└─────────────────────────┘
```

### 잡 선택기 동작

- `jobId` 있음: 잡 번호 + 날짜 표시, 클릭 시 최근 잡 드롭다운
- 드롭다운 데이터: `trpcClient.analysis.getHistory` (기존 `HistoryTable` 쿼리 재사용), 최근 10개 표시
- `jobId` 없음: "분석을 먼저 실행하세요" 힌트 텍스트 (회색)
- 분석 실행 중: 잡 선택기에 `● 실행 중` 펄스 배지

### 결과 탭 잠금 동작

- `jobId` 없을 때 결과/고급 섹션 메뉴 아이템에 `Lock` 아이콘 표시
- 클릭 시 toast 안내 (현재 동작 유지)

### 하단 사용자 영역

- 아바타 + 이름/이메일
- 클릭 시 드롭다운: 설정(admin), 팀 설정, 테마 전환, 로그아웃
- 현재 `TopNav`의 우측 메뉴 기능 모두 이관

---

## 4. AppHeader 상세 설계

```
┌─────────────────────────────────────────────────────┐
│ [현재 탭 제목]          [제품소개] [벨] [설정(admin)]│  // h-12, border-bottom
└─────────────────────────────────────────────────────┘
```

- 높이 `h-12` (현재 h-14보다 슬림)
- 왼쪽: 현재 활성 탭 제목 + 서브타이틀 (예: "대시보드 · Job #42")
- 오른쪽: 제품소개 링크, 업데이트 벨(`ReleaseBell`), 설정 아이콘(admin)
- 모바일: 좌측 햄버거 버튼으로 사이드바 오버레이 표시

---

## 5. 대시보드 탭 — Bento Box 레이아웃

### CSS Grid 영역 정의

```
[ KPI 카드 × 4 — 전체 너비, 균등 4분할 ]
[ AI 인사이트 요약 (col-span 8) ] [ 여론 방향 KPI (col-span 4) ]
[ 트렌드 차트 (col-span 6)      ] [ 감성 도넛 차트 (col-span 6) ]
[ 워드 클라우드 (col-span 4)    ] [ 키워드 네트워크 (col-span 8) ]
[ 플랫폼 비교 (col-span 6)      ] [ 리스크 카드 (col-span 6)    ]
[ 기회 카드 — 전체 너비                                           ]
[ 지식 그래프 — 전체 너비 (데이터 있을 때만)                      ]
```

- 기준 그리드: `grid-cols-12`, `gap-4`
- 반응형: lg 이하에서 2열, md 이하에서 1열

### 카드 스타일

- 배경: `bg-white`, 테두리: `border border-slate-100`, 그림자: `shadow-sm`
- 호버: `hover:shadow-md hover:border-blue-200 transition-all`
- 상단 액센트 라인: 카드 종류별 2px 컬러 보더 (`border-t-2`)
  - KPI: `border-blue-500`
  - 감성/트렌드: `border-emerald-500`
  - 리스크: `border-red-400`
  - 기회: `border-amber-400`
  - AI 인사이트: `border-violet-500`

### 비교 분석 (CompareSelector/CompareView)

- Bento 그리드 위에 배치 유지 (readOnly 아닐 때)

---

## 6. 분석 실행 탭 리디자인

### 분석 실행 전 (jobId 없음)

- 메인 영역 중앙에 카드형 런처
- 스텝 표시: `① 프리셋 선택 → ② 설정 → ③ 실행`
- 현재 `PresetSelector` + `TriggerForm` 컴포넌트 재사용, 래퍼 스타일만 변경

### 분석 실행 중 (jobId 있음)

- 사이드바 잡 선택기에 `● 실행 중` 펄스 배지
- 메인 영역에 `PipelineMonitor` 전체 화면 표시
- "새 분석 실행" 버튼은 AppHeader 우측에 배치

### 파이프라인 모니터 스타일 업데이트

- 배경/카드/배지 컬러를 새 디자인 토큰으로 업데이트
- 탭(개요/수집/분석/로그) 스타일: shadcn Tabs 기본 스타일 적용

---

## 7. 나머지 탭 스타일 업데이트

각 탭의 기존 컴포넌트 로직은 유지하고, 컨테이너/카드/배경색만 새 디자인 시스템 토큰으로 업데이트:

| 탭          | 주요 컴포넌트       | 업데이트 범위          |
| ----------- | ------------------- | ---------------------- |
| AI 리포트   | `ReportView`        | 카드 배경, 섹션 구분선 |
| 수집 데이터 | `CollectedDataView` | 테이블 스타일, 카드    |
| 히스토리    | `HistoryTable`      | 테이블 헤더/행 스타일  |
| 고급 분석   | `AdvancedView`      | 카드, 차트 컨테이너    |
| 탐색        | `ExploreView`       | 카드, 필터 영역        |

---

## 8. 색상 & 디자인 토큰

### Light Mode (기본)

| 토큰             | 값                    | 용도             |
| ---------------- | --------------------- | ---------------- |
| `background`     | `#f8fafc` (slate-50)  | 앱 배경          |
| `surface`        | `#ffffff`             | 카드/사이드바    |
| `border`         | `#e2e8f0` (slate-200) | 구분선           |
| `primary`        | `#3b82f6` (blue-500)  | CTA, 액센트      |
| `primary-hover`  | `#2563eb` (blue-600)  | 버튼 호버        |
| `text-primary`   | `#0f172a` (slate-900) | 본문             |
| `text-secondary` | `#64748b` (slate-500) | 보조 텍스트      |
| `active-bg`      | `#eff6ff` (blue-50)   | 활성 메뉴 배경   |
| `active-text`    | `#1d4ed8` (blue-700)  | 활성 메뉴 텍스트 |

### Dark Mode (기존 유지 + 사이드바 업데이트)

- 사이드바: `#1e293b` (slate-800)
- 배경: 기존 `bg-background` 유지

---

## 9. 파일 변경 범위

### 신규 생성

- `apps/web/src/components/layout/app-sidebar.tsx` — 새 사이드바
- `apps/web/src/components/layout/app-header.tsx` — 새 상단 헤더
- `apps/web/src/components/layout/app-shell.tsx` — 전체 레이아웃 쉘

### 수정

- `apps/web/src/app/dashboard/page.tsx` — TopNav/TabLayout → AppShell 교체
- `apps/web/src/app/layout.tsx` — 전역 배경색 업데이트
- `apps/web/src/components/layout/tab-layout.tsx` — 패딩/여백 조정
- `apps/web/src/components/dashboard/dashboard-view.tsx` — Bento 그리드 레이아웃 적용
- `apps/web/src/components/dashboard/kpi-cards.tsx` — 카드 스타일 업데이트
- `apps/web/src/components/dashboard/insight-summary.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/sentiment-chart.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/trend-chart.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/word-cloud.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/keyword-network-graph.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/platform-compare.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/risk-cards.tsx` — 카드 스타일
- `apps/web/src/components/dashboard/opportunity-cards.tsx` — 카드 스타일
- `apps/web/src/components/analysis/pipeline-monitor/` — 스타일 토큰 업데이트

### 삭제

- `apps/web/src/components/layout/top-nav.tsx` — AppSidebar/AppHeader로 대체

---

## 10. 구현 순서 (점진적 교체)

1. **Phase 1 — 브랜치 생성 + 레이아웃 쉘 교체**
   - `feature/dashboard-redesign` 브랜치 생성
   - `AppSidebar`, `AppHeader`, `AppShell` 컴포넌트 신규 작성
   - `dashboard/page.tsx`에서 TopNav → AppShell 교체
   - `top-nav.tsx` 삭제

2. **Phase 2 — 대시보드 탭 Bento Box 적용**
   - `dashboard-view.tsx` Bento 그리드 레이아웃 적용
   - 모든 대시보드 카드 컴포넌트 스타일 업데이트

3. **Phase 3 — 분석 실행 탭 리디자인**
   - 분석 런처 중앙 정렬 카드형으로 변경
   - 파이프라인 모니터 스타일 업데이트

4. **Phase 4 — 나머지 탭 스타일 정비**
   - AI 리포트, 수집 데이터, 히스토리, 고급 분석, 탐색 탭 순차 업데이트

5. **Phase 5 — 검토 및 마무리**
   - 다크 모드 호환성 확인
   - 반응형 모바일 확인
   - PR 생성 → main merge
