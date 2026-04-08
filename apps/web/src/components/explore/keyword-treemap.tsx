'use client';

import { useMemo, type ReactElement } from 'react';
import { Treemap } from 'recharts';
import { EXPLORE_HELP, SENTIMENT_COLORS, type SentimentKey } from './explore-help';
import { CardHelp } from '@/components/dashboard/card-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface KeywordTreemapProps {
  data: Array<{ keyword: string; count: number; sentiment: string }> | undefined;
  isLoading: boolean;
}

interface TreemapNode {
  name: string;
  size: number;
  sentiment: SentimentKey;
}

interface CellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  sentiment?: SentimentKey;
  size?: number;
}

export function KeywordTreemap({ data, isLoading }: KeywordTreemapProps) {
  const items: TreemapNode[] = useMemo(() => {
    if (!data) return [];
    return data
      .filter((k) => k.count > 0)
      .slice(0, 30)
      .map((k) => ({
        name: k.keyword,
        size: k.count,
        sentiment: (['positive', 'negative', 'neutral'].includes(k.sentiment)
          ? k.sentiment
          : 'neutral') as SentimentKey,
      }));
  }, [data]);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">키워드-감정 트리맵</CardTitle>
          <CardHelp {...EXPLORE_HELP.treemap} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
            키워드 데이터 없음 (sentiment-framing 모듈 미완료)
          </div>
        ) : (
          <div className="h-[260px] w-full">
            <Treemap
              width={undefined as unknown as number}
              height={260}
              data={items as unknown as readonly never[]}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#fff"
              content={(<KeywordCell />) as unknown as ReactElement}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KeywordCell(props: CellProps) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', sentiment = 'neutral', size = 0 } = props;
  const fill = SENTIMENT_COLORS[sentiment];
  const showLabel = width > 44 && height > 22;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill,
          fillOpacity: 0.75,
          stroke: '#fff',
          strokeWidth: 2,
          strokeOpacity: 0.8,
        }}
      />
      {showLabel && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.min(14, Math.max(10, width / 8))}
            fontWeight={600}
            fill="#fff"
            style={{ pointerEvents: 'none' }}
          >
            {name}
          </text>
          {height > 36 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fill="#fff"
              fillOpacity={0.85}
              style={{ pointerEvents: 'none' }}
            >
              {size}
            </text>
          )}
        </>
      )}
    </g>
  );
}
