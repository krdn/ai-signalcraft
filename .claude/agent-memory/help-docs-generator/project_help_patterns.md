---
name: 프로젝트 도움말 패턴 및 컨벤션
description: AI SignalCraft 웹앱의 3가지 도움말 UI 패턴, 사용 기준, 추출된 공용 컴포넌트 위치
type: project
---

## 3가지 도움말 패턴

### 1. Collapsible 페이지 가이드 (page-level guide)

- **적합한 상황**: 페이지 처음 진입 시 전체 흐름 설명이 필요한 경우
- **컴포넌트**: `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` (shadcn/ui)
- **트리거 스타일**: `HelpCircle` 아이콘 + "사용 가이드" 텍스트 + `ChevronDown` (rotate on open)
- **위치**: `<h1>` 헤더 바로 아래, `className="mt-3"` on the `<Collapsible>`
- **구조**: 개요 설명 → `Separator` → 단계별 `Badge` 번호 → 팁 박스 (`bg-muted/50 p-2.5`)
- **벤치마크**: `trigger-form-help.tsx` (7탭, 최고 품질 레퍼런스)
- **적용 사례**: `subscription-analyze-content.tsx`, `subscriptions/page.tsx`, `subscriptions/monitor/page.tsx`

### 2. InfoHint (hover-card label hint)

- **적합한 상황**: 폼 라벨 옆 ⓘ 아이콘, 마우스 오버로 간단 설명
- **컴포넌트**: `apps/web/src/components/ui/info-hint.tsx` (공용 추출 완료)
- **구현**: Base UI `@base-ui/react/preview-card` 기반 HoverCard
- **주의**: `openDelay`/`closeDelay`/`asChild` 미지원. `side`/`align`/`sideOffset` 지원
- **금지**: Dialog 내부, 모바일 환경에서 사용 금지 (hover 불가) → HelpPopover 사용
- **적용 사례**: `analysis-config-step.tsx` (4개 필드)
- **내용 분량**: 10줄 이하 권장

### 3. HelpPopover (click-based label hint)

- **적합한 상황**: Dialog 내부 폼, 모바일 친화적 환경, click 방식이 필요할 때
- **컴포넌트**: `apps/web/src/components/settings/help-popover.tsx`
- **props**: `children`, `side?` (기본 right), `className?`
- **적용 사례**: `subscription-form.tsx` (3개 필드: 프리셋, 빈도, maxPerRun, 댓글수), `concurrency-settings.tsx`, `collection-limits-settings.tsx`

## 결정 기준 요약

| 상황                                  | 패턴                                              |
| ------------------------------------- | ------------------------------------------------- |
| 페이지 첫 진입, 흐름 안내             | Collapsible 페이지 가이드                         |
| 라벨 옆 힌트, 데스크톱 전용 폼        | InfoHint (hover)                                  |
| 라벨 옆 힌트, Dialog 내부 또는 모바일 | HelpPopover (click)                               |
| 복잡한 카드/대시보드 지표 해설        | CardHelp (탭 Popover) → `dashboard/card-help.tsx` |

**Why:** Dialog z-index 문제 방지 + 터치 환경 호환성. HoverCard는 터치 기기에서 트리거되지 않아 정보에 접근 불가.

**How to apply:** subscription-form.tsx처럼 Dialog에서 열리는 폼에는 항상 HelpPopover 선택.
