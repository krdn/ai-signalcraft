// 수집 데이터 조회 라우터 — procedure별로 파일 분할 후 조립
//
// 각 procedure는:
//   - 일반 잡: web DB 조인 테이블(article_jobs / video_jobs / comment_jobs) 직접 쿼리
//   - 구독 잡 (useCollectorLoader 또는 subscriptionId 보유): collector tRPC API 위임
// 두 경로의 응답 shape를 동일하게 맞춰서 클라이언트가 분기 인지하지 않도록 한다.

import { router } from '../../init';
import { getArticles } from './get-articles';
import { getVideos } from './get-videos';
import { getComments } from './get-comments';
import { getSummary } from './get-summary';
import { getCollectionStats } from './get-collection-stats';

export const collectedDataRouter = router({
  getArticles,
  getVideos,
  getComments,
  getSummary,
  getCollectionStats,
});
