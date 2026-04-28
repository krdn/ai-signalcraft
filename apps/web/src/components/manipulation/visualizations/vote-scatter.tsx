'use client';

interface Props {
  data: { kind: 'vote-scatter'; [k: string]: unknown } | unknown;
}

export function VoteScatter({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'vote-scatter') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (vote-scatter)</span>;
  }
  // TODO Task 6: Recharts/표로 교체
  return (
    <pre className="text-xs overflow-x-auto rounded bg-muted p-2">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
