// 탐색 탭 차트 도움말 — card-help.tsx의 CardHelp 컴포넌트와 호환되는 형태
export const EXPLORE_HELP = {
  filters: {
    title: '탐색 필터',
    description:
      '수집된 원본 데이터를 직접 슬라이스하여 6개 차트에 동시 반영합니다. 필터는 기사·댓글의 BERT 감정 분석 결과를 기반으로 동작합니다.',
    details: [
      '소스: 복수 선택 가능 (체크 해제 시 전체)',
      '감정: 긍정/부정/중립 토글, 다중 선택 가능',
      '최소 확신도: BERT가 분류한 확률이 이 값 이상인 항목만 표시',
      '항목 타입: 기사·댓글·전체 중 선택',
    ],
    tips: [
      'ambiguous zone (확신도 0.4~0.65)에 있는 항목은 분류 신뢰도가 낮으니 slider를 0.65 이상으로 올려 확실한 데이터만 보세요',
      '특정 소스만 선택하면 그 플랫폼의 여론을 단독 분석할 수 있습니다',
    ],
    source: 'articles/comments 테이블 (BERT item-analyzer 결과)',
  },
  stream: {
    title: '감성 스트림 그래프',
    description:
      '일자별 긍정/부정/중립 건수의 적층 영역 차트입니다. Brandwatch·Talkwalker 등 소셜 리스닝 플랫폼의 표준 "Sentiment over time" 뷰와 동일한 포맷입니다.',
    details: [
      '100% 모드: 일별 감정 비율(정규화)을 보여줍니다',
      '절대량 모드: 일별 실제 건수를 그대로 보여줍니다',
      '시계열은 기사·댓글의 publishedAt 기준 일 단위 그룹',
    ],
    howToRead: [
      '100% 모드에서 빨강 영역이 커지는 날이 부정 여론이 집중된 날',
      '절대량 모드에서 전체 영역의 높이가 일별 발화량',
      '특정 일자에 급등이 있다면 그날 이벤트(기사·사건)를 확인해야 할 신호',
    ],
    source: 'getSentimentTimeSeries (articles/comments DB 집계)',
  },
  calendar: {
    title: '일자별 인텐시티 캘린더',
    description:
      'GitHub 기여도 그래프 스타일의 캘린더 히트맵입니다. NYT·FT 등 주요 언론사가 여론 데이터 시각화에 자주 사용하는 포맷으로, 날짜 패턴(요일·주 단위 주기성)을 한눈에 볼 수 있습니다.',
    details: [
      '셀 색상: 그날의 지배 감정 (긍정/부정/중립 중 최다)',
      '셀 명도: 전체 건수에 비례 (진할수록 발화량 많음)',
      '요일별 세로 정렬 (월~일)',
    ],
    howToRead: [
      '특정 요일에 색이 진한 패턴 = 그 요일 정기적 여론 활성화',
      '연속된 진한 빨강 = 부정 여론 폭증 구간',
      '셀 hover로 정확한 건수와 감정 비율 확인',
    ],
    source: 'getSentimentTimeSeries (articles/comments DB 집계)',
  },
  scatter: {
    title: '인게이지먼트 × 감정 산점도',
    description:
      '댓글의 좋아요 수(영향력)와 BERT 확신도를 좌표로 삼아, 어떤 댓글이 실제로 여론에 영향을 주는지 찾아냅니다. 상위 500개 댓글을 샘플링합니다.',
    details: [
      'X축: 좋아요 수 (log 스케일 토글 가능)',
      'Y축: 감정 확신도 (0~1)',
      '점 색상: 긍정(파랑)/부정(빨강)/중립(회색)',
      '점 클릭 시 원문 모달',
    ],
    howToRead: [
      '우상단 부정 군집 = 영향력 있는 강한 부정 댓글 (최우선 대응)',
      '우상단 긍정 군집 = 바이럴 가능한 긍정 콘텐츠',
      '하단 영역 = 확신도 낮음, 분류 신뢰도 주의',
    ],
    source: 'getEngagementScatter (comments 테이블, likeCount 기준 상위 500)',
  },
  matrix: {
    title: '소스 × 감정 히트맵',
    description:
      '플랫폼별 감정 분포 매트릭스입니다. 각 행은 100%로 정규화되어 소스 간 성향 차이를 직접 비교할 수 있습니다.',
    details: [
      '행: 수집 소스 (네이버 뉴스, 유튜브, DC갤러리 등)',
      '열: 감정 (긍정/부정/중립)',
      '셀: 해당 (소스, 감정) 조합의 비율과 카운트',
      '행 클릭 시 해당 소스로 필터 적용',
    ],
    howToRead: [
      '특정 행의 부정 셀이 유독 진하면 그 플랫폼에서 부정 여론 집중',
      '모든 행이 비슷한 분포면 전방위적 여론',
      '유튜브 부정 비율이 극단적이면 안티 팬덤 활성화',
    ],
    source: 'getSentimentBySource',
  },
  histogram: {
    title: 'BERT 확신도 분포',
    description:
      '분류기가 내린 확신도(0~1)의 분포 히스토그램입니다. 20개 빈으로 나뉘어 있고, 0.4~0.65 "ambiguous zone"은 노란색 음영으로 강조됩니다.',
    details: [
      '빈: 20개 (각 0.05 간격)',
      'Stack: 긍정/부정/중립 색상 누적',
      'Ambiguous zone (노랑): 0.4 ≤ score < 0.65 — 분류 신뢰도 낮음',
    ],
    howToRead: [
      '분포가 0.9 이상에 치우치면 확실한 감정 데이터가 많다는 의미',
      'ambiguous zone에 과반이 몰려 있다면 BERT가 판단을 망설인 샘플이 많음',
      '높은 확신도에서 부정이 우세하면 강한 부정 여론',
    ],
    source: 'getScoreDistribution (sentiment_score width_bucket)',
    limitations: ['확신도는 라벨 확률일 뿐, 실제 감정의 "강도"를 의미하지 않습니다'],
  },
  treemap: {
    title: '키워드-감정 트리맵',
    description:
      '키워드별 출현 빈도(셀 크기)와 지배 감정(셀 색상)을 동시에 보여주는 트리맵입니다. Tableau·Power BI의 표준 여론 시각화 포맷입니다.',
    details: [
      '셀 크기: 해당 키워드 출현 빈도',
      '셀 색상: 키워드에 연결된 감정',
      '데이터 출처: sentiment-framing 모듈의 topKeywords',
    ],
    howToRead: [
      '큰 빨간 셀 = 부정 여론의 핵심 단어',
      '큰 파란 셀 = 긍정 여론의 핵심 단어',
      '서로 크기가 비슷한 여러 키워드가 섞이면 여론의 프레임이 분산',
    ],
    source: 'analysis_results.sentiment-framing.topKeywords',
  },
} as const;

// 감정 색상 — dashboard/sentiment-chart.tsx COLORS와 동일
export const SENTIMENT_COLORS = {
  positive: 'hsl(142 71% 45%)', // green
  negative: 'hsl(0 84% 60%)', // red
  neutral: 'hsl(240 5% 64%)', // gray
} as const;

export type SentimentKey = keyof typeof SENTIMENT_COLORS;
