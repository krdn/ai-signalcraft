'use client';

interface Props {
  data:
    | {
        kind: 'media-sync-timeline';
        cluster: string;
        items: { publisher: string | null; time: string; headline: string }[];
      }
    | unknown;
}

export function MediaSyncTimeline({ data }: Props) {
  if (
    !data ||
    typeof data !== 'object' ||
    (data as { kind?: string }).kind !== 'media-sync-timeline'
  ) {
    return (
      <span className="text-xs text-muted-foreground">
        시각화 데이터 오류 (media-sync-timeline)
      </span>
    );
  }
  const d = data as {
    cluster: string;
    items: { publisher: string | null; time: string; headline: string }[];
  };
  return (
    <div data-testid="viz-media-sync-timeline" className="space-y-2 text-xs">
      <div className="rounded bg-muted p-2">
        <span className="text-muted-foreground">클러스터: </span>
        <span className="font-medium">{d.cluster}</span>
      </div>
      {Array.isArray(d.items) && d.items.length > 0 ? (
        <div className="rounded border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="p-1 text-left">시간</th>
                <th className="p-1 text-left">매체</th>
                <th className="p-1 text-left">헤드라인</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1">{it.time}</td>
                  <td className="p-1">{it.publisher ?? '?'}</td>
                  <td className="p-1">{it.headline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground">항목 없음</p>
      )}
    </div>
  );
}
