# 문서 허브(Docs Hub) 설계

**날짜**: 2026-04-16  
**상태**: 승인됨  
**대상**: 영업 / 마케팅 / 기술 담당자

---

## Context

AI SignalCraft의 `docs/` 폴더에 영업·마케팅·기술 문서가 평탄하게 혼재되어 있어 담당자별로 필요한 문서를 찾기 어렵다. 문서는 앞으로도 지속적으로 추가될 예정이므로, 파일만 추가하면 자동으로 반영되는 확장 가능한 통합 문서 허브가 필요하다.

**목표:**

- `docs/` 폴더를 역할별 카테고리로 재편
- 웹 앱 `/docs` 페이지에서 사이드바 + 마크다운 렌더링으로 조회
- 신규 문서·카테고리 추가 시 코드 변경 없이 자동 반영

---

## 1. docs/ 폴더 구조

### 카테고리 구조

```
docs/
├── sales/                    # 영업 담당자
│   ├── _category.json
│   ├── gtm-strategy.md
│   ├── cold-email-templates.md
│   └── pitch-deck.md
├── marketing/                # 마케팅 담당자
│   ├── _category.json
│   ├── deep-research-report.md
│   └── ai-analysis-kit-upgrade.md
├── technical/                # 기술 담당자
│   ├── _category.json
│   ├── tech-stack.md
│   ├── analysis-workflow.md
│   ├── llm-model-recommendations.md
│   └── prompt.md
└── general/                  # 전체 공통
    ├── _category.json
    └── ai-signalcraft.md
```

### `_category.json` 형식

```json
{
  "label": "영업",
  "icon": "briefcase",
  "order": 1
}
```

- `label`: 사이드바에 표시될 카테고리명
- `icon`: lucide-react 아이콘명 (선택)
- `order`: 사이드바 정렬 순서

### 문서 frontmatter 규칙

```yaml
---
title: 'GTM 전략'
description: 'Go-to-Market 전략 문서'
order: 1
tags: [전략, 영업]
---
```

- `title`: 필수 — 사이드바·페이지 제목
- `description`: 선택 — 문서 요약
- `order`: 카테고리 내 정렬 순서
- `tags`: 선택 — 향후 검색·필터용

### 폴백 규칙

| 상황                       | 동작                           |
| -------------------------- | ------------------------------ |
| frontmatter 없는 파일      | 파일명을 title로 사용          |
| `_category.json` 없는 폴더 | 폴더명을 label로, order 마지막 |
| 존재하지 않는 slug         | Next.js `notFound()` 반환      |

---

## 2. 확장 방법

| 작업               | 필요한 조치                            |
| ------------------ | -------------------------------------- |
| 새 문서 추가       | `.md` 파일을 해당 카테고리 폴더에 추가 |
| 새 카테고리 추가   | 폴더 생성 + `_category.json` 추가      |
| 문서 순서 변경     | frontmatter `order` 값 수정            |
| 카테고리 이름 변경 | `_category.json`의 `label` 수정        |

---

## 3. 웹 앱 라우트 구조

```
apps/web/src/app/docs/
├── layout.tsx              # 사이드바 포함 레이아웃
├── page.tsx                # /docs → 첫 문서로 리다이렉트
└── [category]/
    └── [slug]/
        └── page.tsx        # 마크다운 렌더링 페이지
```

---

## 4. 주요 파일

```
apps/web/src/
├── lib/
│   └── docs.ts             # 문서 스캔/파싱 유틸리티
└── components/docs/
    ├── sidebar.tsx          # 사이드바 컴포넌트
    ├── doc-content.tsx      # 마크다운 콘텐츠 영역
    └── doc-nav.tsx          # 이전/다음 네비게이션
```

### `lib/docs.ts` 핵심 함수

```typescript
getAllCategories(); // _category.json 스캔, order 정렬
getDocsByCategory(category); // 해당 폴더 .md 스캔, frontmatter 파싱
getDoc(category, slug); // 단일 문서 내용 반환
getSidebarTree(); // 전체 사이드바 트리 반환
```

---

## 5. 기술 스택

```bash
pnpm add next-mdx-remote gray-matter
```

| 라이브러리                | 용도                                      |
| ------------------------- | ----------------------------------------- |
| `next-mdx-remote/rsc`     | 서버 컴포넌트에서 마크다운 컴파일·렌더링  |
| `gray-matter`             | frontmatter 파싱                          |
| `@tailwindcss/typography` | prose 스타일 (이미 설치됨 여부 확인 필요) |

**데이터 흐름:**

```
서버 컴포넌트 (page.tsx)
  → fs.readdir(docs/[category]/)
  → gray-matter로 frontmatter 파싱
  → compileMDX로 마크다운 렌더링
  → 클라이언트에 HTML 전달
```

---

## 6. UI/UX

### 레이아웃

```
┌─────────────────────────────────────────────┐
│  상단 네비게이션 (기존 앱 헤더)              │
├──────────────┬──────────────────────────────┤
│              │                              │
│  사이드바     │  문서 콘텐츠                 │
│  (240px)     │                              │
│              │  # 문서 제목                 │
│  📁 영업     │                              │
│    GTM 전략  │  본문 마크다운 렌더링...      │
│    이메일 ◀  │                              │
│    피치 덱   │                              │
│              │  ────────────────────        │
│  📁 마케팅   │  ← 이전 문서   다음 문서 →   │
│  📁 기술     │                              │
│  📁 공통     │                              │
│              │                              │
└──────────────┴──────────────────────────────┘
```

### 사이드바 동작

- 현재 문서 하이라이트 (배경색 + 볼드)
- 카테고리 접기/펼치기 (기본: 모두 펼침)
- 모바일: 사이드바 숨김 + 햄버거 메뉴

### shadcn/ui 컴포넌트

| 컴포넌트     | 용도                   |
| ------------ | ---------------------- |
| `ScrollArea` | 사이드바 스크롤        |
| `Separator`  | 카테고리 구분선        |
| `Badge`      | 문서 태그 표시 (향후)  |
| `Sheet`      | 모바일 사이드바 드로어 |

---

## 7. 검증 방법

1. `docs/` 폴더 재구성 후 기존 파일 접근 가능 여부 확인
2. `/docs` 진입 시 첫 문서로 정상 리다이렉트
3. 사이드바에 모든 카테고리·문서 표시
4. 마크다운 렌더링 (코드 블록, 테이블, 이미지) 정상 출력
5. 새 `.md` 파일 추가 후 사이드바 자동 반영 확인
6. 모바일 레이아웃 확인
7. 존재하지 않는 경로 접근 시 404 처리 확인
