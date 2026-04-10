'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { PresetCard } from './preset-card';
import { trpcClient } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export interface PresetData {
  id: string;
  slug: string;
  category: string;
  domain: string;
  title: string;
  description: string;
  icon: string;
  highlight: string | null;
  sources: Record<string, boolean>;
  customSourceIds: string[];
  limits: {
    naverArticles: number;
    youtubeVideos: number;
    communityPosts: number;
    commentsPerItem: number;
  };
  optimization: 'none' | 'light' | 'standard' | 'aggressive';
  skippedModules: string[];
  enableItemAnalysis: boolean;
}

interface PresetSelectorProps {
  onSelect: (preset: PresetData) => void;
  onSkip: () => void;
}

const CATEGORY_ORDER = ['핵심 활용', '산업 특화', '확장 영역'];

// 공통 모듈 수 (Stage 1: 4 + Stage 2: 3 + Stage 3: 1 = 8)
const COMMON_MODULE_COUNT = 8;
// 도메인별 Stage 4 모듈 수
const DOMAIN_MODULE_COUNT = 4;

export function PresetSelector({ onSelect, onSkip }: PresetSelectorProps) {
  const { data: presets, isLoading } = useQuery({
    queryKey: ['presets', 'enabled'],
    queryFn: () => trpcClient.presets.listEnabled.query(),
    staleTime: 5 * 60 * 1000,
  });

  const grouped = useMemo(() => {
    if (!presets) return {};
    const map: Record<string, PresetData[]> = {};
    for (const p of presets) {
      const cat = p.category;
      if (!map[cat]) map[cat] = [];
      map[cat].push(p as PresetData);
    }
    return map;
  }, [presets]);

  const categories = CATEGORY_ORDER.filter((c) => grouped[c]?.length);

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">분석 유형 선택</CardTitle>
        <p className="text-sm text-muted-foreground">
          유형을 선택하면 최적화된 설정이 자동 적용됩니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            사용 가능한 프리셋이 없습니다.
          </p>
        ) : (
          <Tabs defaultValue={categories[0]}>
            <TabsList className="w-full">
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="flex-1 text-xs">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
            {categories.map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-3">
                <div className="grid grid-cols-2 gap-3">
                  {grouped[cat]?.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      title={preset.title}
                      description={preset.description}
                      icon={preset.icon}
                      highlight={preset.highlight}
                      domain={preset.domain}
                      skippedModules={preset.skippedModules}
                      totalModules={COMMON_MODULE_COUNT + DOMAIN_MODULE_COUNT}
                      onClick={() => onSelect(preset)}
                    />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        <div className="text-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={onSkip}
          >
            <Settings2 className="h-3.5 w-3.5 mr-1" />
            직접 설정으로 시작
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
