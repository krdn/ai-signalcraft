import type { CollectorClient } from '../../../collector-client';
import type {
  ManipulationDataLoader,
  SignalContext,
  CommentRow,
  EmbeddedItem,
  ArticleEmbedded,
  TrendPoint,
} from '../types';
import type { VoteRow } from '../signals/vote';

const COMMENT_QUERY_LIMIT = 10000;
const ARTICLE_QUERY_LIMIT = 10000;
const BUCKET_MS = 5 * 60 * 1000;

export type CollectorLoaderArgs = {
  client: CollectorClient;
  subscriptionId: number;
  sources: string[];
  dateRange: { start: Date; end: Date };
  baselineDays: number;
};

type CommentItem = {
  itemType: 'comment';
  source: string;
  itemId?: string;
  sourceId?: string;
  parentSourceId: string | null;
  time: string;
  content: string | null;
  author: string | null;
  metrics?: { likeCount?: number } | null;
  embedding?: number[] | null;
};

type ArticleItem = {
  itemType: 'article' | 'video';
  source: string;
  itemId?: string;
  sourceId?: string;
  publisher: string | null;
  title: string | null;
  time: string;
  embedding?: number[] | null;
};

export function createCollectorManipulationLoader(
  args: CollectorLoaderArgs,
): ManipulationDataLoader {
  let _commentRaw: CommentItem[] | null = null;
  let _articleRaw: ArticleItem[] | null = null;
  let _baselines: Record<string, number[]> | null = null;

  const dateRange = {
    start: args.dateRange.start.toISOString(),
    end: args.dateRange.end.toISOString(),
  };

  async function fetchComments(): Promise<CommentItem[]> {
    if (_commentRaw) return _commentRaw;
    const result = await args.client.items.query.query({
      subscriptionId: args.subscriptionId,
      dateRange,
      sources: args.sources.length > 0 ? (args.sources as never) : undefined,
      itemTypes: ['comment'],
      mode: 'all',
      scope: 'all',
      includeEmbeddings: true,
      limit: COMMENT_QUERY_LIMIT,
    });
    _commentRaw = (result.items ?? []) as CommentItem[];
    return _commentRaw;
  }

  async function fetchArticles(): Promise<ArticleItem[]> {
    if (_articleRaw) return _articleRaw;
    const result = await args.client.items.query.query({
      subscriptionId: args.subscriptionId,
      dateRange,
      sources: args.sources.length > 0 ? (args.sources as never) : undefined,
      itemTypes: ['article', 'video'],
      mode: 'all',
      scope: 'all',
      includeEmbeddings: true,
      limit: ARTICLE_QUERY_LIMIT,
    });
    _articleRaw = (result.items ?? []) as ArticleItem[];
    return _articleRaw;
  }

  return {
    async loadComments(_ctx: SignalContext): Promise<CommentRow[]> {
      const raw = await fetchComments();
      return raw.map((r) => ({
        itemId: r.itemId ?? r.sourceId ?? '',
        parentSourceId: r.parentSourceId ?? '',
        source: r.source,
        time: new Date(r.time),
        excerpt: (r.content ?? '').slice(0, 280),
      }));
    },

    async loadVotes(_ctx: SignalContext): Promise<VoteRow[]> {
      const raw = await fetchComments();
      return raw.map((r) => ({
        itemId: r.itemId ?? r.sourceId ?? '',
        source: r.source,
        parentSourceId: r.parentSourceId ?? '',
        length: (r.content ?? '').length,
        likeCount: r.metrics?.likeCount ?? 0,
        time: new Date(r.time),
      }));
    },

    async loadEmbeddedComments(_ctx: SignalContext): Promise<EmbeddedItem[]> {
      const raw = await fetchComments();
      return raw
        .filter((r) => Array.isArray(r.embedding) && r.embedding.length > 0)
        .map((r) => ({
          itemId: r.itemId ?? r.sourceId ?? '',
          source: r.source,
          author: r.author,
          text: r.content ?? '',
          embedding: r.embedding!,
          time: new Date(r.time),
        }));
    },

    async loadEmbeddedArticles(_ctx: SignalContext): Promise<ArticleEmbedded[]> {
      const raw = await fetchArticles();
      return raw
        .filter((r) => Array.isArray(r.embedding) && r.embedding.length > 0 && r.publisher)
        .map((r) => ({
          itemId: r.itemId ?? r.sourceId ?? '',
          publisher: r.publisher!,
          headline: r.title ?? '',
          embedding: r.embedding!,
          time: new Date(r.time),
        }));
    },

    async loadTrendSeries(_ctx: SignalContext): Promise<TrendPoint[]> {
      const raw = await fetchComments();
      if (raw.length === 0) return [];
      const buckets = new Map<number, number>();
      for (const c of raw) {
        const t = new Date(c.time).getTime();
        const bucketKey = Math.floor(t / BUCKET_MS) * BUCKET_MS;
        buckets.set(bucketKey, (buckets.get(bucketKey) ?? 0) + 1);
      }
      return [...buckets.entries()]
        .sort(([a], [b]) => a - b)
        .map(([ts, count]) => ({ ts: new Date(ts).toISOString(), count }));
    },

    async loadTemporalBaselines(_ctx: SignalContext): Promise<Record<string, number[]>> {
      if (_baselines) return _baselines;
      const result = await args.client.items.fetchManipulationBaselines.query({
        subscriptionId: args.subscriptionId,
        referenceEnd: args.dateRange.end.toISOString(),
        referenceStart: args.dateRange.start.toISOString(),
        days: args.baselineDays,
      });
      _baselines = result.byHour;
      return _baselines;
    },
  };
}
