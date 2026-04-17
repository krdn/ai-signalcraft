'use client';

import { useMemo } from 'react';
import { SOURCE_LABELS } from '../collected-data-shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ByTypeAndSource {
  articles: Array<{ source: string; count: number }>;
  videos: Array<{ source: string; count: number }>;
  comments: Array<{ source: string; count: number }>;
}

interface Props {
  byTypeAndSource: ByTypeAndSource;
}

type Row = {
  mediaKey: string;
  label: string;
  articles: number;
  videos: number;
  comments: number;
  total: number;
};

// source 문자열 → 매체 그룹 키 정규화
function mediaKeyOf(source: string): string {
  if (source === 'naver-news' || source === 'naver-comments') return 'naver';
  if (source === 'youtube-videos' || source === 'youtube-comments' || source === 'youtube')
    return 'youtube';
  return source;
}

function mediaLabel(key: string): string {
  if (key === 'naver') return '네이버';
  if (key === 'youtube') return '유튜브';
  return SOURCE_LABELS[key] ?? key;
}

export function SourceTypeBreakdown({ byTypeAndSource }: Props) {
  const rows: Row[] = useMemo(() => {
    const acc = new Map<string, Row>();
    const get = (key: string): Row => {
      let r = acc.get(key);
      if (!r) {
        r = {
          mediaKey: key,
          label: mediaLabel(key),
          articles: 0,
          videos: 0,
          comments: 0,
          total: 0,
        };
        acc.set(key, r);
      }
      return r;
    };
    for (const { source, count } of byTypeAndSource.articles)
      get(mediaKeyOf(source)).articles += count;
    for (const { source, count } of byTypeAndSource.videos) get(mediaKeyOf(source)).videos += count;
    for (const { source, count } of byTypeAndSource.comments)
      get(mediaKeyOf(source)).comments += count;
    for (const r of acc.values()) r.total = r.articles + r.videos + r.comments;
    return Array.from(acc.values()).sort((a, b) => b.total - a.total);
  }, [byTypeAndSource]);

  const maxArticles = Math.max(1, ...rows.map((r) => r.articles));
  const maxVideos = Math.max(1, ...rows.map((r) => r.videos));
  const maxComments = Math.max(1, ...rows.map((r) => r.comments));

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">매체 × 타입</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">수집 데이터가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>매체 × 타입</span>
          <span className="text-xs font-normal text-muted-foreground">매체 {rows.length}개</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-2 pr-2 font-medium">매체</th>
                <th className="text-right py-2 px-2 font-medium">기사</th>
                <th className="text-right py-2 px-2 font-medium">영상</th>
                <th className="text-right py-2 px-2 font-medium">댓글</th>
                <th className="text-right py-2 pl-2 font-medium">합계</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.mediaKey} className="border-b last:border-b-0">
                  <td className="py-2 pr-2 font-medium">{r.label}</td>
                  <BarCell value={r.articles} max={maxArticles} tone="blue" />
                  <BarCell value={r.videos} max={maxVideos} tone="red" />
                  <BarCell value={r.comments} max={maxComments} tone="green" />
                  <td className="py-2 pl-2 text-right tabular-nums font-semibold">
                    {r.total.toLocaleString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function BarCell({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone: 'blue' | 'red' | 'green';
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const bg =
    tone === 'blue' ? 'bg-blue-500/30' : tone === 'red' ? 'bg-red-500/30' : 'bg-green-500/30';
  const dim = value === 0 ? 'text-muted-foreground' : '';
  return (
    <td className="py-2 px-2">
      <div className="flex items-center gap-2 justify-end">
        <div className="relative h-1.5 w-16 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${bg} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`tabular-nums text-right min-w-[3rem] ${dim}`}>
          {value.toLocaleString('ko-KR')}
        </span>
      </div>
    </td>
  );
}
