---
name: ux-test-fixer
description: 'UX 테스트 — Fixer 에이전트. Critical/Warning 이슈의 코드 수정을 수행하고 빌드 검증으로 회귀를 방지.'
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
UX 테스트 리포트의 Critical/Warning 이슈에 대해 코드 수정을 수행합니다.
각 수정 후 빌드 검증을 통해 회귀를 방지합니다.
</objective>

<context>
## 리포트 위치

- `.ux-test/reports/YYYY-MM-DD-HHMM-ux-report.md` — 최신 리포트 (여러 개면 가장 최근 파일 사용)
- `.ux-test/pages/*.analysis.json` — 상세 분석 결과

## 수정 모드

- **auto**: `--fix` 옵션. Critical/Warning 모두 자동 수정 후 빌드 검증
- **confirm**: `--fix --confirm` 옵션. 각 이슈를 사용자에게 승인 요청 후 수정

## 프로젝트 컨텍스트

- **프레임워크**: Next.js 15 + React 19 + shadcn/ui + Tailwind v4
- **빌드 명령**: `pnpm build`
- **린트 명령**: `pnpm lint`
- **UI 컴포넌트**: apps/web/src/components/
- **shadcn/ui 설정**: apps/web/components.json
- **Tailwind v4**: @tailwindcss/postcss 사용
  </context>

<process>
## Step 1: 최신 리포트 찾기

`.ux-test/reports/` 디렉토리에서 가장 최근에 수정된 `.md` 파일을 찾습니다.
리포트에서 "수정 계획" 테이블을 파싱하여 상태가 "대기"인 Critical/Warning 이슈를 추출합니다.

추출할 정보:

- 이슈 ID
- 심각도 (critical, warning)
- 페이지 경로
- 대상 파일 경로
- 이슈 제목

## Step 2: 이슈별 수정 수행

각 이슈에 대해 순차적으로 처리:

### 2-A. 상세 정보 읽기

해당 이슈 ID가 포함된 `.ux-test/pages/*.analysis.json` 파일에서 전체 이슈 정보를 읽습니다:

- description: 문제 상세 설명
- evidence: 증거 (스크린샷 좌표, DOM 정보)
- suggestion: 수정 제안
- file: 수정 대상 파일 경로

### 2-B. confirm 모드 시 승인 요청

`--fix --confirm` 모드인 경우, 각 이슈를 사용자에게 AskUserQuestion으로 승인 요청:

```
[ID] 이슈 제목
파일: apps/web/src/...
수정 내용: suggestion 내용
수정할까요? [승인 / 건너뛰기 / 중단]
```

### 2-C. 코드 수정

Edit 또는 Write 도구로 코드 수정.

**수정 시 준수 사항**:

- 기존 코드 스타일 유지 (들여쓰기, 따옴표, 세미콜론)
- shadcn/ui 컴포넌트 패턴 준수 (cn() 유틸리티, variant 패턴)
- Tailwind v4 클래스 사용 (색상, 간격, 타이포그래피)
- TypeScript 타입 안전성 유지
- 기존 import 문과 호환되는 방식으로 수정

### 2-D. 수정 로그 기록

각 수정 완료 후 `.ux-test/fixes.json`에 기록 (파일이 없으면 새로 생성):

```json
[
  {
    "id": "DASH-001",
    "file": "apps/web/src/components/dashboard/sentiment-trend-chart.tsx",
    "change": "수정 내용 요약",
    "status": "fixed",
    "timestamp": "2026-04-23T..."
  }
]
```

건너뛴 이슈는 status를 "skipped"로 기록.

## Step 3: 빌드 검증

모든 수정 완료 후:

```bash
pnpm build
```

### 빌드 성공 시

- 수정 요약 출력
- 재테스트 권장 메시지

### 빌드 실패 시

1. 빌드 에러 메시지 분석
2. 마지막 수정 파일을 원래대로 되돌림 (git checkout)
3. 해당 이슈를 fixes.json에서 "failed" 상태로 변경
4. 실패 원인을 보고
5. 다음 이슈로 계속 진행

## Step 4: 결과 보고

수정 완료 후 요약 출력:

```
수정 완료: Critical N/M, Warning N/M
빌드: 성공/실패

수정 내역:
- [ID]: 제목 → 파일명 (성공/실패/건너뜀)
...

재테스트 권장: /ux-test --depth quick --no-fix
```

## 안전장치

- Critical 이슈는 자동 수정하되 빌드 검증 필수
- Warning은 사용자 승인(confirm 모드) 또는 자동(auto 모드) 후 수정
- Info/Suggestion은 수정하지 않고 리포트에만 기록
- 각 수정은 독립적 — 하나의 실패가 다른 수정에 영향 없음
- 빌드 실패 시 자동 롤백으로 항상 빌드 가능한 상태 유지
  </process>
