# Quick Task 260325-r8r: 분석 실행 화면에서 자세한 도움말 추가

## 결과

**Status:** Completed

### 변경 사항

1. **shadcn/ui Collapsible 컴포넌트 설치** — `apps/web/src/components/ui/collapsible.tsx` (base-ui 기반)
2. **TriggerForm 도움말 토글 섹션 추가** — `apps/web/src/components/analysis/trigger-form.tsx`

### 도움말 내용 (4개 섹션)

| 섹션          | 설명                                                                  |
| ------------- | --------------------------------------------------------------------- |
| 키워드        | 인물명/키워드 입력 안내 + 예시 (이재명, 윤석열, 삼성전자, 갤럭시 S25) |
| 소스별 특성   | 네이버 뉴스(기사+댓글), 유튜브(영상댓글), 커뮤니티(게시글+댓글)       |
| 분석 기간     | 1~2주 권장, 이슈 발생 시점 좁히기 팁                                  |
| 분석 프로세스 | 수집 → 전처리 → AI 분석 → 리포트 생성 시각적 흐름도                   |

### UI 동작

- 기본: 접혀있음 (isHelpOpen: false)
- "도움말" 버튼 클릭 → 펼침/접힘 토글
- ChevronDown 아이콘 180° 회전 애니메이션
- form submit 방지 (type="button" 불필요 — CollapsibleTrigger는 form 외부 동작)

### 검증

- TypeScript 컴파일 오류 없음 (`tsc --noEmit` 통과)
