---
name: add-domain
description: "AI SignalCraft 분석 도메인 추가 또는 기존 도메인 갱신. 새 분석 유형 추가, 모듈 변경 시 코어+프론트엔드 전체 동기화."
argument-hint: "[--id <domain-id>] [--name <표시명>] [--tier <1|2|3>] [--update <domain-id>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
AI SignalCraft 프로젝트에서 새로운 분석 도메인을 추가하거나, 기존 도메인의 변경 사항을 전체 시스템에 동기화합니다.

세계 표준 학술 이론을 기반으로 DomainConfig, Stage 4 모듈, Zod 스키마, UI 컴포넌트를 자동 생성합니다.

**신규 추가 모드:** `--id`, `--name`, `--tier` 인자로 새 도메인 전체 구현
**갱신 모드:** `--update <domain-id>` 로 기존 도메인의 모듈 변경사항을 프론트엔드까지 동기화

## domain-id 기준

`--id` / `--update` 인자는 **도메인 ID** (`AnalysisDomain` 타입 값)를 사용합니다.
프리셋 슬러그(`corporate_reputation`)와 다릅니다.

지원 도메인 ID 목록:
`political` | `fandom` | `pr` | `corporate` | `policy`
`finance` | `healthcare` | `public-sector` | `education`
`sports` | `legal` | `retail`

예시:
- `/add-domain --update corporate` → 기업 평판 관리 도메인 갱신
- `/add-domain --update finance` → 금융/투자 도메인 갱신
- `/add-domain --id gaming --name "게임/e스포츠" --tier 2` → 신규 도메인 추가
</objective>

<context>
$ARGUMENTS
</context>

<process>
@.claude/skills/add-domain/workflow.md 파일의 절차를 따라 실행하세요.
</process>
