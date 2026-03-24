'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// SSR 비활성화 -- d3-cloud 기반 컴포넌트는 브라우저 전용
const ReactWordCloud = dynamic(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  () => import('@isoterik/react-word-cloud').then((mod) => mod as any),
  { ssr: false, loading: () => <div className="h-[250px] w-full animate-pulse bg-muted rounded" /> }
) as React.ComponentType<{
  words: Array<{ text: string; value: number }>;
  callbacks?: Record<string, unknown>;
  options?: Record<string, unknown>;
}>;

interface WordCloudProps {
  words: Array<{ text: string; value: number }> | null;
}

// 색상 팔레트: accent blue 계열 (큰 단어일수록 진한 색)
const WORD_COLORS = [
  'hsl(217 91% 75%)', // 가장 연한 blue
  'hsl(217 91% 65%)',
  'hsl(217 91% 60%)', // accent blue
  'hsl(217 91% 50%)',
  'hsl(217 91% 40%)', // 가장 진한 blue
];

export function WordCloud({ words }: WordCloudProps) {
  const callbacks = useMemo(
    () => ({
      getWordColor: (word: { value: number }) => {
        // value 기반으로 색상 선택 (큰 값 = 진한 색)
        if (!words || words.length === 0) return WORD_COLORS[2];
        const maxValue = Math.max(...words.map((w) => w.value));
        const ratio = word.value / maxValue;
        const index = Math.min(Math.floor(ratio * WORD_COLORS.length), WORD_COLORS.length - 1);
        return WORD_COLORS[index];
      },
      getWordTooltip: (word: { text: string; value: number }) =>
        `${word.text}: ${word.value}`,
    }),
    [words]
  );

  const options = useMemo(
    () => ({
      rotations: 2,
      rotationAngles: [0, 90] as [number, number],
      fontSizes: [14, 48] as [number, number],
      padding: 2,
      spiral: 'archimedean' as const,
      deterministic: true,
    }),
    []
  );

  return (
    <Card className="min-h-[280px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">키워드 / 연관어</CardTitle>
      </CardHeader>
      <CardContent>
        {!words || words.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground" role="status">
            키워드 없음
          </div>
        ) : (
          <div className="h-[250px] w-full">
            <ReactWordCloud words={words} callbacks={callbacks} options={options} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
