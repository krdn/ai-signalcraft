// items 라우터 — procedure별로 파일 분할 후 조립.
//
// 모든 procedure는 rawItems 테이블(timescaledb)을 시간 윈도우 + subscriptionId/sources
// 필터로 조회. 네이버 뉴스 fan-out 정규화(naver-comments → naver-news)는 카드 표시
// 컨텍스트(commentCountByParent, sentimentBySource* 등)에서만 적용한다.

import { router } from '../init';
import { query } from './query';
import { stats } from './stats';
import { commentCountByParent } from './comment-count-by-parent';
import { collectionStats } from './collection-stats';
import { sentimentBySource } from './sentiment-by-source';
import { sentimentTimeSeries } from './sentiment-time-series';
import { sentimentBySourceMatrix } from './sentiment-by-source-matrix';
import { scoreDistribution } from './score-distribution';
import { engagementScatter } from './engagement-scatter';
import { fetchAnalysisPayload } from './fetch-analysis-payload';

// 기존 import 호환을 위해 input schema도 re-export
export { queryInput, fetchAnalysisPayloadInput } from './_shared';

export const itemsRouter = router({
  query,
  stats,
  commentCountByParent,
  collectionStats,
  sentimentBySource,
  sentimentTimeSeries,
  sentimentBySourceMatrix,
  scoreDistribution,
  engagementScatter,
  fetchAnalysisPayload,
});
