'use client';

interface Props {
  data:
    | {
        kind: 'cross-platform-flow';
        hops: { from: string; to: string; time: string; message: string; count: number }[];
      }
    | unknown;
}

export function CrossPlatformFlow({ data }: Props) {
  if (
    !data ||
    typeof data !== 'object' ||
    (data as { kind?: string }).kind !== 'cross-platform-flow'
  ) {
    return (
      <span className="text-xs text-muted-foreground">
        시각화 데이터 오류 (cross-platform-flow)
      </span>
    );
  }
  const d = data as {
    hops: { from: string; to: string; time: string; message: string; count: number }[];
  };
  return Array.isArray(d.hops) && d.hops.length > 0 ? (
    <div data-testid="viz-cross-platform-flow" className="rounded border overflow-hidden text-xs">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="p-1 text-left">시간</th>
            <th className="p-1 text-left">출처</th>
            <th className="p-1 text-left">→</th>
            <th className="p-1 text-left">대상</th>
            <th className="p-1 text-left">메시지</th>
            <th className="p-1 text-right">횟수</th>
          </tr>
        </thead>
        <tbody>
          {d.hops.map((h, i) => (
            <tr key={i} className="border-t">
              <td className="p-1">{h.time}</td>
              <td className="p-1">{h.from}</td>
              <td className="p-1 text-muted-foreground">→</td>
              <td className="p-1">{h.to}</td>
              <td className="p-1">{h.message}</td>
              <td className="p-1 text-right">{h.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <span className="text-xs text-muted-foreground">홉 없음</span>
  );
}
