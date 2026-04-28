'use client';

interface Props {
  data: { kind: 'trend-line'; [k: string]: unknown } | unknown;
}

export function TrendLine({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'trend-line') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (trend-line)</span>;
  }
  // TODO Task 6: Recharts/표로 교체
  return (
    <pre className="text-xs overflow-x-auto rounded bg-muted p-2">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
