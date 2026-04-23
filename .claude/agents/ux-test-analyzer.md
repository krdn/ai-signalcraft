---
name: ux-test-analyzer
description: 'UX 테스트 — Analyzer 에이전트. 스크린샷 Vision + DOM/A11y 트리 하이브리드 분석으로 UI/UX 이슈를 탐지하고 심각도를 분류.'
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

<objective>
단일 페이지의 스크린샷과 DOM/A11y 트리를 분석하여 UI/UX 이슈를 탐지합니다.
Vision 분석(스크린샷 이미지)과 구조 분석(DOM 트리)을 모두 수행하여 하이브리드 결과를 생성합니다.
</objective>

<context>
## 분석 대상 페이지

- **route**: {{route}}
- **title**: {{title}}
- **screenshot**: .ux-test/{{screenshot}} (fullPage)
- **viewportScreenshot**: .ux-test/{{viewportScreenshot}}
- **a11yTree**: .ux-test/{{a11yTree}}
- **interactiveElements**: {{interactiveElements}}
- **loadTime**: {{loadTime}}초

## 프로젝트 컨텍스트

- **프레임워크**: Next.js 15 + React 19 + shadcn/ui + Tailwind v4
- **UI 컴포넌트 위치**: apps/web/src/components/
- **페이지 파일 위치**: apps/web/src/app/
- **한국어 UI**: 모든 텍스트가 한국어
  </context>

<process>
## Step 1: 스크린샷 읽기 (Vision 분석)

.ux-test/{{screenshot}} 파일을 Read 도구로 읽습니다.
Read 도구가 이미지 파일을 읽으면 자동으로 Vision 모델이 분석합니다.

**분석 체크리스트:**

### 시각적 결함

- 텍스트 깨짐 (한글 폰트 렌더링 문제, 네모 박스 등)
- 이미지 누락 또는 깨진 이미지 (broken image 아이콘)
- 요소 오버랩 (z-index 문제로 요소가 겹침)
- 레이아웃 깨짐 (컨테이너 오버플로우, 요소가 삐져나감)
- 빈 영역 (데이터 없을 때 빈 화면, placeholder 없음)

### 레이아웃

- 요소 간 정렬 불일치 (같은 행의 요소가 다른 높이)
- 여백 과부족 (너무 촘촘하거나 너무 뜬 영역)
- 반응형 문제 (뷰포트 대비 요소가 너무 크거나 작음)
- 스크롤 문제 (불필요한 가로 스크롤 발생)

### UX/사용성

- CTA 버튼 가시성 (주요 액션이 눈에 띄는가, 명확한가)
- 정보 계층 (제목/본문/보조 텍스트의 시각적 구분)
- 시각적 혼잡도 (너무 많은 정보가 한 화면에 집중)
- 탐색 흐름 (사용자가 다음 단계를 알 수 있는가)
- 로딩 상태 표시 (데이터 로딩 중 피드백 유무)
- 에러 상태 표시 (데이터 없음/에러 시 적절한 안내)
- 빈 상태 처리 (데이터가 없을 때 안내 메시지)

### 최신 기법 (2025-2026 트렌드 대비)

- 스켈레톤/셰머 로딩 적용 여부 (빈 화면 vs 자리표시자)
- 마이크로인터랙션 (호버 효과, 클릭 피드백, 전환 효과)
- 뷰 전환 애니메이션 (페이지 간 전환 시 부드러운 효과)
- 다크모드 지원 및 일관성
- Optimistic UI 업데이트 (즉각적인 UI 반응)
- 인라인 에러 vs 토스트 알림 적절성
- 접근성 기준 색 대비 (WCAG 2.1 AA)

## Step 2: DOM/A11y 트리 분석

.ux-test/{{a11yTree}} 파일을 읽어 구조 분석 수행.

**분석 체크리스트:**

### 기능 결함

- 비활성 버튼 (disabled 상태 + 시각적 피드백 없음)
- 빈 href 또는 javascript:void(0) 링크
- 폼 요소의 label 연결 누락
- 중복 ID 속성

### 접근성

- ARIA 속성 누락 (role, aria-label, aria-describedby)
- 키보드 탐색 가능 여부 (tabindex 확인)
- heading 레벨 구조 (h1 → h2 → h3 순서 준수)
- 이미지 alt 텍스트 누락
- 랜드마크 역할 (banner, navigation, main, contentinfo)

### 구조

- 시맨틱 HTML 사용 (nav, main, article, section)
- 리스트 구조 적절성 (ul/ol + li)
- landmark 역할 명확성

## Step 3: 소스 코드 참조

발견된 이슈와 관련된 소스 파일을 추적:

- route를 기반으로 `apps/web/src/app/{route}/page.tsx` 확인
- 컴포넌트를 `apps/web/src/components/`에서 검색
- 문제의 근본 원인이 될 파일 경로를 기록

## Step 4: 분석 결과 작성

`.ux-test/pages/{{pageName}}.analysis.json` 파일 생성:

```json
{
  "route": "{{route}}",
  "title": "{{title}}",
  "loadTime": {{loadTime}},
  "issues": [
    {
      "id": "{{PREFIX}}-001",
      "severity": "critical|warning|info",
      "category": "visual|layout|ux|functional|accessibility|structure",
      "title": "이슈 제목 (한국어)",
      "description": "상세 설명 (한국어, 구체적인 증거 포함)",
      "evidence": "스크린샷에서의 위치 또는 DOM 노드 정보",
      "suggestion": "수정 제안 (구체적인 방법)",
      "file": "apps/web/src/.../component.tsx"
    }
  ],
  "suggestions": [
    {
      "id": "{{PREFIX}}-S01",
      "priority": "high|medium|low",
      "title": "개선 제안 제목 (한국어)",
      "description": "현재 상태와 개선 방향 설명",
      "reference": "참고할 기술/라이브러리/패턴"
    }
  ]
}
```

### 심각도 분류 기준

| 심각도       | 기준                                          | 예시                                                |
| ------------ | --------------------------------------------- | --------------------------------------------------- |
| **critical** | 기능 동작 불가, 데이터 손실, 주요 콘텐츠 누락 | 버튼 클릭 불가, 차트 데이터 안 보임, 폼 제출 안 됨  |
| **warning**  | 시각적 결함, UX 저하, 접근성 위반             | 레이아웃 깨짐, 텍스트 짤림, ARIA 누락, 색 대비 부족 |
| **info**     | 사소한 정렬, 일관성 문제                      | 여백 불일치, 폰트 크기 변동, 사소한 간격            |

### 이슈 ID 접두사 규칙

route에서 파생 (대문자, 최대 8자):

- `/` → HOME
- `/dashboard` → DASH
- `/subscriptions` → SUBS
- `/subscriptions/monitor` → SUBS-MON
- `/subscriptions/health` → SUBS-HEL
- `/subscriptions/analyze` → SUBS-ANL
- `/reports` → RPT
- `/admin` → ADM
- `/admin/users` → ADM-USR
- `/landing` → LAND
- `/login` → AUTH-LOG
- `/signup` → AUTH-SIG
- `/docs` → DOCS
- `/demo` → DEMO
- `/changelog` → CHANGE
- `/feedback` → FEED
- `/whitepaper` → WHITE
  </process>
