// selectAnalysisRows — collector RAG 결과/전체 풀 병합 게이트 단위 검증.
// DB·collector mock 없이 순수 함수만 직접 호출한다.
import { describe, it, expect } from 'vitest';
import { selectAnalysisRows } from '../src/analysis/data-loader';

type Row = { source: string; sourceId: string; itemType: 'article' | 'video' | 'comment' };

function rows(itemType: Row['itemType'], n: number, prefix = 'rag'): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    source: 'naver-news',
    sourceId: `${prefix}-${itemType}-${i}`,
    itemType,
  }));
}

describe('selectAnalysisRows', () => {
  it('RAG가 targetK 이상 반환하면 ragRows를 그대로 통과 (관련도 선별 보존)', () => {
    const rag = rows('article', 600);
    const full = rows('article', 5000, 'full');
    const out = selectAnalysisRows(rag, full, 600);
    expect(out).toHaveLength(600);
    expect(out).toBe(rag); // 동일 참조 — fullset 미접촉
  });

  it('RAG가 targetK 미달이고 풀이 더 크면 병합·dedup으로 복구', () => {
    // sourceId가 겹치지 않는 독립 행 → 병합 시 모두 유지
    const rag = rows('article', 3, 'rag');
    const full = rows('article', 10, 'full');
    const out = selectAnalysisRows(rag, full, 600);
    expect(out).toHaveLength(13); // 3 + 10, 중복 없음
  });

  it('병합 시 collector 키(source::sourceId::itemType)로 중복 제거', () => {
    // ragRows의 0,1,2가 fullset의 0,1,2와 동일 sourceId → dedup
    const rag = rows('article', 3, 'x');
    const full = rows('article', 10, 'x'); // 같은 prefix → sourceId 0~2 겹침
    const out = selectAnalysisRows(rag, full, 600);
    expect(out).toHaveLength(10); // 3 + 7 신규
  });

  it('under-deliver여도 풀이 ragRows보다 크지 않으면 폴백 무의미 → ragRows 유지', () => {
    const rag = rows('article', 3, 'rag');
    const full = rows('article', 2, 'full');
    const out = selectAnalysisRows(rag, full, 600);
    expect(out).toBe(rag);
  });

  it('targetK<=0 (RAG 미요청 itemType): ragRows 있으면 그대로, 없으면 fullset 전체', () => {
    // rag-light의 기사처럼 ragSample에 없는 경우 → fullset 폴백
    const full = rows('article', 5, 'full');
    expect(selectAnalysisRows([] as Row[], full, 0)).toBe(full);
    // ragRows가 있으면(예외적) 그대로
    const rag = rows('article', 4, 'rag');
    expect(selectAnalysisRows(rag, full, 0)).toBe(rag);
  });

  it('article+video 결합 판정: 합산이 targetK 이상이면 통과', () => {
    const rag = [...rows('article', 400, 'rag'), ...rows('video', 250, 'rag')];
    const full = [...rows('article', 5000, 'full'), ...rows('video', 1000, 'full')];
    const out = selectAnalysisRows(rag, full, 600); // 650 >= 600 → 통과
    expect(out).toBe(rag);
  });
});
