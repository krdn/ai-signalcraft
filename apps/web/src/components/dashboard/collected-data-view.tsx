'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Newspaper,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  BarChart3,
  ArrowLeft,
} from 'lucide-react';

// 감정 분석 뱃지 설정
const SENTIMENT_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  positive: { label: '긍정', variant: 'default', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  negative: { label: '부정', variant: 'destructive', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800' },
  neutral: { label: '중립', variant: 'secondary', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
};

function SentimentBadge({ sentiment, score }: { sentiment: string | null; score: number | null }) {
  if (!sentiment) return null;
  const config = SENTIMENT_CONFIG[sentiment];
  if (!config) return null;
  return (
    <Badge variant="outline" className={`text-[10px] h-5 ${config.className}`}>
      {config.label}{score != null ? ` ${Math.round(score * 100)}%` : ''}
    </Badge>
  );
}

// 소스 한글 라벨
const SOURCE_LABELS: Record<string, string> = {
  'naver-news': '네이버 뉴스',
  youtube: '유튜브',
  dcinside: 'DC갤러리',
  fmkorea: '에펨코리아',
  clien: '클리앙',
};

interface CollectedDataViewProps {
  jobId: number | null;
}

export function CollectedDataView({ jobId }: CollectedDataViewProps) {
  const [view, setView] = useState<'summary' | 'articles' | 'comments'>('summary');
  const [articlePage, setArticlePage] = useState(1);
  const [commentPage, setCommentPage] = useState(1);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);

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
      {/* 뷰 전환 탭 */}
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
          onClick={() => { setView('articles'); setArticlePage(1); }}
        >
          <Newspaper className="h-4 w-4 mr-1" />
          기사
        </Button>
        <Button
          variant={view === 'comments' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setView('comments'); setCommentPage(1); setSelectedArticleId(null); }}
        >
          <MessageSquare className="h-4 w-4 mr-1" />
          댓글
        </Button>
      </div>

      {view === 'summary' && <SummaryView jobId={jobId} />}
      {view === 'articles' && (
        <ArticlesView
          jobId={jobId}
          page={articlePage}
          onPageChange={setArticlePage}
          onViewComments={(articleId) => {
            setSelectedArticleId(articleId);
            setCommentPage(1);
            setView('comments');
          }}
        />
      )}
      {view === 'comments' && (
        <CommentsView
          jobId={jobId}
          articleId={selectedArticleId}
          page={commentPage}
          onPageChange={setCommentPage}
          onBack={() => { setSelectedArticleId(null); setView('articles'); }}
        />
      )}
    </div>
  );
}

// 수집 통계 요약
function SummaryView({ jobId }: { jobId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['collectedData', 'getSummary', jobId],
    queryFn: () => trpcClient.collectedData.getSummary.query({ jobId }),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-20" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Newspaper className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalArticles}</p>
                <p className="text-sm text-muted-foreground">수집된 기사</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalComments}</p>
                <p className="text-sm text-muted-foreground">수집된 댓글</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.sourceBreakdown.length}</p>
                <p className="text-sm text-muted-foreground">수집 소스</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 소스별 분포 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">소스별 기사 분포</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.sourceBreakdown.map((s) => (
              <div key={s.source} className="flex items-center justify-between">
                <span className="text-sm font-medium">{SOURCE_LABELS[s.source] ?? s.source}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, (s.count / data.totalArticles) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">{s.count}건</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 수집 기간 */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>키워드: <span className="font-medium text-foreground">{data.keyword}</span></span>
          <span>
            {new Date(data.period.start).toLocaleDateString('ko-KR')} ~ {new Date(data.period.end).toLocaleDateString('ko-KR')}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

// 기사 목록 뷰
function ArticlesView({
  jobId,
  page,
  onPageChange,
  onViewComments,
}: {
  jobId: number;
  page: number;
  onPageChange: (page: number) => void;
  onViewComments: (articleId: number) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['collectedData', 'getArticles', jobId, page],
    queryFn: () => trpcClient.collectedData.getArticles.query({ jobId, page, perPage: 10 }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          수집된 기사가 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        총 {data.total}건의 기사 (페이지 {data.page}/{data.totalPages})
      </p>

      {data.items.map((article) => (
        <Card key={article.id} className="hover:bg-accent/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs shrink-0">
                    {SOURCE_LABELS[article.source] ?? article.source}
                  </Badge>
                  {article.publisher && (
                    <span className="text-xs text-muted-foreground truncate">{article.publisher}</span>
                  )}
                  <SentimentBadge sentiment={article.sentiment} score={article.sentimentScore} />
                </div>
                <h3 className="font-medium text-sm leading-snug line-clamp-2">{article.title}</h3>
                {article.summary && (
                  <p className="text-xs text-primary/80 mt-1">AI 요약: {article.summary}</p>
                )}
                {article.content && !article.summary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.content.substring(0, 200)}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {article.publishedAt && (
                    <span>{new Date(article.publishedAt).toLocaleDateString('ko-KR')}</span>
                  )}
                  {article.author && <span>· {article.author}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onViewComments(article.id)}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  댓글
                </Button>
                {article.url && (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center h-7 px-2 text-xs rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    원문
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* 페이지네이션 */}
      {data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

// 댓글 목록 뷰
function CommentsView({
  jobId,
  articleId,
  page,
  onPageChange,
  onBack,
}: {
  jobId: number;
  articleId: number | null;
  page: number;
  onPageChange: (page: number) => void;
  onBack: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['collectedData', 'getComments', jobId, articleId, page],
    queryFn: () => trpcClient.collectedData.getComments.query({
      jobId,
      ...(articleId ? { articleId } : {}),
      page,
      perPage: 20,
    }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}><CardContent className="p-3"><Skeleton className="h-12" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-3">
        {articleId && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            기사 목록으로
          </Button>
        )}
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            수집된 댓글이 없습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {articleId && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              기사 목록
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            총 {data.total}건의 댓글 (페이지 {data.page}/{data.totalPages})
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {data.items.map((comment) => (
          <Card key={comment.id} className={`border-l-2 transition-colors ${
            comment.sentiment === 'positive' ? 'border-l-blue-400' :
            comment.sentiment === 'negative' ? 'border-l-red-400' :
            comment.sentiment === 'neutral' ? 'border-l-gray-300' :
            'border-l-transparent'
          } hover:bg-accent/30`}>
            <CardContent className="p-3">
              <p className="text-sm leading-relaxed">{comment.content}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{comment.author ?? '익명'}</span>
                {comment.publishedAt && (
                  <span>{new Date(comment.publishedAt).toLocaleDateString('ko-KR')}</span>
                )}
                <span className="flex items-center gap-0.5">
                  <ThumbsUp className="h-3 w-3" /> {comment.likeCount ?? 0}
                </span>
                {(comment.dislikeCount ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5">
                    <ThumbsDown className="h-3 w-3" /> {comment.dislikeCount}
                  </span>
                )}
                <Badge variant="outline" className="text-[10px] h-4">
                  {SOURCE_LABELS[comment.source] ?? comment.source}
                </Badge>
                <SentimentBadge sentiment={comment.sentiment} score={comment.sentimentScore} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

// 페이지네이션 컴포넌트
function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
