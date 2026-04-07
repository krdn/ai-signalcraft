import { describe, it, expect } from 'vitest';
import { compressComments } from '../src/preprocessing/comment-compressor';
import type { AnalysisInput } from '../src/types';

function makeComments(count: number): AnalysisInput['comments'] {
  return Array.from({ length: count }, (_, i) => ({
    content: `댓글 내용 ${i}`,
    source: 'naver-news',
    author: `user${i}`,
    likeCount: count - i,
    dislikeCount: 0,
    publishedAt: new Date(),
  }));
}

describe('compressComments', () => {
  it('상한이 null이면 원본 그대로 반환', () => {
    const comments = makeComments(500);
    const result = compressComments(comments, null);
    expect(result).toHaveLength(500);
  });

  it('댓글 수가 상한 이하면 변경 없음', () => {
    const comments = makeComments(50);
    const result = compressComments(comments, 100);
    expect(result).toHaveLength(50);
  });

  it('상한 적용 시 좋아요순 상위만 유지', () => {
    const comments = makeComments(300);
    const result = compressComments(comments, 100);
    expect(result).toHaveLength(100);
    expect(result[0].likeCount).toBeGreaterThanOrEqual(result[99].likeCount!);
  });

  it('빈 배열은 빈 배열 반환', () => {
    const result = compressComments([], 100);
    expect(result).toHaveLength(0);
  });
});
