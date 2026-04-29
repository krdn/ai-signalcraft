// 분석 모듈 & 소스 한글 라벨 매핑
export const MODULE_LABELS: Record<string, string> = {
  'sentiment-framing': '감정 프레이밍 (Sentiment Framing)',
  'macro-view': '거시 분석 (Macro View)',
  segmentation: '세그멘테이션 (Segmentation)',
  'message-impact': '메시지 임팩트 (Message Impact)',
  'risk-map': '리스크 맵 (Risk Map)',
  opportunity: '기회 발굴 (Opportunity)',
  strategy: '전략 제안 (Strategy)',
  'final-summary': '종합 요약 (Final Summary)',
  'approval-rating': '지지율 분석 (Approval Rating)',
  'frame-war': '프레임 전쟁 (Frame War)',
  'crisis-scenario': '위기 시나리오 (Crisis Scenario)',
  'win-simulation': '승리 시뮬레이션 (Win Simulation)',
};

export const SOURCE_LABELS: Record<string, string> = {
  'naver-news': '네이버 뉴스',
  'youtube-videos': '유튜브',
  'youtube-comments': '유튜브 댓글',
  'naver-comments': '네이버 댓글',
  dcinside: 'DC갤러리',
  fmkorea: '에펨코리아',
  clien: '클리앙',
  naver: '네이버 뉴스',
  youtube: '유튜브',
};

/** progress 객체에서 소스 레인이 아닌 파이프라인 단계 키 목록 */
export const PIPELINE_STAGE_KEYS = new Set([
  'sampling',
  'normalization',
  'token-optimization',
  'item-analysis',
  'report',
]);

export const MODULE_STAGE: Record<string, number> = {
  'macro-view': 1,
  segmentation: 1,
  'sentiment-framing': 1,
  'message-impact': 1,
  'risk-map': 2,
  opportunity: 2,
  strategy: 2,
  'final-summary': 3,
  'approval-rating': 4,
  'frame-war': 4,
  'crisis-scenario': 4,
  'win-simulation': 4,
};
