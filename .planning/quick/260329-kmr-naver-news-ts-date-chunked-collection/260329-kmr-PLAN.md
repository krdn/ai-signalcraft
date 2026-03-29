# Quick Task 260329-kmr: 하이브리드 날짜 분할 수집 구현

## 목표
네이버 뉴스 수집 시 최신순 편중을 방지하기 위해 기간을 일별로 분할하여 균등 수집.
기본 수집 상한을 100 → 500으로 변경.

## Tasks

### Task 1: naver-news.ts 날짜 분할 수집 로직
- collect() Phase 1을 날짜별 분할 루프로 변경
- splitIntoDays() private 메서드 추가
- config: defaultMaxItems 100→500, maxSearchPages 40→100

### Task 2: 기본값 변경
- flows.ts: naverArticles 100→500
- types/index.ts: z.number().default(100)→default(500)

### Task 3: UI 텍스트 업데이트
- trigger-form.tsx, card-help.tsx, report-help.tsx의 "기사 100건" → "기사 500건"
