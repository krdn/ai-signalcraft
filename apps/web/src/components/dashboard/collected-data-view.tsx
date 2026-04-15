'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, FileText, BarChart3, Video, MessageSquare, Search } from 'lucide-react';
import { SummaryView } from './collected-data-summary';
import { ArticlesView, VideosView, CommentsView } from './collected-data-table';
import { SemanticSearchPanel } from './semantic-search-panel';
import { SOURCE_LABELS } from './collected-data-shared';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';

interface CollectedDataViewProps {
  jobId: number | null;
  initialSourceFilter?: string | null;
  initialArticleId?: number | null;
  onNavigateToExplore?: (source?: string) => void;
}

export function CollectedDataView({
  jobId,
  initialSourceFilter,
  initialArticleId,
  onNavigateToExplore,
}: CollectedDataViewProps) {
  const [view, setView] = useState<'summary' | 'articles' | 'videos' | 'comments' | 'search'>(
    'summary',
  );
  const [articlePage, setArticlePage] = useState(1);
  const [videoPage, setVideoPage] = useState(1);
  const [commentPage, setCommentPage] = useState(1);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  // initialSourceFilter가 있으면 마운트 시 해당 소스 필터 적용 및 기사 뷰로 전환
  useEffect(() => {
    if (initialSourceFilter) {
      setSourceFilter(initialSourceFilter);
      setView('articles');
      setArticlePage(1);
    }
  }, [initialSourceFilter]);

  // initialArticleId가 있으면 기사 뷰로 전환 후 해당 기사의 인라인 댓글 펼침
  useEffect(() => {
    if (initialArticleId != null) {
      setView('articles');
      setSelectedArticleId(initialArticleId);
    }
  }, [initialArticleId]);

  // 사용 가능한 소스 목록 (요약 데이터 재사용)
  const { data: summary } = useQuery({
    queryKey: ['collectedData', 'getSummary', jobId],
    queryFn: () => trpcClient.collectedData.getSummary.query({ jobId: jobId! }),
    enabled: !!jobId,
  });

  const availableSources = summary
    ? Array.from(
        new Map(
          summary.sourceBreakdown.map((s) => [s.source, { source: s.source, count: s.count }]),
        ).values(),
      ).sort((a, b) => b.count - a.count)
    : [];

  const resetPages = () => {
    setArticlePage(1);
    setVideoPage(1);
    setCommentPage(1);
  };

  if (!jobId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-semibold">수집 데이터가 없습니다</p>
        <p className="text-sm mt-2">분석을 실행하거나 히스토리에서 선택하세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더: 뷰 전환 탭 + 탐색 이동 버튼 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Button
            variant={view === 'summary' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('summary')}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            요약
          </Button>
          <Button
            variant={view === 'articles' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setView('articles');
              setArticlePage(1);
            }}
          >
            <Newspaper className="h-4 w-4 mr-1" />
            기사
          </Button>
          <Button
            variant={view === 'videos' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setView('videos');
              setVideoPage(1);
            }}
          >
            <Video className="h-4 w-4 mr-1" />
            영상
          </Button>
          <Button
            variant={view === 'comments' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setView('comments');
              setCommentPage(1);
              setSelectedArticleId(null);
            }}
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            댓글
          </Button>
          <Button
            variant={view === 'search' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('search')}
          >
            <Search className="h-4 w-4 mr-1" />
            의미 검색
          </Button>
        </div>
        {onNavigateToExplore && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateToExplore(sourceFilter ?? undefined)}
          >
            {sourceFilter ? `이 소스 탐색에서 분석 →` : '탐색에서 분석 →'}
          </Button>
        )}
      </div>

      {/* 데이터 소스 필터 (요약/검색 뷰 제외) */}
      {view !== 'summary' && view !== 'search' && availableSources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">소스:</span>
          <Button
            variant={sourceFilter === null ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setSourceFilter(null);
              resetPages();
            }}
          >
            전체
          </Button>
          {availableSources.map((s) => (
            <Button
              key={s.source}
              variant={sourceFilter === s.source ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setSourceFilter(s.source);
                resetPages();
              }}
            >
              {SOURCE_LABELS[s.source] ?? s.source}
              <span className="ml-1 text-[10px] opacity-70">{s.count}</span>
            </Button>
          ))}
        </div>
      )}

      {view === 'summary' && <SummaryView jobId={jobId} />}
      {view === 'articles' && (
        <ArticlesView
          jobId={jobId}
          page={articlePage}
          onPageChange={setArticlePage}
          source={sourceFilter}
          initialExpandedId={selectedArticleId}
        />
      )}
      {view === 'videos' && (
        <VideosView
          jobId={jobId}
          page={videoPage}
          onPageChange={setVideoPage}
          source={sourceFilter}
        />
      )}
      {view === 'comments' && (
        <CommentsView
          jobId={jobId}
          articleId={selectedArticleId}
          page={commentPage}
          onPageChange={setCommentPage}
          source={sourceFilter}
          onBack={() => {
            setSelectedArticleId(null);
            setView('articles');
          }}
        />
      )}
      {view === 'search' && <SemanticSearchPanel jobId={jobId} />}
    </div>
  );
}
