import type { AnalysisInput } from '../types';

export function compressComments(
  comments: AnalysisInput['comments'],
  limit: number | null,
): AnalysisInput['comments'] {
  if (limit === null || comments.length <= limit) return comments;

  return [...comments].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0)).slice(0, limit);
}
