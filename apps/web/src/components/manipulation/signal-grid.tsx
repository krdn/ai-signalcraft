'use client';

interface SignalRow {
  signal: string;
  score: number;
  confidence: number;
}

interface SignalGridProps {
  signals: SignalRow[];
}

const SIGNAL_LABELS: Record<string, string> = {
  burst: '트래픽 폭주',
  similarity: '유사도 클러스터',
  vote: '투표 이상',
  'media-sync': '매체 동조',
  'trend-shape': '트렌드 형상',
  'cross-platform': '크로스 플랫폼',
  temporal: '시간대 이상',
};

function severityClass(score: number): string {
  if (score >= 70) return 'bg-red-100 text-red-800 border-red-200';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-green-100 text-green-800 border-green-200';
}

export function SignalGrid({ signals }: SignalGridProps) {
  // signals 비어있을 때 빈 grid 렌더 대신 null 반환 — spec과 차이.
  // 빈 그리드 박스가 시각적 잡음이고, 실제로 이 케이스는 manipulation_signals 테이블
  // INSERT가 실패했을 때만 발생 (Phase 2 정상 흐름은 항상 7건). null이 더 깔끔.
  if (signals.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
      {signals.map((s) => (
        <div
          key={s.signal}
          className={`rounded-md border p-2 text-center ${severityClass(s.score)}`}
        >
          <div className="text-xs">{SIGNAL_LABELS[s.signal] ?? s.signal}</div>
          <div className="text-lg font-bold">{s.score.toFixed(0)}</div>
          <div className="text-[10px] opacity-70">신뢰 {s.confidence.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}
