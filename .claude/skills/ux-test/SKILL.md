---
name: ux-test
description: 'AI SignalCraft 웹 대시보드 UI/UX 자동 테스트. Playwright 기반 에이전트 체인으로 기능 결함, 시각/레이아웃 문제, UX/사용성, 최신 기법 제안을 탐지하고 수정.'
argument-hint: '[/route] [--scope public|auth|admin|all] [--depth quick|standard|deep] [--viewport mobile|tablet|desktop|all] [--fix] [--fix --confirm] [--no-fix]'
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
  - Task
---

<objective>
AI SignalCraft 웹 대시보드의 UI/UX를 자동 테스트합니다.
4개 에이전트 체인(Explorer → Analyzer → Reporter → Fixer)으로 동작합니다.

**탐지 영역**:

- 기능적 결함 (비활성 버튼, 깨진 링크, 폼 검증 누락)
- 시각적/레이아웃 문제 (레이아웃 깨짐, 정렬, 반응형)
- UX/사용성 문제 (탐색 흐름, CTA 가시성, 로딩/에러 상태)
- 최신 기법 제안 (스켈레톤 로딩, 마이크로인터랙션, 애니메이션)
  </objective>

<context>
$ARGUMENTS
</context>

<process>
@.claude/skills/ux-test/workflow.md 파일의 절차를 따라 실행하세요.
</process>
