# Analysis Preset (Keyword Type) Design

키워드 유형 선택 → 프리셋 자동 적용 → 분석 실행 UI/UX 설계

## 개요

12개 활용 유형(정치 캠프, PR/위기관리, 기업 평판 등)을 선택하면 최적화된 프리셋(소스, 수집 한도, 토큰 최적화, 분석 모듈)이 자동 적용되어 키워드만 입력하고 바로 분석을 실행할 수 있는 기능.

## 핵심 결정

| 항목             | 결정                                               | 근거                                               |
| ---------------- | -------------------------------------------------- | -------------------------------------------------- |
| UI 흐름          | 2단계: Step 1 유형 선택 → Step 2 트리거 폼         | 12개 유형을 카드로 충분히 표현, 프리셋 가치 극대화 |
| 카드 레이아웃    | 카테고리 탭(3개) + 카드 4개씩                      | 선택 피로 감소, 4개씩 집중 탐색                    |
| 프리셋 적용 방식 | 기본값 자동 적용 + 고급 설정에서 커스터마이즈 가능 | 프리셋은 출발점, 파워유저 경험 유지                |
| 프리셋 관리      | DB + Admin 패널에서 동적 관리                      | 배포 없이 프리셋 튜닝 가능                         |
| DB 저장          | keyword_type + applied_preset 스냅샷(jsonb)        | 과거 실행 이력의 맥락 보존                         |
| 분석 모듈 제어   | 유형별 skippedModules 자동 설정                    | 비용 절감 + 결과 품질 향상, 기존 로직 활용         |

## 데이터 모델

### 신규 테이블: `analysis_presets`

```sql
CREATE TABLE analysis_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- 'politics', 'pr_crisis', 'corporate', ...
  category TEXT NOT NULL,              -- '핵심 활용', '산업 특화', '확장 영역'
  title TEXT NOT NULL,                 -- '정치 캠프'
  description TEXT NOT NULL,           -- 카드에 표시할 설명
  icon TEXT NOT NULL,                  -- lucide 아이콘명 (예: 'Target', 'Shield')
  highlight TEXT,                      -- 카드 하단 하이라이트 텍스트
  sort_order INTEGER NOT NULL DEFAULT 0,
  sources JSONB NOT NULL,              -- { "naver": true, "youtube": true, ... } (기본 5개 소스)
  custom_source_ids JSONB NOT NULL DEFAULT '[]',  -- 커스텀 소스 UUID 배열 (admin/sources에서 등록된 RSS/HTML)
  limits JSONB NOT NULL,               -- { "naverArticles": 500, "youtubeVideos": 50, ... }
  optimization TEXT NOT NULL DEFAULT 'standard',  -- 'none' | 'light' | 'standard' | 'aggressive'
  skipped_modules JSONB NOT NULL DEFAULT '[]',    -- ['winSimulation', 'approvalRating', ...]
  enable_item_analysis BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `collection_jobs` 변경

```sql
ALTER TABLE collection_jobs
  ADD COLUMN keyword_type TEXT,           -- preset slug (nullable, 직접 설정 시 null)
  ADD COLUMN applied_preset JSONB;        -- 실행 시점 프리셋 스냅샷
```

`applied_preset` 스냅샷 구조:

```typescript
interface AppliedPreset {
  slug: string;
  title: string;
  sources: Record<string, boolean>;
  limits: {
    naverArticles: number;
    youtubeVideos: number;
    communityPosts: number;
    commentsPerItem: number;
  };
  optimization: 'none' | 'light' | 'standard' | 'aggressive';
  skippedModules: string[];
  enableItemAnalysis: boolean;
  customized: boolean; // 사용자가 프리셋 값을 변경했는지 여부
}
```

### Drizzle 스키마

```typescript
// packages/core/src/db/schema/presets.ts (신규)
export const analysisPresets = pgTable('analysis_presets', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').unique().notNull(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  highlight: text('highlight'),
  sortOrder: integer('sort_order').notNull().default(0),
  sources: jsonb('sources').notNull().$type<Record<string, boolean>>(),
  customSourceIds: jsonb('custom_source_ids').notNull().$type<string[]>().default([]),
  limits: jsonb('limits').notNull().$type<{
    naverArticles: number;
    youtubeVideos: number;
    communityPosts: number;
    commentsPerItem: number;
  }>(),
  optimization: text('optimization', {
    enum: ['none', 'light', 'standard', 'aggressive'],
  })
    .notNull()
    .default('standard'),
  skippedModules: jsonb('skipped_modules').notNull().$type<string[]>().default([]),
  enableItemAnalysis: boolean('enable_item_analysis').notNull().default(false),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

## 컴포넌트 구조

```
apps/web/src/components/analysis/
├── analysis-launcher.tsx        -- Step 1/2 전환 제어 (신규)
├── preset-selector.tsx          -- Step 1: 카테고리 탭 + 카드 그리드 (신규)
├── preset-card.tsx              -- 개별 유형 카드 (신규)
├── trigger-form.tsx             -- Step 2: 기존 폼 (preset props 추가)
└── trigger-form-data.ts         -- 기존 유지
```

### analysis-launcher.tsx

Step 1/2 전환을 제어하는 래퍼 컴포넌트.

```typescript
interface AnalysisLauncherProps {
  onJobStarted: (jobId: number) => void;
}

// 상태 관리:
// - selectedPreset: AnalysisPreset | null
// - step: 'select' | 'configure'
//
// selectedPreset === null && step === 'select' → PresetSelector 표시
// selectedPreset !== null || step === 'configure' → TriggerForm 표시
// "직접 설정으로 시작" 클릭 → step = 'configure', selectedPreset = null
// "유형 변경" 클릭 → step = 'select', selectedPreset = null
```

### preset-selector.tsx

카테고리 탭 + 카드 4개씩 표시.

- shadcn/ui `Tabs` 사용 (기존 trigger-form의 기간 탭과 동일 패턴)
- 탭: "핵심 활용" | "산업 특화" | "확장 영역"
- 각 탭에 4개 `PresetCard` 그리드 (2x2 또는 1x4)
- 하단: "직접 설정으로 시작" 텍스트 버튼

프리셋 데이터는 `presets.listEnabled` tRPC 쿼리로 로드.

### preset-card.tsx

개별 유형 카드. 클릭 시 `onSelect(preset)` 호출.

표시 정보:

- 아이콘 (lucide)
- 제목 (예: "정치 캠프")
- 설명 (1~2줄)
- 하이라이트 (예: "의사결정 시간 수일 → 수시간")

### trigger-form.tsx 변경

기존 TriggerForm에 `preset` prop 추가:

```typescript
interface TriggerFormProps {
  onJobStarted: (jobId: number) => void;
  preset?: AnalysisPreset | null; // 신규
  onChangePreset?: () => void; // 신규: "유형 변경" 버튼 콜백
}
```

변경 사항:

- `preset`이 있을 경우 상단에 선택된 유형 뱃지 + "유형 변경" 버튼 표시
- `preset`의 값으로 소스/한도/최적화/아이템분석의 초기값 설정
- `skippedModules`를 고급 설정에 표시 (체크박스로 수정 가능)
- 제출 시 `keywordType: preset.slug` 포함

## tRPC API

### Admin용 (protectedProcedure + admin 권한)

```typescript
// apps/web/src/server/trpc/routers/admin/presets.ts (신규)
admin.presets.list       -- 전체 프리셋 목록 (비활성 포함)
admin.presets.create     -- 프리셋 생성
admin.presets.update     -- 프리셋 수정
admin.presets.delete     -- 프리셋 삭제
admin.presets.reorder    -- sort_order 일괄 업데이트
```

### 사용자용 (protectedProcedure)

```typescript
// apps/web/src/server/trpc/routers/presets.ts (신규)
presets.listEnabled      -- 활성 프리셋 목록 (enabled=true, sort_order 순)
```

### analysis.trigger 변경

```typescript
// input 추가
keywordType: z.string().optional();

// 서버 로직
// 1. keywordType이 있으면 DB에서 프리셋 조회
// 2. 프리셋 스냅샷 생성 (applied_preset)
// 3. 사용자 입력값과 프리셋 비교 → customized 플래그 설정
// 4. collection_jobs에 keyword_type + applied_preset 저장
// 5. skippedModules에 프리셋의 스킵 모듈 반영 (사용자 오버라이드 우선)
```

## Admin 프리셋 관리 페이지

**경로**: `/admin/presets`

**UI 구성**: 기존 `/admin/sources` 패턴을 따름

- 프리셋 목록 테이블 (title, category, enabled, sort_order)
- 행 클릭 → 편집 모달/패널
- 편집 폼:
  - 기본 정보: slug, title, description, icon, highlight, category
  - 소스 설정: 체크박스 (기존 trigger-form의 소스 선택과 동일)
  - 수집 한도: 숫자 입력 4개
  - 토큰 최적화: 4단계 선택
  - 분석 모듈 제어: 전체 모듈 목록에서 스킵할 모듈 체크
  - 개별 기사/댓글 감정 분석: 토글
  - 활성/비활성: 토글
- 드래그앤드롭 순서 변경

## 사용자 플로우

### 정상 흐름 (프리셋 사용)

1. 대시보드 → 분석 실행 탭
2. **Step 1**: PresetSelector 표시
3. 카테고리 탭 선택 (기본: "핵심 활용")
4. 유형 카드 클릭 (예: "PR / 위기관리")
5. **Step 2**: TriggerForm 표시 (프리셋 적용됨)
   - 상단: "PR / 위기관리" 뱃지 + "유형 변경" 버튼
   - 소스: 뉴스↑, 커뮤니티 중간 (프리셋 기본값)
   - 한도/최적화: 프리셋 기본값
6. 키워드 입력 + 기간 설정
7. (선택) 고급 설정에서 미세 조정
8. "분석 실행" 클릭
9. `keyword_type` + `applied_preset` 스냅샷과 함께 저장

### 직접 설정 흐름

1. Step 1에서 "직접 설정으로 시작" 클릭
2. 기존 TriggerForm 그대로 표시 (프리셋 미적용)
3. 모든 설정을 수동으로 입력
4. `keyword_type = null`, `applied_preset = null`

### 데모 사용자

- Step 1(프리셋 선택) 건너뜀
- 기존 제한된 폼 그대로 표시

## 시드 데이터

최초 배포 시 12개 기본 프리셋을 시드로 삽입. 기존 `USE_CASE_DETAILS`의 `recommendedSources`, `keyModules` 데이터를 변환하여 활용.

12개 프리셋 slug 목록:

- 핵심 활용: `politics`, `pr_crisis`, `corporate_reputation`, `entertainment`
- 산업 특화: `policy_research`, `finance`, `pharma_healthcare`, `public_sector`
- 확장 영역: `education`, `sports`, `legal`, `franchise_retail`

## 범위 밖 (향후)

- 유형별 리포트 커스터마이징 (유형에 맞는 리포트 섹션/어조 변경)
- 프리셋 사용 통계 (어떤 유형이 가장 많이 선택되는지)
- 사용자별 즐겨찾기 프리셋
- 랜딩 페이지의 USE_CASE_CATEGORIES를 DB 프리셋과 연동
