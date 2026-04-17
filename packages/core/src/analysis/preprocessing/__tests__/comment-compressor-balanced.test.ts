import { describe, it, expect } from 'vitest';
import { compressCommentsBalanced, compressComments } from '../comment-compressor';
import type { AnalysisInput } from '../../types';

type Comment = AnalysisInput['comments'][number];

function makeComment(opts: Partial<Comment> & { content?: string }): Comment {
  return {
    content: opts.content ?? '댓글',
    source: opts.source ?? 'naver-news',
    author: opts.author ?? 'user',
    likeCount: opts.likeCount ?? 0,
    dislikeCount: opts.dislikeCount ?? 0,
    publishedAt: opts.publishedAt ?? new Date(),
  };
}

describe('compressCommentsBalanced', () => {
  it('소스당 최소 쿼터를 보장한다', () => {
    // 유튜브 댓글 100개(좋아요 높음) + 네이버 댓글 10개(좋아요 낮음)
    const comments: Comment[] = [
      ...Array.from({ length: 100 }, (_, i) =>
        makeComment({ source: 'youtube', content: `yt${i} 댓글내용`, likeCount: 1000 - i }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeComment({ source: 'naver-news', content: `nv${i} 댓글내용`, likeCount: 10 - i }),
      ),
    ];

    const result = compressCommentsBalanced(comments, 50, { minSourceShare: 0.15 });

    expect(result.length).toBe(50);

    const sources = new Set(result.map((c) => c.source));
    expect(sources.has('naver-news')).toBe(true); // 좋아요 낮아도 쿼터로 포함됨
    expect(sources.has('youtube')).toBe(true);
  });

  it('짧은 댓글(ㅇㅇ, ㅋㅋ)을 페널티 준다', () => {
    const comments: Comment[] = [
      makeComment({ content: 'ㅇㅇ', likeCount: 1000, source: 'youtube' }),
      makeComment({
        content: '이 의견에 동의합니다 설명이 상세합니다',
        likeCount: 500,
        source: 'youtube',
      }),
      makeComment({ content: 'ㅋㅋ', likeCount: 1000, source: 'youtube' }),
      makeComment({ content: '좋은 분석이네요 감사합니다', likeCount: 400, source: 'youtube' }),
    ];
    const result = compressCommentsBalanced(comments, 2);
    // 길이 스코어로 내용 있는 댓글이 우선
    const contents = result.map((c) => c.content);
    expect(contents.some((c) => c.length > 10)).toBe(true);
  });

  it('댓글 수가 limit 이하면 원본 반환', () => {
    const comments = [makeComment({ content: 'a' }), makeComment({ content: 'b' })];
    expect(compressCommentsBalanced(comments, 10).length).toBe(2);
  });

  it('compressComments (하위호환)이 balanced를 호출한다', () => {
    const comments = Array.from({ length: 100 }, (_, i) =>
      makeComment({ likeCount: 100 - i, content: `댓글 ${i} 본문` }),
    );
    const result = compressComments(comments, 20);
    expect(result.length).toBe(20);
  });

  it('limit null이면 원본 그대로 반환', () => {
    const comments = Array.from({ length: 50 }, (_, i) => makeComment({ likeCount: i }));
    expect(compressComments(comments, null).length).toBe(50);
  });
});
