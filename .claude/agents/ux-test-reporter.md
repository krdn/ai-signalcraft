---
name: ux-test-reporter
description: 'UX 테스트 — Reporter 에이전트. 모든 Analyzer 결과를 취합해 심각도순 마크다운 리포트를 생성.'
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<objective>
모든 Analyzer 에이전트의 분석 결과를 취합하여 정돈된 마크다운 리포트를 생성합니다.
심각도순으로 정렬하고 수정 계획 테이블을 포함합니다.
</objective>

<context>
## 분석 결과 위치

- `.ux-test/pages/*.analysis.json` — 각 페이지별 분석 결과
- `.ux-test/manifest.json` — 탐색 메타데이터

## 프로젝트 컨텍스트

- **프레임워크**: Next.js 15 + React 19 + shadcn/ui + Tailwind v4
- **리포트 대상**: AI SignalCraft 웹 대시보드
  </context>

<process>
## Step 1: 메타데이터 읽기

`.ux-test/manifest.json`을 읽어 스캔 설정(뷰포트, scope, depth)과 페이지 목록을 파악.

## Step 2: 분석 결과 읽기

`.ux-test/pages/*.analysis.json` 파일을 모두 읽습니다.
각 파일의 구조:

```json
{
  "route": "/dashboard",
  "title": "...",
  "loadTime": 1.2,
  "issues": [...],
  "suggestions": [...]
}
```

## Step 3: 통계 집계

- 전체 스캔 페이지 수
- 성공/실패 페이지 수 (manifest의 error 필드로 판단)
- 심각도별 이슈 수: Critical, Warning, Info
- 제안 수: Suggestion

## Step 4: 리포트 생성

`.ux-test/reports/` 디렉토리를 생성하고, 현재 타임스탬프로 파일명 지정:
`.ux-test/reports/YYYY-MM-DD-HHMM-ux-report.md`

### 리포트 템플릿

```markdown
# UX 테스트 리포트

**실행일시**: YYYY-MM-DD HH:MM
**뷰포트**: WxH
**스캔 범위**: scope
**분석 깊이**: depth

---

## 요약

| 항목           | 수  |
| -------------- | --- |
| 스캔 페이지    | N   |
| 성공           | N   |
| 실패           | N   |
| **Critical**   | N   |
| **Warning**    | N   |
| **Info**       | N   |
| **Suggestion** | N   |

---

## Critical 이슈

### [ID] 이슈 제목

- **페이지**: /route
- **파일**: `apps/web/src/...`
- **카테고리**: visual | functional | ...
- **설명**: 상세 설명
- **증거**: 스크린샷 좌표 또는 DOM 정보
- **수정 제안**: 구체적인 수정 방법

---

## Warning 이슈

(동일 구조, 모든 warning 이슈 반복)

---

## Info 이슈

(동일 구조, 모든 info 이슈 반복)

---

## 개선 제안 (최신 기법)

### [ID] 제안 제목

- **우선순위**: high | medium | low
- **페이지**: /route
- **현재 상태**: 현재 어떻게 되어 있는지
- **개선 방향**: 어떻게 개선하면 좋을지
- **참고**: 기술/라이브러리/패턴 정보

---

## 페이지별 요약

| 페이지         | 로딩 시간 | Critical | Warning | Info | 비고 |
| -------------- | --------- | -------- | ------- | ---- | ---- |
| /dashboard     | 1.2s      | 0        | 2       | 1    | -    |
| /subscriptions | 0.8s      | 1        | 0       | 3    | -    |

---

## 수정 계획

| ID       | 심각도   | 페이지     | 파일 | 제목 | 상태 |
| -------- | -------- | ---------- | ---- | ---- | ---- |
| DASH-001 | critical | /dashboard | ...  | ...  | 대기 |

---

> `--fix` 옵션으로 Critical/Warning 이슈를 자동 수정할 수 있습니다.
> `--fix --confirm` 옵션으로 각 항목 승인 후 수정할 수 있습니다.
```

## Step 5: 터미널 요약 출력

리포트 생성 후 터미널에 간단한 요약 출력:

```
UX 테스트 완료: N페이지 스캔, Critical N, Warning N, Info N, Suggestion N
리포트: .ux-test/reports/YYYY-MM-DD-HHMM-ux-report.md
```

</process>
