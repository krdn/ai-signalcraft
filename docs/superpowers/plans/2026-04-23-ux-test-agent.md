# UX 테스트 에이전트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI SignalCraft 웹 대시보드의 UI/UX를 자동 테스트하고 문제점을 탐지·수정하는 Claude Code 스킬 (`/ux-test`) 구현

**Architecture:** 4개 에이전트 체인 (Explorer → Analyzer → Reporter → Fixer). Explorer가 Playwright로 스크린샷+DOM을 수집, Analyzer가 Vision+DOM 하이브리드 분석, Reporter가 마크다운 리포트 생성, Fixer가 코드 수정.

**Tech Stack:** Claude Code 스킬 시스템 (.claude/skills/, .claude/agents/), Playwright (브라우저 자동화), Claude Vision (스크린샷 분석)

**Spec:** `docs/superpowers/specs/2026-04-23-ux-test-agent-design.md`

---

## 파일 구조

```
.claude/skills/ux-test/SKILL.md           # 스킬 진입점 (인자 파싱, 에이전트 오케스트레이션)
.claude/skills/ux-test/workflow.md        # 상세 워크플로우 정의
.claude/agents/ux-test-explorer.md        # Explorer 에이전트 정의
.claude/agents/ux-test-analyzer.md        # Analyzer 에이전트 정의
.claude/agents/ux-test-reporter.md        # Reporter 에이전트 정의
.claude/agents/ux-test-fixer.md           # Fixer 에이전트 정의
.ux-test/                                  # 런타임 출력 (gitignore)
```

---

### Task 1: .gitignore + 출력 디렉토리 설정

**Files:**

- Modify: `.gitignore`

- [ ] **Step 1: .gitignore에 .ux-test 추가**

`.gitignore` 파일 끝에 다음 라인 추가:

```
# UX 테스트 에이전트 출력
.ux-test/
```

- [ ] **Step 2: 커밋**

```bash
git add .gitignore
git commit -m "chore: UX 테스트 에이전트 출력 디렉토리 gitignore 추가"
```

---

### Task 2: Explorer 에이전트 정의

**Files:**

- Create: `.claude/agents/ux-test-explorer.md`

- [ ] **Step 1: Explorer 에이전트 파일 생성**

에이전트 정의 파일 작성. 주요 내용:

- Playwright로 chromium 브라우저 실행
- baseUrl(http://localhost:3000)에서 시작
- scope에 따라 라우트 필터링 (public/auth/admin/all)
- 각 페이지에서 fullPage 스크린샷 + viewport 스크린샷 캡처
- page.accessibility.snapshot()으로 A11y 트리 추출
- 인터랙티브 요소(a, button, input 등) 목록 수집
- depth=deep 시 탭 전환 등 인터랙션 후 추가 캡처
- viewport=all 시 mobile/tablet/desktop 각 크기로 반복
- manifest.json에 메타데이터 기록
- 인증 필요 시 env에서 TEST_ACCOUNT_EMAIL/PASSWORD 읽어 로그인
- 라우트는 apps/web/src/app/ 디렉토리 스캔으로 자동 추출

Explorer 에이전트는 Agent 툴로 디스패치되어 독립 실행.

- [ ] **Step 2: 커밋**

```bash
git add .claude/agents/ux-test-explorer.md
git commit -m "feat: UX 테스트 Explorer 에이전트 정의 추가"
```

---

### Task 3: Analyzer 에이전트 정의

**Files:**

- Create: `.claude/agents/ux-test-analyzer.md`

- [ ] **Step 1: Analyzer 에이전트 파일 생성**

에이전트 정의 파일 작성. 주요 내용:

**Vision 분석 (스크린샷 Read → 자동 Vision 처리)**:

- 시각적 결함: 텍스트 깨짐, 이미지 누락, 오버랩, 레이아웃 깨짐, 빈 영역
- 레이아웃: 정렬 불일치, 여백, 반응형, 스크롤 문제
- UX/사용성: CTA 가시성, 정보 계층, 혼잡도, 탐색 흐름, 로딩/에러 상태
- 최신 기법: 스켈레톤 로딩, 마이크로인터랙션, 뷰 전환, 다크모드, Optimistic UI

**DOM/A11y 분석**:

- 기능 결함: 비활성 버튼, 깨진 링크, 폼 라벨 누락, 중복 ID
- 접근성: ARIA 누락, 키보드 탐색, 색 대비, heading 레벨, alt 텍스트
- 구조: 시맨틱 HTML, landmark 역할, 리스트 구조

**결과물**: `.ux-test/pages/{pageName}.analysis.json`

- issues 배열: id, severity(critical/warning/info), category, title, description, evidence, suggestion, file
- suggestions 배열: id, priority, title, description, reference

**심각도 분류**:

- critical: 기능 동작 불가, 데이터 손실, 주요 콘텐츠 누락
- warning: 시각적 결함, UX 저하, 접근성 위반
- info: 사소한 정렬, 일관성 문제

**이슈 ID 접두사**: route 기반 (DASH, SUBS, RPT, ADM, LAND, AUTH 등)

- [ ] **Step 2: 커밋**

```bash
git add .claude/agents/ux-test-analyzer.md
git commit -m "feat: UX 테스트 Analyzer 에이전트 정의 추가"
```

---

### Task 4: Reporter 에이전트 정의

**Files:**

- Create: `.claude/agents/ux-test-reporter.md`

- [ ] **Step 1: Reporter 에이전트 파일 생성**

에이전트 정의 파일 작성. 주요 내용:

- `.ux-test/pages/*.analysis.json` 모두 읽어 취합
- 심각도순 정렬 (Critical → Warning → Info → Suggestion)
- 마크다운 리포트 생성: `.ux-test/reports/YYYY-MM-DD-HHMM-ux-report.md`
- 리포트 구조: 요약 테이블 → Critical 이슈 → Warning → Info → 개선 제안 → 페이지별 요약 → 수정 계획 테이블
- 터미널에 한 줄 요약 출력

- [ ] **Step 2: 커밋**

```bash
git add .claude/agents/ux-test-reporter.md
git commit -m "feat: UX 테스트 Reporter 에이전트 정의 추가"
```

---

### Task 5: Fixer 에이전트 정의

**Files:**

- Create: `.claude/agents/ux-test-fixer.md`

- [ ] **Step 1: Fixer 에이전트 파일 생성**

에이전트 정의 파일 작성. 주요 내용:

- 최신 리포트에서 Critical/Warning 이슈 추출
- auto 모드(--fix): 자동 수정 후 빌드 검증
- confirm 모드(--fix --confirm): 각 이슈 승인 요청 후 수정
- 수정 시 기존 코드 스타일 준수 (shadcn/ui, Tailwind v4, TypeScript)
- 수정 완료 후 `pnpm build` 실행하여 회귀 방지
- 빌드 실패 시 해당 수정을 롤백하고 실패 원인 보고
- `.ux-test/fixes.json`에 수정 로그 기록
- 수정 완료 후 요약 출력 및 재테스트 권장

- [ ] **Step 2: 커밋**

```bash
git add .claude/agents/ux-test-fixer.md
git commit -m "feat: UX 테스트 Fixer 에이전트 정의 추가"
```

---

### Task 6: 스킬 진입점 및 워크플로우 생성

**Files:**

- Create: `.claude/skills/ux-test/SKILL.md`
- Create: `.claude/skills/ux-test/workflow.md`

- [ ] **Step 1: SKILL.md 생성**

스킬 진입점 파일. YAML frontmatter에 name, description, argument-hint, allowed-tools 설정.
본문에 objective(탐지 영역 설명)와 process(workflow.md 참조) 포함.

argument-hint: `[/route] [--scope public|auth|admin|all] [--depth quick|standard|deep] [--viewport mobile|tablet|desktop|all] [--fix] [--fix --confirm] [--no-fix]`

allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, Task

- [ ] **Step 2: workflow.md 생성**

워크플로우 상세 정의:

**인자 파싱 테이블**:
| 인자 | 기본값 | 설명 |
|------|--------|------|
| /route | 없음 | 특정 페이지만 |
| --scope | all | public/auth/admin/all |
| --depth | standard | quick/standard/deep |
| --viewport | desktop | mobile/tablet/desktop/all |
| --fix | 없음 | Critical/Warning 자동 수정 |
| --fix --confirm | 없음 | 수정 전 승인 요청 |

**실행 절차 (5 Phase)**:

1. Phase 1 - 사전 준비: 개발 서버 확인, Playwright 설치, .ux-test 초기화
2. Phase 2 - Explorer: Agent 툴로 직렬 디스패치, manifest.json 생성
3. Phase 3 - Analyzer: 페이지별 Agent 병렬 디스패치 (최대 3개 동시)
4. Phase 4 - Reporter: 취합 후 마크다운 리포트 생성
5. Phase 5 - Fixer: --fix 옵션 시에만 실행, 코드 수정 + 빌드 검증

- [ ] **Step 3: 커밋**

```bash
git add .claude/skills/ux-test/SKILL.md .claude/skills/ux-test/workflow.md
git commit -m "feat: UX 테스트 스킬 진입점 및 워크플로우 추가"
```

---

### Task 7: 통합 검증

- [ ] **Step 1: 파일 구조 확인**

```bash
ls -la .claude/skills/ux-test/SKILL.md .claude/skills/ux-test/workflow.md \
       .claude/agents/ux-test-explorer.md .claude/agents/ux-test-analyzer.md \
       .claude/agents/ux-test-reporter.md .claude/agents/ux-test-fixer.md
```

6개 파일 모두 존재해야 함.

- [ ] **Step 2: frontmatter 유효성 확인**

각 파일의 YAML frontmatter에 name, description 필드가 있는지 확인.

- [ ] **Step 3: .gitignore 확인**

`.ux-test/`가 .gitignore에 포함되어 있는지 확인.

- [ ] **Step 4: 최종 커밋**

```bash
git status
# 변경사항 없으면 스킵, 있으면 커밋
```

---

## Spec Coverage 매핑

| Spec 섹션                                   | Task     |
| ------------------------------------------- | -------- |
| 아키텍처 (Explorer/Analyzer/Reporter/Fixer) | Task 2-6 |
| 스킬 인터페이스 (인자, 옵션)                | Task 6   |
| Explorer 상세 (탐색 전략, manifest)         | Task 2   |
| Analyzer 상세 (Vision+DOM, 심각도)          | Task 3   |
| Reporter 상세 (리포트 구조)                 | Task 4   |
| Fixer 상세 (수정 흐름, 안전장치)            | Task 5   |
| 파일 구성                                   | Task 6   |
| 설정 파일 (env 기반)                        | Task 2   |
| .gitignore                                  | Task 1   |
