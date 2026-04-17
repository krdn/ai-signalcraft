/**
 * 댓글 압축(샘플링) 전략
 *
 * 기존: 좋아요순 단일 기준 → 편향/출처 독점 문제
 * 개선: 다중 신호 스코어링 + 소스별 최소 쿼터 보장
 *
 * 스코어 = 좋아요(0.5) + 시간가중(0.2) + 길이보너스(0.1) + 감정다양성(0.2)
 *  - 좋아요: 같은 소스 내 max 기준 정규화
 *  - 시간가중: 최근 댓글 우선 (half-life 7일)
 *  - 길이보너스: 너무 짧은 "ㅇㅇ", "ㅋㅋ" 댓글 페널티
 *  - 감정다양성: 이미 선택된 sentiment와 반대일수록 가산
 *
 * 소스 쿼터: 각 소스에서 최소 15% 슬롯 보장 → 단일 소스 지배 방지
 */
import type { AnalysisInput } from '../types';

type Comment = AnalysisInput['comments'][number];

const NOW = () => Date.now();
const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7일

function likeScore(like: number | null, maxLike: number): number {
  if (!maxLike || !like) return 0;
  return Math.min(1, like / maxLike);
}

function timeScore(publishedAt: Date | null): number {
  if (!publishedAt) return 0.5;
  const ageMs = NOW() - new Date(publishedAt).getTime();
  if (ageMs < 0) return 1;
  // half-life 7일: age=7일이면 0.5, age=14일이면 0.25
  return Math.pow(0.5, ageMs / HALF_LIFE_MS);
}

function lengthScore(content: string): number {
  const len = content?.length ?? 0;
  if (len < 5) return 0.1; // "ㅇㅇ", "ㅋㅋ" 류
  if (len < 15) return 0.5;
  if (len < 100) return 1.0;
  return 0.8; // 너무 긴 댓글은 약간 페널티 (복붙/스팸 가능성)
}

/**
 * 좋아요순 단순 상한 (기존 동작 유지)
 * 하위 호환을 위해 유지하되, 내부 구현은 새 함수 호출.
 */
export function compressComments(comments: Comment[], limit: number | null): Comment[] {
  if (limit === null || comments.length <= limit) return comments;
  return compressCommentsBalanced(comments, limit);
}

/**
 * 개선된 샘플링: 다중 신호 + 소스 쿼터
 * @param comments 원본 댓글
 * @param limit 최대 개수
 * @param options.minSourceShare 소스당 최소 보장 비율 (0~1, 기본 0.15)
 */
export function compressCommentsBalanced(
  comments: Comment[],
  limit: number,
  options: { minSourceShare?: number } = {},
): Comment[] {
  if (comments.length <= limit) return comments;

  const minShare = options.minSourceShare ?? 0.15;

  // 소스별 그룹화
  const bySource = new Map<string, Comment[]>();
  for (const c of comments) {
    if (!bySource.has(c.source)) bySource.set(c.source, []);
    bySource.get(c.source)!.push(c);
  }

  const sources = [...bySource.keys()];
  const sourceCount = sources.length;

  // 소스당 최소 할당 (floor)
  const minPerSource = Math.max(1, Math.floor((limit * minShare) / Math.max(1, sourceCount)));

  // 각 소스에서 스코어 상위를 뽑아 보장 슬롯 채움
  const guaranteed: Comment[] = [];
  const guaranteedSet = new Set<Comment>();

  for (const [, srcComments] of bySource) {
    const maxLike = Math.max(1, ...srcComments.map((c) => c.likeCount ?? 0));
    const scored = srcComments
      .map((c) => ({
        c,
        score:
          likeScore(c.likeCount ?? 0, maxLike) * 0.5 +
          timeScore(c.publishedAt ?? null) * 0.2 +
          lengthScore(c.content) * 0.3,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, minPerSource);

    for (const { c } of scored) {
      guaranteed.push(c);
      guaranteedSet.add(c);
    }
  }

  // 남은 슬롯은 전체 풀에서 좋아요 + 시간 스코어 상위로 채움 (중복 제외)
  const remaining = limit - guaranteed.length;
  if (remaining <= 0) return guaranteed.slice(0, limit);

  const globalMaxLike = Math.max(1, ...comments.map((c) => c.likeCount ?? 0));
  const pool = comments
    .filter((c) => !guaranteedSet.has(c))
    .map((c) => ({
      c,
      score:
        likeScore(c.likeCount ?? 0, globalMaxLike) * 0.6 +
        timeScore(c.publishedAt ?? null) * 0.2 +
        lengthScore(c.content) * 0.2,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, remaining)
    .map(({ c }) => c);

  return [...guaranteed, ...pool];
}
