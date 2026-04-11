'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, FileText, MessageSquare } from 'lucide-react';
import { CardHelp, DASHBOARD_HELP } from './card-help';
import { trpcClient } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SemanticSearchPanelProps {
  jobId: number;
}

type SearchResult = {
  id: number;
  type: 'article' | 'comment';
  content: string;
  title?: string;
  source: string;
  publisher?: string;
  similarity: number;
  sentiment?: string;
  likeCount?: number;
  publishedAt: string | null;
};

export function SemanticSearchPanel({ jobId }: SemanticSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 임베딩 보유 현황
  const { data: stats } = useQuery({
    queryKey: ['search', 'embeddingStats', jobId],
    queryFn: () => trpcClient.search.embeddingStats.query({ jobId }),
    staleTime: 60_000,
  });

  const hasEmbeddings =
    (stats?.articlesWithEmbedding ?? 0) + (stats?.commentsWithEmbedding ?? 0) > 0;

  // 엔티티 검색 결과
  const { data: entityResults } = useQuery({
    queryKey: ['search', 'searchEntities', jobId, query],
    queryFn: () => trpcClient.search.searchEntities.query({ jobId, query, limit: 10 }),
    enabled: !!query.trim() && query.length >= 2,
  });

  async function handleSearch() {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const results = await trpcClient.search.semantic.query({
        query: query.trim(),
        jobId,
        topK: 20,
        minSimilarity: 0.3,
      });
      setSearchResults(results as SearchResult[]);
    } catch (err) {
      console.error('의미 검색 실패:', err);
    } finally {
      setIsSearching(false);
    }
  }

  const sentimentColor = (s?: string) => {
    if (s === 'positive') return 'text-green-500';
    if (s === 'negative') return 'text-red-500';
    return 'text-muted-foreground';
  };

  const similarityColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500/15 text-green-600 dark:text-green-400';
    if (score >= 0.6) return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400';
    return 'bg-zinc-500/15 text-zinc-500';
  };

  if (!hasEmbeddings) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        의미 검색을 사용하려면 임베딩이 필요합니다.
        <br />
        분석 실행 시 자동으로 임베딩이 생성됩니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 제목 + 도움말 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">의미 검색</h3>
        <CardHelp {...DASHBOARD_HELP.semanticSearch} />
      </div>

      {/* 검색 입력 */}
      <div className="flex gap-2">
        <Input
          placeholder="자연어로 검색 (예: 경제 정책에 대한 비판적 의견)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          disabled={isSearching}
        />
        <Button onClick={handleSearch} disabled={isSearching || !query.trim()} size="sm">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 임베딩 통계 */}
      {stats && (
        <div className="flex gap-2 text-[10px] text-muted-foreground">
          <span>기사 {stats.articlesWithEmbedding}건</span>
          <span>·</span>
          <span>댓글 {stats.commentsWithEmbedding}건</span>
          <span>검색 가능</span>
        </div>
      )}

      {/* 검색 결과 */}
      {searchResults.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">{searchResults.length}개 결과</div>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {searchResults.map((result) => (
              <div
                key={`${result.type}-${result.id}`}
                className="rounded-md border p-2.5 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {result.type === 'article' ? (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                    )}
                    {result.title && (
                      <span className="text-xs font-medium truncate">{result.title}</span>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${similarityColor(result.similarity)}`}
                  >
                    {(result.similarity * 100).toFixed(0)}%
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{result.content}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{result.source}</span>
                  {result.publisher && <span>· {result.publisher}</span>}
                  {result.sentiment && (
                    <span className={sentimentColor(result.sentiment)}>{result.sentiment}</span>
                  )}
                  {result.likeCount != null && result.likeCount > 0 && (
                    <span>♥ {result.likeCount}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {searchResults.length === 0 && query && !isSearching && (
        <p className="text-xs text-muted-foreground text-center py-2">
          검색 결과가 없습니다. 다른 질의로 시도해 보세요.
        </p>
      )}

      {/* 관련 엔티티 */}
      {entityResults && entityResults.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">관련 엔티티</p>
          <div className="flex flex-wrap gap-1.5">
            {entityResults.map((entity) => (
              <Badge key={entity.id} variant="outline" className="text-[10px]">
                {entity.name}
                <span className="ml-1 text-muted-foreground">
                  ({entity.type}, {entity.mentionCount}회)
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
