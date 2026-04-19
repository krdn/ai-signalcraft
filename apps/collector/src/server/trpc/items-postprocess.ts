/**
 * items.query 결과의 post-processing — DB에 의존하지 않는 순수 함수.
 *
 * - truncateContent: maxContentLength 적용
 * - limitCommentsPerParent: parent_source_id 기준 댓글 개수 상한
 *
 * 분리 이유: DB 쿼리와 무관한 로직을 독립적으로 단위 테스트하기 위함.
 */

export type PostProcessRow = Record<string, unknown> & {
  content?: unknown;
  itemType?: unknown;
  parentSourceId?: unknown;
};

export function truncateContent<T extends PostProcessRow>(rows: T[], maxLength: number): T[] {
  if (!maxLength || maxLength <= 0) return rows;
  for (const row of rows) {
    const c = row.content;
    if (typeof c === 'string' && c.length > maxLength) {
      row.content = c.slice(0, maxLength);
    }
  }
  return rows;
}

export function limitCommentsPerParent<T extends PostProcessRow>(
  rows: T[],
  maxComments: number,
): T[] {
  if (!maxComments || maxComments < 0) return rows;
  const byParent = new Map<string, number>();
  return rows.filter((r) => {
    if (r.itemType !== 'comment') return true;
    const key = (r.parentSourceId as string) ?? '';
    const count = byParent.get(key) ?? 0;
    if (count >= maxComments) return false;
    byParent.set(key, count + 1);
    return true;
  });
}
