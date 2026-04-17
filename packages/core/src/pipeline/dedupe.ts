// persist.* 함수들이 공통으로 쓰는 (source, sourceId) 기준 입력 배열 dedupe 헬퍼.
// 같은 batch에서 동일 키가 여러 번 나타나면 ON CONFLICT DO UPDATE가 한 행을 두 번 건드려
// Postgres가 "cannot affect row a second time" 오류로 거부한다.
// 마지막 값을 유지해 수집기가 의도한 최신 데이터를 저장.

export type SourceKeyedRow = {
  source: string;
  sourceId: string;
};

export interface DedupeResult<T extends SourceKeyedRow> {
  deduped: T[];
  dropped: number;
  ratio: number;
}

export function dedupeBySourceId<T extends SourceKeyedRow>(data: T[]): DedupeResult<T> {
  const seen = new Map<string, T>();
  for (const row of data) {
    seen.set(`${row.source}:${row.sourceId}`, row);
  }
  const deduped = [...seen.values()];
  const dropped = data.length - deduped.length;
  const ratio = data.length > 0 ? dropped / data.length : 0;
  return { deduped, dropped, ratio };
}
