---
name: 도움말 커버리지 현황
description: AI SignalCraft 웹앱 화면별 도움말 적용 여부 스캔 결과 (2026-05-03)
type: project
---

## 도움말 커버리지 현황 (2026-05-03 기준)

### 완료 (covered)

| 화면/컴포넌트                                               | 적용된 패턴                     | 비고                         |
| ----------------------------------------------------------- | ------------------------------- | ---------------------------- |
| `app/subscriptions/analyze/`                                | Collapsible 페이지 가이드       | 4단계 wizard 안내            |
| `components/subscriptions/analyze/analysis-config-step.tsx` | InfoHint (4개 필드)             | 기간/도메인/최적화/구독 선택 |
| `app/subscriptions/page.tsx`                                | Collapsible 페이지 가이드       | 빠른 시작 3단계              |
| `app/subscriptions/monitor/page.tsx`                        | Collapsible 페이지 가이드       | 화면 구성 + 문제 대응        |
| `components/subscriptions/subscription-form.tsx`            | HelpPopover (4개 필드)          | 프리셋/빈도/maxPerRun/댓글수 |
| `components/analysis/trigger-form-help.tsx`                 | Collapsible + 7탭               | 벤치마크 레퍼런스            |
| `components/manipulation/manipulation-help.tsx`             | Accordion (7신호)               | 조작 분석 원리 완비          |
| `components/dashboard/card-help.tsx`                        | CardHelp (11개 지표)            | 대시보드 전체 커버           |
| `components/settings/model-settings.tsx`                    | HelpPopover + ModuleHelpPopover | 설정 완비                    |
| `components/settings/concurrency-settings.tsx`              | HelpPopover                     | 설정 완비                    |
| `components/settings/collection-limits-settings.tsx`        | HelpPopover                     | 설정 완비                    |

### 의도적 미적용 (skipped)

| 화면                                            | 이유                              |
| ----------------------------------------------- | --------------------------------- |
| `app/subscriptions/health/page.tsx`             | 지표 이름이 직관적, 우선순위 낮음 |
| `app/subscriptions/[id]/page.tsx` (탭 컨테이너) | 각 탭 내용이 자체 도움말 보유     |
| `app/dashboard/`                                | CardHelp로 완전 커버              |

## 공용 컴포넌트 위치

- `apps/web/src/components/ui/info-hint.tsx` — InfoHint (hover, 2026-05-03 추출)
- `apps/web/src/components/settings/help-popover.tsx` — HelpPopover (click, 기존)
- `apps/web/src/components/dashboard/card-help.tsx` — CardHelp (탭 Popover, 기존)
