'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, ThumbsUp, ThumbsDown, ExternalLink, ArrowLeft, Eye } from 'lucide-react';
import { SentimentBadge, SOURCE_LABELS, Pagination } from './collected-data-shared';
import { trpcClient } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// --- Props 타입 정의 ---

export interface ArticlesViewProps {
  jobId: number;
  page: number;
  onPageChange: (page: number) => void;
  source?: string | null;
  initialExpandedId?: number | null;
}

export interface VideosViewProps {
  jobId: number;
  page: number;
  onPageChange: (page: number) => void;
  source?: string | null;
}

export interface CommentsViewProps {
  jobId: number;
  articleId: number | null;
  page: number;
  onPageChange: (page: number) => void;
  onBack: () => void;
  source?: string | null;
}

// --- 기사 내 인라인 댓글 뷰 ---

function InlineCommentsView({ jobId, articleId }: { jobId: number; articleId: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['collectedData', 'getComments', jobId, articleId, page],
    queryFn: () =>
      trpcClient.collectedData.getComments.query({
        jobId,
        articleId,
        page,
        perPage: 10,
      }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        이 기사에 수집된 댓글이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        댓글 {data.total}건 {data.totalPages > 1 ? `(${data.page}/${data.totalPages})` : ''}
      </p>

      {data.items.map((comment) => (
        <div
          key={comment.id}
          className={`rounded-md border bg-background p-3 border-l-2 ${
            comment.sentiment === 'positive'
              ? 'border-l-blue-400'
              : comment.sentiment === 'negative'
                ? 'border-l-red-400'
                : comment.sentiment === 'neutral'
                  ? 'border-l-gray-300'
                  : 'border-l-transparent'
          }`}
        >
          <p className="text-sm leading-relaxed">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
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
            <SentimentBadge sentiment={comment.sentiment} score={comment.sentimentScore} />
          </div>
        </div>
      ))}

      {data.totalPages > 1 && (
        <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

// --- 영상 내 인라인 댓글 뷰 ---

function InlineVideoCommentsView({ jobId, videoId }: { jobId: number; videoId: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['collectedData', 'getComments', jobId, 'video', videoId, page],
    queryFn: () =>
      trpcClient.collectedData.getComments.query({
        jobId,
        videoId,
        page,
        perPage: 10,
      }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        이 영상에 수집된 댓글이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        댓글 {data.total}건 {data.totalPages > 1 ? `(${data.page}/${data.totalPages})` : ''}
      </p>

      {data.items.map((comment) => (
        <div
          key={comment.id}
          className={`rounded-md border bg-background p-3 border-l-2 ${
            comment.sentiment === 'positive'
              ? 'border-l-blue-400'
              : comment.sentiment === 'negative'
                ? 'border-l-red-400'
                : comment.sentiment === 'neutral'
                  ? 'border-l-gray-300'
                  : 'border-l-transparent'
          }`}
        >
          <p className="text-sm leading-relaxed">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
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
            <SentimentBadge sentiment={comment.sentiment} score={comment.sentimentScore} />
          </div>
        </div>
      ))}

      {data.totalPages > 1 && (
        <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

// --- 기사 목록 뷰 ---

export function ArticlesView({
  jobId,
  page,
  onPageChange,
  source,
  initialExpandedId,
}: ArticlesViewProps) {
  const [expandedArticleId, setExpandedArticleId] = useState<number | null>(
    initialExpandedId ?? null,
  );
  const { data, isLoading } = useQuery({
    queryKey: ['collectedData', 'getArticles', jobId, page, source],
    queryFn: () =>
      trpcClient.collectedData.getArticles.query({
        jobId,
        page,
        perPage: 10,
        ...(source ? { source } : {}),
      }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16" />
            </CardContent>
          </Card>
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

      {data.items.map((article) => {
        const isExpanded = expandedArticleId === article.id;
        const commentCount =
          (article as typeof article & { commentCount?: number }).commentCount ?? 0;

        return (
          <Card key={article.id} className="transition-colors overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {SOURCE_LABELS[article.source] ?? article.source}
                    </Badge>
                    {article.publisher && (
                      <span className="text-xs text-muted-foreground truncate">
                        {article.publisher}
                      </span>
                    )}
                    <SentimentBadge sentiment={article.sentiment} score={article.sentimentScore} />
                  </div>
                  <h3 className="font-medium text-sm leading-snug line-clamp-2">{article.title}</h3>
                  {article.summary && (
                    <p className="text-xs text-primary/80 mt-1">AI 요약: {article.summary}</p>
                  )}
                  {article.content && !article.summary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {article.content.substring(0, 200)}
                    </p>
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
                    variant={isExpanded ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setExpandedArticleId(isExpanded ? null : article.id)}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {commentCount > 0 ? `${commentCount}` : '댓글'}
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

            {/* 인라인 댓글 아코디언 */}
            {isExpanded && (
              <div className="border-t bg-muted/30 px-4 py-3">
                <InlineCommentsView jobId={jobId} articleId={article.id} />
              </div>
            )}
          </Card>
        );
      })}

      {/* 페이지네이션 */}
      {data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onPageChange={(p) => {
            setExpandedArticleId(null);
            onPageChange(p);
          }}
        />
      )}
    </div>
  );
}

// --- 영상 목록 뷰 ---

export function VideosView({ jobId, page, onPageChange, source }: VideosViewProps) {
  const [expandedVideoId, setExpandedVideoId] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['collectedData', 'getVideos', jobId, page, source],
    queryFn: () =>
      trpcClient.collectedData.getVideos.query({
        jobId,
        page,
        perPage: 10,
        ...(source ? { source } : {}),
      }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          수집된 영상이 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        총 {data.total}건의 영상 (페이지 {data.page}/{data.totalPages})
      </p>

      {data.items.map((video) => {
        const isExpanded = expandedVideoId === video.id;
        const commentCount = video.commentCount ?? 0;

        return (
          <Card key={video.id} className="transition-colors overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className="text-xs shrink-0 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                    >
                      유튜브
                    </Badge>
                    {video.channelTitle && (
                      <span className="text-xs text-muted-foreground truncate">
                        {video.channelTitle}
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-sm leading-snug line-clamp-2">{video.title}</h3>
                  {video.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {video.description.substring(0, 200)}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {video.publishedAt && (
                      <span>{new Date(video.publishedAt).toLocaleDateString('ko-KR')}</span>
                    )}
                    {video.viewCount != null && (
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-3 w-3" /> {video.viewCount.toLocaleString()}
                      </span>
                    )}
                    {video.likeCount != null && (
                      <span className="flex items-center gap-0.5">
                        <ThumbsUp className="h-3 w-3" /> {video.likeCount.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant={isExpanded ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setExpandedVideoId(isExpanded ? null : video.id)}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {commentCount > 0 ? `${commentCount}` : '댓글'}
                  </Button>
                  {video.url && (
                    <a
                      href={video.url}
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

            {/* 인라인 댓글 아코디언 */}
            {isExpanded && (
              <div className="border-t bg-muted/30 px-4 py-3">
                <InlineVideoCommentsView jobId={jobId} videoId={video.id} />
              </div>
            )}
          </Card>
        );
      })}

      {/* 페이지네이션 */}
      {data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onPageChange={(p) => {
            setExpandedVideoId(null);
            onPageChange(p);
          }}
        />
      )}
    </div>
  );
}

// --- 댓글 목록 뷰 ---

export function CommentsView({
  jobId,
  articleId,
  page,
  onPageChange,
  onBack,
  source,
}: CommentsViewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['collectedData', 'getComments', jobId, articleId, page, source],
    queryFn: () =>
      trpcClient.collectedData.getComments.query({
        jobId,
        ...(articleId ? { articleId } : {}),
        ...(source ? { source } : {}),
        page,
        perPage: 20,
      }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <Skeleton className="h-12" />
            </CardContent>
          </Card>
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
          <Card
            key={comment.id}
            className={`border-l-2 transition-colors ${
              comment.sentiment === 'positive'
                ? 'border-l-blue-400'
                : comment.sentiment === 'negative'
                  ? 'border-l-red-400'
                  : comment.sentiment === 'neutral'
                    ? 'border-l-gray-300'
                    : 'border-l-transparent'
            } hover:bg-accent/30`}
          >
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
        <Pagination page={data.page} totalPages={data.totalPages} onPageChange={onPageChange} />
      )}
    </div>
  );
}
