// ManipulationDataLoader 인터페이스 — signals/* 내부 타입에 의존하므로
// types.ts에 두면 manipulation/types ↔ signals/* 순환 의존이 발생한다.
// 별도 파일로 분리해 사이클 회피 (collector-loader.ts와 동일 import 그래프).
import type { SignalContext, CommentRow } from './types';
import type { VoteRow } from './signals/vote';
import type { EmbeddedItem } from './signals/similarity';
import type { ArticleEmbedded } from './signals/media-sync';
import type { TrendPoint } from './signals/trend-shape';

export type ManipulationDataLoader = {
  loadComments(ctx: SignalContext): Promise<CommentRow[]>;
  loadVotes(ctx: SignalContext): Promise<VoteRow[]>;
  loadEmbeddedComments(ctx: SignalContext): Promise<EmbeddedItem[]>;
  loadEmbeddedArticles(ctx: SignalContext): Promise<ArticleEmbedded[]>;
  loadTrendSeries(ctx: SignalContext): Promise<TrendPoint[]>;
  loadTemporalBaselines(ctx: SignalContext): Promise<Record<string, number[]>>;
};
