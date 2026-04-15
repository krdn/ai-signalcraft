# AI 설정 UI 재설계 스펙

**날짜**: 2026-04-15  
**상태**: 승인 대기

---

## Context

현재 AI 설정은 하나의 다이얼로그에 4개 탭(API 키 관리 / 모듈별 모델 / 병렬처리 / 수집 한도)이 나란히 배치되어 있다. 탭 간의 논리적 관계가 드러나지 않고, 항목이 많은 탭(모듈별 모델)은 공간이 부족하며, API 키·병렬처리·수집 한도 탭에는 도움말이 전혀 없다. 이번 재설계의 목표는 설정 흐름을 직관적으로 재구성하고, 모든 섹션에 일관된 도움말을 추가하는 것이다.

---

## 결정 사항

| 항목            | 결정                                                |
| --------------- | --------------------------------------------------- |
| 네비게이션 구조 | 탭 → **사이드바**                                   |
| 섹션 그룹핑     | 역할별 3그룹 (연결 / 분석 설정 / 수집 설정)         |
| 도움말 방식     | `?` 클릭 → **Popover** (모듈 설정 기존 패턴과 일치) |

---

## 아키텍처

### 다이얼로그 구조

```
AISettingsDialog (기존 Dialog 래퍼 재사용)
├── DialogHeader  — "AI 설정" 타이틀 + 마지막 저장 시각
├── DialogBody (flex row)
│   ├── SettingsSidebar  — 사이드바 네비게이션
│   └── SettingsContent  — 현재 섹션 렌더링
└── (각 섹션은 기존 컴포넌트를 그대로 재사용)
```

### 사이드바 섹션 구조

```
[연결]
  🔑 API 키 & 프로바이더    ← provider-keys.tsx (기존)

[분석 설정]
  🤖 모듈별 모델            ← model-settings.tsx (기존)
  ⚡ 병렬처리 & 속도         ← concurrency-settings.tsx (기존)

[수집 설정]
  📦 수집 한도              ← collection-limits-settings.tsx (기존)
```

### 파일 변경 범위

**신규 생성**

- `apps/web/src/components/settings/settings-sidebar.tsx` — 사이드바 네비게이션
- `apps/web/src/components/settings/settings-dialog.tsx` — 새 다이얼로그 쉘

**수정**

- `apps/web/src/components/layout/app-sidebar.tsx` (372번째 줄 근처) — 인라인 탭 다이얼로그를 `<SettingsDialog />` 컴포넌트로 교체
- `apps/web/src/components/settings/provider-keys.tsx` — 도움말 Popover 추가, Playground 기본 접힘 처리
- `apps/web/src/components/settings/concurrency-settings.tsx` — 도움말 Popover 추가
- `apps/web/src/components/settings/collection-limits-settings.tsx` — 도움말 Popover 추가

**변경 없음**

- `model-settings.tsx` — 이미 Popover 도움말 구현됨
- tRPC 라우터, DB 스키마, 서버 로직 — 전혀 건드리지 않음

---

## 컴포넌트 상세 설계

### 1. SettingsSidebar

```tsx
type SidebarSection = {
  groupLabel: string;
  items: {
    id: 'provider-keys' | 'model-settings' | 'concurrency' | 'collection-limits';
    icon: string;
    label: string;
    statusDot?: 'green' | 'amber' | 'none'; // API 키 연결 상태 표시
  }[];
};
```

- 활성 섹션은 왼쪽 3px 파란 border + 파란 텍스트로 강조
- API 키 항목에 연결 상태 dot 표시 (등록된 키가 있으면 green, 없으면 amber)
- 너비: 200px 고정

### 2. SettingsDialog

- 다이얼로그 크기: `max-w-[860px]`, 최소 높이 `min-h-[560px]`
- `activeSection` 상태로 현재 섹션 관리 (기본값: `'provider-keys'`)
- 헤더에 마지막 저장 시각 표시 (기존 각 탭의 저장 버튼 통합 고려)

### 3. 도움말 Popover 패턴 (신규 추가 3개 섹션)

기존 `model-settings.tsx`의 `ModuleHelpPopover` 패턴을 따름:

```tsx
// 각 설정 항목 레이블 옆에 배치
<Label>병렬처리 동시성</Label>
<HelpPopover>
  <p>설명 텍스트</p>
  <div>권장값 / 주의사항</div>
</HelpPopover>
```

**섹션별 도움말 항목**

| 섹션                | 도움말 추가 대상                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------- |
| API 키 & 프로바이더 | 섹션 전체 소개, 각 프로바이더 유형 설명 (직접 API / 프록시 / 로컬), "Test & Select" 버튼 설명 |
| 병렬처리 & 속도     | 섹션 전체 소개, 각 슬라이더 항목 (동시성, 기사 배치, 댓글 배치), RPM 한도 설명                |
| 수집 한도           | 섹션 전체 소개, 각 플랫폼별 한도 항목                                                         |

### 4. API 키 섹션 UX 개선 (도움말 외 추가)

현재 카드마다 Playground 영역이 기본 펼쳐져 있어 스크롤이 길어지는 문제 → Playground를 접힌 상태로 변경 (클릭 시 펼침).

---

## 도움말 콘텐츠 명세

### API 키 & 프로바이더 — 섹션 도움말

> AI 분석에 사용할 프로바이더의 API 키를 등록합니다. **최소 1개 이상 필요**합니다.  
> 키를 등록한 후 **Test & Select**로 연결을 확인하고 기본 모델을 선택하세요.  
> 선택한 모델은 "모듈별 모델" 설정의 기본값으로 사용됩니다.

### API 키 & 프로바이더 — "Test & Select" 도움말

> 입력한 API 키로 실제 연결을 테스트하고, 사용 가능한 모델 목록을 가져옵니다.  
> 선택한 모델이 해당 프로바이더의 **기본 모델**로 저장됩니다.

### 병렬처리 — 섹션 도움말

> 분석 파이프라인의 처리 속도를 조정합니다. 값이 클수록 빠르지만,  
> 프로바이더의 RPM(분당 요청 수) 한도를 초과하면 **429 오류**가 발생합니다.  
> 무료 플랜 사용 시 "느리지만 안전" 프리셋을 권장합니다.

### 병렬처리 — 프로바이더별 동시성 도움말

> 해당 프로바이더에 동시에 보내는 API 요청 수입니다.  
> 유료 플랜 기준 권장값: OpenAI 3~5 / Anthropic 2~4 / Gemini 5~8

### 수집 한도 — 섹션 도움말

> 분석 트리거 시 각 플랫폼에서 수집할 최대 항목 수의 **기본값**입니다.  
> 트리거 실행 폼에서 매번 조정 가능하며, 여기서 설정한 값이 초기값으로 사용됩니다.

---

## 검증 방법

1. **레이아웃**: 다이얼로그 열기 → 사이드바 4개 항목이 그룹별로 표시되는지 확인
2. **네비게이션**: 각 사이드바 항목 클릭 → 해당 섹션으로 전환되는지 확인
3. **연결 상태 dot**: API 키 등록/삭제 후 사이드바 dot 색상 변경 확인
4. **도움말 Popover**: 각 섹션의 `?` 아이콘 클릭 → Popover 표시/숨김 확인
5. **기존 기능 회귀**: API 키 추가/편집/삭제/테스트, 모델 변경, 병렬처리 프리셋 적용, 수집 한도 저장이 모두 정상 동작하는지 확인
6. **반응형**: 다이얼로그가 작은 화면에서도 스크롤 가능한지 확인

---

## 변경하지 않는 것

- tRPC 라우터 및 서버 로직 — 일절 변경 없음
- DB 스키마 — 변경 없음
- 각 설정 탭의 핵심 기능 로직 — 변경 없음 (UI 쉘만 교체)
- `model-settings.tsx` — 이미 완성된 상태이므로 건드리지 않음
