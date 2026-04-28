'use client';

interface Props {
  data:
    | {
        kind: 'similarity-cluster';
        representative: string;
        matches: { author: string | null; source: string; time: string; text: string }[];
      }
    | unknown;
}

export function SimilarityCluster({ data }: Props) {
  if (
    !data ||
    typeof data !== 'object' ||
    (data as { kind?: string }).kind !== 'similarity-cluster'
  ) {
    return (
      <span className="text-xs text-muted-foreground">시각화 데이터 오류 (similarity-cluster)</span>
    );
  }
  const d = data as {
    representative: string;
    matches: { author: string | null; source: string; time: string; text: string }[];
  };
  return (
    <div data-testid="viz-similarity-cluster" className="space-y-2 text-xs">
      <div className="rounded bg-muted p-2">
        <span className="text-muted-foreground">대표 텍스트: </span>
        <span className="font-medium">{d.representative}</span>
      </div>
      {Array.isArray(d.matches) && d.matches.length > 0 ? (
        <div className="rounded border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="p-1 text-left">작성자</th>
                <th className="p-1 text-left">소스</th>
                <th className="p-1 text-left">시간</th>
                <th className="p-1 text-left">내용</th>
              </tr>
            </thead>
            <tbody>
              {d.matches.map((m, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1">{m.author ?? '익명'}</td>
                  <td className="p-1">{m.source}</td>
                  <td className="p-1">{m.time}</td>
                  <td className="p-1">{m.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground">매치 없음</p>
      )}
    </div>
  );
}
