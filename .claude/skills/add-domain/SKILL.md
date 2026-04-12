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
</objective>

<context>
$ARGUMENTS
</context>

<process>
@.claude/skills/add-domain/workflow.md 파일의 절차를 따라 실행하세요.
</process>
