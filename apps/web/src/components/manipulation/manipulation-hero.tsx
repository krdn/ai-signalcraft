'use client';

import ReactMarkdown from 'react-markdown';

interface ManipulationHeroProps {
  manipulationScore: number | null | undefined;
  confidenceFactor: number | null | undefined;
  weightsVersion: string | null | undefined;
  narrativeMd: string | null | undefined;
}

function severityFromScore(score: number | null | undefined): 'low' | 'medium' | 'high' {
  if (score == null) return 'low';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

const SEVERITY_BG: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-gradient-to-br from-green-500 to-green-600',
  medium: 'bg-gradient-to-br from-yellow-500 to-orange-500',
  high: 'bg-gradient-to-br from-red-500 to-red-600',
};

const SEVERITY_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: '낮음',
  medium: '중간',
  high: '높음',
};

export function ManipulationHero({
  manipulationScore,
  confidenceFactor,
  weightsVersion,
  narrativeMd,
}: ManipulationHeroProps) {
  const severity = severityFromScore(manipulationScore);

  return (
    <div className="space-y-4">
      <div className={`rounded-lg p-6 text-white ${SEVERITY_BG[severity]}`}>
        <div className="text-xs opacity-90">조작 점수</div>
        <div className="text-4xl font-bold">
          {manipulationScore != null ? manipulationScore.toFixed(1) : 'N/A'}
        </div>
        <div className="mt-2 flex justify-between text-xs opacity-90">
          <span>심각도: {SEVERITY_LABEL[severity]}</span>
          <span>
            신뢰도 {confidenceFactor != null ? confidenceFactor.toFixed(2) : 'N/A'}
            {weightsVersion ? ` · ${weightsVersion}` : ''}
          </span>
        </div>
      </div>
      {narrativeMd && (
        <div className="prose prose-sm max-w-none rounded-lg border bg-card p-4">
          <ReactMarkdown>{narrativeMd}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
