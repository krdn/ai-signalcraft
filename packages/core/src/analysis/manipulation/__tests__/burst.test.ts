import { describe, it, expect } from 'vitest';
import { computeBurstFromComments, BUCKET_MS } from '../signals/burst';
import type { CommentRow } from '../signals/burst';

function makeComment(parentId: string, isoTime: string): CommentRow {
  return {
    itemId: `${parentId}-${isoTime}`,
    parentSourceId: parentId,
    source: 'dcinside',
    time: new Date(isoTime),
    excerpt: '',
  };
}

describe('burst signal', () => {
  it('정상 분포는 낮은 점수', () => {
    const comments: CommentRow[] = [];
    // 부모1: 1시간 동안 12개 균등 분포 (5분당 1개)
    for (let i = 0; i < 12; i++) {
      const min = String(i * 5).padStart(2, '0');
      comments.push(makeComment('p1', `2026-04-27T10:${min}:00Z`));
    }
    const result = computeBurstFromComments(comments);
    expect(result.score).toBeLessThan(40);
    expect(result.metrics.maxZ).toBeLessThan(2);
  });

  it('강한 burst (5분에 30개) 는 70점 이상', () => {
    const comments: CommentRow[] = [];
    // 평소: 1시간 동안 5분 bucket마다 1개 (12 buckets × 1)
    for (let i = 0; i < 12; i++) {
      const min = String(i * 5).padStart(2, '0');
      comments.push(makeComment('p1', `2026-04-27T08:${min}:00Z`));
    }
    // burst: 한 5분 bucket에 30개
    for (let i = 0; i < 30; i++) {
      const sec = String(i * 2).padStart(2, '0');
      comments.push(makeComment('p1', `2026-04-27T10:00:${sec}Z`));
    }
    const result = computeBurstFromComments(comments);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence[0].severity).toBe('high');
  });

  it('데이터 부족 (5건 미만) 은 confidence 낮음', () => {
    const comments: CommentRow[] = [
      makeComment('p1', '2026-04-27T10:00:00Z'),
      makeComment('p1', '2026-04-27T10:01:00Z'),
    ];
    const result = computeBurstFromComments(comments);
    expect(result.confidence).toBeLessThan(0.3);
  });

  it('5분 bucket 크기 상수 검증', () => {
    expect(BUCKET_MS).toBe(5 * 60 * 1000);
  });

  it('빈 배열은 score=0, confidence=0', () => {
    const result = computeBurstFromComments([]);
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.evidence).toHaveLength(0);
  });
});
