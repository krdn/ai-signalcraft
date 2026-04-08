/**
 * 화이트페이퍼 슬라이드 데이터
 * - 모듈 정보는 landing/data/modules.ts 를 재사용 (단일 진실 원천)
 * - 영업사원이 직접 보면서 설명할 수 있도록 핵심 메시지를 슬라이드 단위로 압축
 */

export interface SourceItem {
  name: string;
  desc: string;
  signal: string;
}

export const COLLECTION_SOURCES: SourceItem[] = [
  {
    name: '네이버 뉴스',
    desc: '주류 미디어 의제 + 댓글 여론',
    signal: '기사 본문, 댓글, 좋아요/싫어요',
  },
  {
    name: '네이버 댓글',
    desc: '기사별 시민 반응 정밀 수집',
    signal: '댓글 어투, 추천수, 반대수',
  },
  {
    name: '유튜브 영상',
    desc: '진영별 채널 이슈 점유율',
    signal: '제목, 설명, 조회수, 좋아요',
  },
  {
    name: '유튜브 댓글',
    desc: '영상 단위 시청자 반응 측정',
    signal: '댓글 좋아요·답글 트리',
  },
  {
    name: '커뮤니티(DC/클리앙/FM코리아)',
    desc: '진영별 핵심 지지층 원음(原音)',
    signal: '게시글, 댓글, 좋아요/싫어요',
  },
];

export interface ModelStrategy {
  stage: string;
  model: string;
  reason: string;
  examples: string;
}

export const MODEL_STRATEGY: ModelStrategy[] = [
  {
    stage: 'Stage 1 (4개)',
    model: 'Gemini 2.5 Flash',
    reason: '대량 텍스트를 빠르고 저비용으로 분류·요약',
    examples: '거시 여론, 집단별 반응, 감정/프레임, 메시지 파급력',
  },
  {
    stage: 'Stage 2 (3개)',
    model: 'Claude Sonnet 4.6',
    reason: '복합 추론·전략 도출은 품질 우선',
    examples: '리스크 지도, 기회 분석, 전략 도출',
  },
  {
    stage: 'Stage 3 (1개)',
    model: 'Claude Sonnet 4.6',
    reason: '의사결정자 브리핑 압축은 표현력 핵심',
    examples: '최종 요약 (한 줄 30~50자)',
  },
  {
    stage: 'Stage 4 (4개)',
    model: 'Claude Sonnet 4.6',
    reason: '11개 선행 결과를 종합 추론하는 고난도 분석',
    examples: '지지율 추정, 프레임 전쟁, 위기 시나리오, 승리 시뮬레이션',
  },
];

export interface UseCase {
  title: string;
  who: string;
  problem: string;
  solution: string;
}

export const USE_CASES: UseCase[] = [
  {
    title: '선거 캠프',
    who: '국회의원/지자체장 후보 캠프',
    problem: '매일 수십 개 매체를 사람이 따라가지 못함, 위기 징후를 늦게 발견',
    solution: '아침 브리핑 자동 생성 + Top 3 리스크 즉시 알림 + 메시지 효과 측정',
  },
  {
    title: 'PR / 위기관리 에이전시',
    who: '대기업·공공기관·정치인 PR 컨설팅',
    problem: '클라이언트별 모니터링 인력 부족, 주간 리포트 작성에 며칠 소요',
    solution: '클라이언트별 분석 1~3시간 내 완성 + 시나리오별 대응 플랜 자동 생성',
  },
  {
    title: '공공기관 홍보팀',
    who: '정부 부처, 지자체, 공공기관',
    problem: '정책 발표 후 여론 반응 추적이 주관적이고 늦음',
    solution: '발표 전후 여론 변곡점·프레임 전쟁 정량 분석으로 정책 커뮤니케이션 개선',
  },
  {
    title: '정치 컨설팅 / 싱크탱크',
    who: '여론조사 회사, 정책 연구소',
    problem: '오프라인 여론조사로는 잡히지 않는 온라인 결집·이탈 신호 부재',
    solution: '플랫폼 편향 보정 지지율 + 프레임 세력 지도로 조사 보완',
  },
];

export interface Differentiator {
  icon: string;
  title: string;
  desc: string;
}

export const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: 'Zap',
    title: '수일 → 1~3시간',
    desc: '5개 소스 자동 수집 + 14개 모듈 병렬 분석으로 의사결정 속도 20배 단축',
  },
  {
    icon: 'Layers',
    title: '14개 모듈 다각도',
    desc: '감정·프레임·리스크·기회·전략·시나리오·지지율까지 한 번에 — 한 도구로 전 영역 커버',
  },
  {
    icon: 'Cpu',
    title: '멀티 LLM 전략',
    desc: 'Gemini(속도) + Claude(품질) 모듈별 최적 배치 — 한 AI 의존 편향 회피',
  },
  {
    icon: 'TrendingUp',
    title: '예측형 시뮬레이션',
    desc: '단순 리포트가 아니라 위기 시나리오·승리 확률 시뮬레이션으로 "다음 수" 제시',
  },
  {
    icon: 'Shield',
    title: '플랫폼 편향 보정',
    desc: '네이버/클리앙/유튜브 등 매체별 정치 편향을 보정한 신뢰 가능한 지표',
  },
  {
    icon: 'Users',
    title: '소규모 팀 최적화',
    desc: '3~10명 팀이 즉시 도입 가능 — 엔터프라이즈 도구 대비 학습 곡선 낮음',
  },
];
