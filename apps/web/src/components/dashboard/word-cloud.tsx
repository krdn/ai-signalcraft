'use client';

import { useMemo } from 'react';
import { CardHelp, DASHBOARD_HELP } from './card-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

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
  const styledWords = useMemo(() => {
    if (!words || words.length === 0) return [];
    const maxValue = Math.max(...words.map((w) => w.value));
    const minValue = Math.min(...words.map((w) => w.value));
    const range = maxValue - minValue || 1;

    return words.slice(0, 20).map((word) => {
      const ratio = (word.value - minValue) / range;
      const fontSize = 14 + ratio * 28; // 14px ~ 42px
      const colorIndex = Math.min(Math.floor(ratio * WORD_COLORS.length), WORD_COLORS.length - 1);
      return {
        text: word.text,
        value: word.value,
        fontSize,
        color: WORD_COLORS[colorIndex],
        fontWeight: ratio > 0.5 ? 700 : 400,
      };
    });
  }, [words]);

  return (
    <Card className="h-full border-t-2 border-t-violet-500 border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all min-h-[280px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">키워드 / 연관어</CardTitle>
          <CardHelp {...DASHBOARD_HELP.keywords} />
        </div>
      </CardHeader>
      <CardContent>
        {!words || words.length === 0 ? (
          <div
            className="flex items-center justify-center h-[200px] text-muted-foreground"
            role="status"
          >
            키워드 없음
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 h-[220px] overflow-hidden">
            {styledWords.map((word, idx) => (
              <span
                key={`${word.text}-${idx}`}
                className="inline-block cursor-default transition-opacity hover:opacity-70"
                style={{
                  fontSize: `${word.fontSize}px`,
                  color: word.color,
                  fontWeight: word.fontWeight,
                  lineHeight: 1.2,
                }}
                title={`${word.text}: ${word.value}`}
              >
                {word.text}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
