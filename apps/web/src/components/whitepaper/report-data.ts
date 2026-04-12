/**
 * 화이트페이퍼 리포트 — 14개 모듈 상세 데이터
 *
 * 각 모듈에 대해:
 *  - 모듈 ID / 한국어 표시명 / 사용 모델 / Stage
 *  - role: 시스템 프롬프트가 가장하는 전문가 역할
 *  - whatItDoes: 무엇을 분석하는가 (1~2문단)
 *  - methodology: 방법론 (분석 절차/원칙)
 *  - inputs: 입력 데이터 / 선행 모듈 의존성
 *  - outputs: 주요 출력 필드
 *  - howToUse: 영업/실무 활용법 (의사결정자 관점)
 *  - theory: 이론적 기반 (학술 근거)
 *  - sources: 출처 (학술 + 실무)
 *
 * 출처는 실제로 검증된 학술/실무 표준 문헌만 인용합니다.
 */

export interface ReportSource {
  label: string;
  detail: string;
}

export type ReportStage =
  | 'Stage 1'
  | 'Stage 2'
  | 'Stage 3'
  | 'Stage 4'
  | 'System'
  | 'Stage 4-F'
  | 'Stage 4-PR'
  | 'Stage 4-Corp'
  | 'Stage 4-HC'
  | 'Stage 4-SP'
  | 'Stage 4-Policy'
  | 'Stage 4-Edu'
  | 'Stage 4-PS'
  | 'Stage 4-Legal'
  | 'Stage 4-Retail'
  | 'Stage 4-Fin';

export interface ReportModule {
  id: string;
  no: number;
  displayName: string;
  enName: string;
  stage: ReportStage;
  stageLabel: string;
  model: string;
  role: string;
  whatItDoes: string;
  methodology: string[];
  inputs: string;
  outputs: { field: string; desc: string }[];
  howToUse: string[];
  theory: string;
  sources: ReportSource[];
}

export const REPORT_MODULES: ReportModule[] = [
  /* ─────────── Stage 1 ─────────── */
  {
    id: 'macro-view',
    no: 1,
    displayName: '전체 여론 구조',
    enName: 'Macro View',
    stage: 'Stage 1',
    stageLabel: '기초 분석 (병렬)',
    model: 'Gemini 2.5 Flash',
    role: '15년 경력 정치 여론 동향 분석가',
    whatItDoes:
      '수집된 모든 데이터(뉴스/유튜브/커뮤니티 댓글)를 시간축 위에 펼쳐서 "지난 N일 동안 여론이 어떻게 움직였는가"를 한 장의 서사(narrative)로 재구성합니다. 단순 감정 집계가 아니라 상승→정체→반전 같은 구조적 흐름을 포착하고, 이벤트와 반응의 인과관계를 추론해 변곡점(inflection point)을 짚어냅니다.',
    methodology: [
      '일별/주별 언급량 + 감정 분포 시계열 구성',
      '변곡점 탐지: 전후 감정 비율의 통계적 차이가 두드러지는 지점을 자동 식별',
      '각 변곡점에 대해 "어떤 이벤트가 트리거였는가"를 후보 이벤트와 매칭',
      '플랫폼별 편향(네이버 보수 / 클리앙 진보 / 유튜브 채널 다극화)을 보정한 종합 방향성 산출',
      '결과를 "상승국면 → 변곡 → 새 국면" 형태의 서사로 출력',
    ],
    inputs: '5개 소스의 정규화된 원시 데이터 (Stage 1, 선행 의존성 없음)',
    outputs: [
      { field: 'overallDirection', desc: '전체 여론 방향성 (positive/negative/mixed)' },
      { field: 'summary', desc: '핵심 흐름 3~5줄 요약' },
      { field: 'timeline', desc: '주요 이벤트 타임라인 (date, event, impact, description)' },
      { field: 'inflectionPoints', desc: '변곡점 (before/after sentiment, 트리거 이벤트)' },
      { field: 'dailyMentionTrend', desc: '일별 언급량 및 감성 추이 (차트 원천 데이터)' },
    ],
    howToUse: [
      '아침 브리핑 첫 페이지: "지금 우리가 어디 서 있는가" 한 장 답변',
      '주간/월간 보고서의 인트로 — 표·차트 그대로 인용 가능',
      '캠페인 이벤트(기자회견·공약 발표) 직후 효과 측정 (변곡점 발생 여부)',
      '"왜 어제 분위기가 바뀌었지?" 라는 의사결정자 질문에 즉답',
    ],
    theory:
      '어젠다 세팅(Agenda-Setting) 이론과 시계열 여론 분석에 기반합니다. 여론은 특정 시점의 스냅샷이 아니라 이슈 주기(issue-attention cycle)에 따라 움직이는 동적 프로세스이며, 미디어 노출과 대중 반응 사이의 시차·인과를 추적해야 의미 있는 해석이 가능하다는 것이 핵심입니다.',
    sources: [
      {
        label: 'McCombs & Shaw (1972) "The Agenda-Setting Function of Mass Media"',
        detail: 'Public Opinion Quarterly 36(2), 176-187. 어젠다 세팅 이론의 원전.',
      },
      {
        label: 'Downs (1972) "Up and Down with Ecology — the Issue-Attention Cycle"',
        detail: 'The Public Interest 28, 38-50. 이슈 주기 모델.',
      },
      {
        label: 'Page & Shapiro (1992) "The Rational Public"',
        detail: 'University of Chicago Press. 시계열 여론 데이터 50년치 분석.',
      },
    ],
  },
  {
    id: 'segmentation',
    no: 2,
    displayName: '집단별 반응 분석',
    enName: 'Segmentation',
    stage: 'Stage 1',
    stageLabel: '기초 분석 (병렬)',
    model: 'Gemini 2.5 Flash',
    role: '정치 여론 집단 역학(group dynamics) 분석 전문가',
    whatItDoes:
      '모든 댓글·게시글 작성자를 핵심 지지층(Core), 반대층(Opposition), 유동층(Swing) 세 집단으로 분류하고 각 집단의 규모, 결집력, 이탈 가능성, 영향력을 평가합니다. "전체 50% 부정"이 아니라 "Core는 결집, Swing은 이탈, Opposition은 결집" 같은 구조적 진단을 내립니다.',
    methodology: [
      '플랫폼별 사용자 특성을 가중치로 반영 (네이버 댓글 ≠ 클리앙 댓글)',
      '댓글 어투·반복 용어·좋아요 패턴에서 집단 정체성 추론',
      'Core/Opposition/Swing 삼분법 분류 + 각 집단 규모 추정',
      '집단별 결집도(높은 좋아요 집중 vs 분산) 평가',
      '가장 영향력 높은 집단(highInfluenceGroup) 선정 및 근거 제시',
    ],
    inputs: '5개 소스의 작성자 행동 데이터 (Stage 1, 독립)',
    outputs: [
      {
        field: 'platformSegments',
        desc: '플랫폼별 세분화 (sentiment, keyTopics, volume, characteristics)',
      },
      {
        field: 'audienceGroups',
        desc: '집단별 반응 (groupName, type: core/opposition/swing, influence)',
      },
      { field: 'highInfluenceGroup', desc: '가장 영향력 높은 집단과 그 이유' },
    ],
    howToUse: [
      '캠페인 타겟 결정 — "Core 결집 vs Swing 포섭" 비용 비교',
      'PR 메시지 톤 결정 — 집단별 어투에 맞춘 메시지 작성',
      '"우리 지지층이 흔들리는가?" 위기 신호 조기 감지',
      '여론조사 결과 해석 보완 — 평균 뒤에 숨은 집단 동학 노출',
    ],
    theory:
      'STP(Segmentation-Targeting-Positioning) 마케팅 이론을 정치 영역에 적용한 정치 시장 세분화(political market segmentation) 접근입니다. Pew Research의 Political Typology 연구가 대표적 실증 사례로, 평균값 뒤에 숨은 집단 구조를 드러내는 것이 효과적 캠페인 설계의 출발점이라는 것이 핵심 원칙입니다.',
    sources: [
      {
        label: 'Smith & Hirst (2001) "Strategic Political Segmentation"',
        detail: 'European Journal of Marketing 35(9/10). 정치 시장 세분화 방법론.',
      },
      {
        label: 'Pew Research Center "Political Typology" (1987~)',
        detail: '미국 유권자를 8~9개 정치 유형으로 분류하는 장기 연구 시리즈.',
      },
      {
        label: 'Newman (1994) "The Marketing of the President"',
        detail: 'Sage. 정치 캠페인 마케팅 모델.',
      },
    ],
  },
  {
    id: 'sentiment-framing',
    no: 3,
    displayName: '감정 및 프레임 분석',
    enName: 'Sentiment & Framing',
    stage: 'Stage 1',
    stageLabel: '기초 분석 (병렬)',
    model: 'Gemini 2.5 Flash',
    role: '미디어 프레이밍 이론 + 감성 분석 전문가',
    whatItDoes:
      '여론의 감정 분포(긍정/부정/중립)를 정량 산출하고, 동시에 "같은 사실을 어떻게 다르게 해석하는가" 즉 프레임의 경쟁 구조를 정성 분석합니다. 좋아요 수로 가중한 핵심 키워드 TOP 20을 추출하고, 지배적 프레임 vs 도전 프레임의 강도(1~10)를 측정합니다.',
    methodology: [
      '플랫폼별 편향을 보정한 감정 비율 산출 (단순 평균 금지)',
      '키워드 추출 시 좋아요 가중 빈도 사용 (인기 댓글의 키워드가 대표성)',
      '프레임 식별: 같은 사실을 다르게 해석하는 관점만 프레임으로 인정',
      '연관어 네트워크 분석: 함께 등장하면 의미가 변하는 키워드 조합 포착',
      '프레임 강도(1~10) 평가 + 지배적/도전 프레임 충돌 구조 도식화',
    ],
    inputs: '5개 소스의 텍스트·반응 데이터 (Stage 1, 독립)',
    outputs: [
      { field: 'sentimentRatio', desc: '감정 비율 (positive/negative/neutral, 0~1)' },
      { field: 'topKeywords', desc: '핵심 키워드 TOP 20 (좋아요 가중)' },
      { field: 'relatedKeywords', desc: '연관어 네트워크 (coOccurrenceScore)' },
      { field: 'positiveFrames / negativeFrames', desc: '긍정/부정 프레임 TOP 5 (강도 1~10)' },
      { field: 'frameConflict', desc: '지배적 프레임 vs 도전 프레임 충돌 구조' },
    ],
    howToUse: [
      '메시지 작성 — 긍정 프레임은 강화, 부정 프레임은 회피',
      '키워드 클라우드/감정 차트 시각화 자료로 즉시 활용',
      '"우리가 만든 프레임이 먹히는가" 측정',
      '경쟁 진영의 공격 프레임 조기 발견 → strategy 모듈로 대응책 도출',
    ],
    theory:
      '프레이밍 이론(Entman 1993)에 따르면 동일한 사실도 어떤 측면을 부각시키느냐에 따라 수용자의 해석이 달라집니다. 본 모듈은 이를 LLM의 의미 이해 능력으로 자동화한 것으로, 감성 분석(Pang & Lee 2008)의 정량 기법과 결합해 "수치 + 맥락"을 동시에 제공합니다.',
    sources: [
      {
        label: 'Entman (1993) "Framing: Toward Clarification of a Fractured Paradigm"',
        detail: 'Journal of Communication 43(4), 51-58. 프레이밍 이론의 표준 정의.',
      },
      {
        label: 'Pang & Lee (2008) "Opinion Mining and Sentiment Analysis"',
        detail: 'Foundations and Trends in Information Retrieval 2(1-2). 감성 분석 종합 리뷰.',
      },
      {
        label: 'Scheufele & Tewksbury (2007) "Framing, Agenda Setting, and Priming"',
        detail: 'Journal of Communication 57(1), 9-20. 세 이론의 통합 모델.',
      },
    ],
  },
  {
    id: 'message-impact',
    no: 4,
    displayName: '메시지 효과 분석',
    enName: 'Message Impact',
    stage: 'Stage 1',
    stageLabel: '기초 분석 (병렬)',
    model: 'Gemini 2.5 Flash',
    role: '정치 커뮤니케이션 효과 분석 전문가',
    whatItDoes:
      '여론을 실제로 움직인 성공 메시지와 역효과를 낸 실패 메시지를 식별합니다. 좋아요 가중·댓글 폭증·교차 확산 같은 신호로 영향력을 측정하고, 성공/실패의 공통 패턴(감정 호소, 수치, 비교 프레임 등)을 추출해 다음 메시지 작성에 활용 가능하게 정리합니다.',
    methodology: [
      '"좋아요 많은 댓글" = 공감 메시지, "댓글 많은 기사" = 논쟁 유발 구분',
      '확산 경로 추적: 최초 발화 → 플랫폼 내 확산 → 플랫폼 간 교차 확산',
      '성공 메시지 공통 패턴 추출 (감정 호소·수치·비교 프레임)',
      '실패 메시지 공통 패턴 추출 (맥락 부재·수혜자 불명·현실 괴리)',
      '각 메시지에 영향도 점수(1~10) 부여',
    ],
    inputs: '5개 소스의 콘텐츠·반응 데이터 (Stage 1, 독립)',
    outputs: [
      {
        field: 'successMessages',
        desc: '성공 메시지 (content, source, impactScore, reason, spreadType)',
      },
      { field: 'failureMessages', desc: '실패 메시지 (negativeScore, damageType)' },
      {
        field: 'highSpreadContentTypes',
        desc: '확산력 높은 콘텐츠 유형 (영상/이미지/숫자비교 등)',
      },
    ],
    howToUse: [
      '다음 콘텐츠 기획 — 성공 패턴 재현, 실패 패턴 회피',
      '대변인/SNS 운영자 가이드라인 자료',
      '광고비 배분 — 확산력 높은 포맷에 우선 투자',
      '실패한 자기 메시지의 정정·해명 우선순위 결정',
    ],
    theory:
      '두 단계 흐름 모델(Two-Step Flow, Katz & Lazarsfeld 1955)과 정보 확산 연구(Bakshy et al. 2012)에 기반합니다. 메시지는 매스미디어 → 의견 지도자 → 일반 대중의 두 단계로 흐르며, 어떤 메시지가 의견 지도자(좋아요·공유 상위 댓글)에서 채택되느냐가 확산의 핵심 변수라는 통찰입니다.',
    sources: [
      {
        label: 'Katz & Lazarsfeld (1955) "Personal Influence"',
        detail: 'Free Press. 두 단계 흐름 모델의 원전.',
      },
      {
        label:
          'Bakshy, Rosenn, Marlow & Adamic (2012) "The Role of Social Networks in Information Diffusion"',
        detail: "WWW '12. 페이스북 데이터 기반 확산 실증 연구.",
      },
      {
        label: 'Berger & Milkman (2012) "What Makes Online Content Viral?"',
        detail: 'Journal of Marketing Research 49(2), 192-205. 바이럴 콘텐츠의 감정 패턴.',
      },
    ],
  },

  /* ─────────── Stage 2 ─────────── */
  {
    id: 'risk-map',
    no: 5,
    displayName: '리스크 지도',
    enName: 'Risk Map',
    stage: 'Stage 2',
    stageLabel: '심화 분석 (순차)',
    model: 'Claude Sonnet 4.6',
    role: '정치 리스크 분석 및 위기 예측 전문가',
    whatItDoes:
      '현재 잠재된 리스크 요인을 4가지 차원(발화점·확산력·지속성·피해범위)으로 평가하고 Top 3~5 리스크를 순위화합니다. 각 리스크에 대해 "어떤 이벤트가 발생하면 현실화되는가" 트리거 조건을 명시해, 위기가 터지기 전에 모니터링 포인트를 알려줍니다.',
    methodology: [
      'Stage 1의 부정 프레임·실패 메시지·변곡점에서 리스크 후보 5~7개 추출',
      '4D 평가: Ignition(발화점) / Virality(확산력) / Duration(지속성) / Blast Radius(피해범위)',
      '영향도(critical/high/medium/low) × 확산 확률(0~1)로 우선순위 산출',
      'Top 3~5 리스크 선정 + 각각의 트리거 조건(사건/발언/날짜) 구체화',
      '전체 리스크 수준(overallRiskLevel) 및 추세(증가/유지/감소) 판정',
    ],
    inputs: 'sentiment-framing(부정 프레임), message-impact(실패 메시지), macro-view(변곡점)',
    outputs: [
      {
        field: 'topRisks',
        desc: 'Top 3~5 리스크 (impactLevel, spreadProbability, triggerConditions)',
      },
      { field: 'overallRiskLevel', desc: '전체 리스크 수준 (critical/high/medium/low)' },
      { field: 'riskTrend', desc: '리스크 추세 (increasing/stable/decreasing)' },
    ],
    howToUse: [
      '주간 리스크 회의 안건 — Top 3 리스크를 그대로 의제화',
      '대변인·법무 사전 브리핑 — 트리거 조건 모니터링 체크리스트',
      '"가장 시급한 위기는 무엇?" 즉답',
      '커뮤니케이션 우선순위 — 리스크 점수 높은 이슈부터 해명',
    ],
    theory:
      '정치 리스크 분석(Political Risk Analysis) 방법론을 온라인 여론에 적용한 것입니다. 전통적으로 기업·국제 정치 영역에서 사용된 4D 평가 모델(발화점·확산성·지속성·피해범위)은 위기 잠재력을 정량화할 수 있는 표준 프레임워크로, Eurasia Group 등 정치 컨설팅 업계에서 활용해 온 접근입니다.',
    sources: [
      {
        label: 'Bremmer & Keat (2009) "The Fat Tail: The Power of Political Knowledge"',
        detail: 'Oxford University Press. 정치 리스크 정량 평가 표준서.',
      },
      {
        label: 'Coombs (2007) "Protecting Organization Reputations During a Crisis: SCCT"',
        detail: 'Corporate Reputation Review 10(3). 위기 커뮤니케이션 상황 이론.',
      },
      {
        label: 'Eurasia Group "Top Risks" Annual Report',
        detail: '연간 정치 리스크 평가 보고서 (실무 표준).',
      },
    ],
  },
  {
    id: 'opportunity',
    no: 6,
    displayName: '기회 분석',
    enName: 'Opportunity',
    stage: 'Stage 2',
    stageLabel: '심화 분석 (순차)',
    model: 'Claude Sonnet 4.6',
    role: '여론 기반 기회 발굴 및 전략적 자산 분석 전문가',
    whatItDoes:
      '부정적 여론 속에서도 활용 가능한 긍정 자산과 아직 개발되지 않은 기회 영역을 발굴합니다. 현재 자산(이미 호응을 얻고 있으나 활용 부족), 미개발 영역(잠재적 호응 있는 미접근), 전환 기회(Swing 포섭 접점) 세 가지 프레임으로 분류해 우선순위를 매깁니다.',
    methodology: [
      '현재 자산: 긍정 반응을 얻었으나 fully/partially/unused 활용 수준 판정',
      '미개발 영역: 잠재 호응이 예상되나 아직 메시지화되지 않은 주제',
      '전환 기회: Swing 집단을 우호로 돌릴 수 있는 구체적 접점',
      '최우선 기회 1개 선정 + 즉시 실행 가능한 액션 플랜 제시',
      '확장 가능성(high/medium/low) 평가',
    ],
    inputs: 'sentiment-framing(긍정 프레임), message-impact(성공 메시지), segmentation(우호 집단)',
    outputs: [
      {
        field: 'positiveAssets',
        desc: '확장 가능한 긍정 요소 (expandability, currentUtilization)',
      },
      { field: 'untappedAreas', desc: '미활용 영역 (potential, approach)' },
      { field: 'priorityOpportunity', desc: '최우선 기회 (reason, actionPlan)' },
    ],
    howToUse: [
      '"방어만 하지 말고 무엇을 공격해야 하나?" 답변',
      '신규 콘텐츠 기획 회의 인풋',
      '캠페인 메시지 풀(pool) 후보 자동 생성',
      '경쟁 진영이 아직 점유하지 못한 빈 공간 발견',
    ],
    theory:
      'SWOT 분석의 Opportunity 축과 블루오션 전략(Kim & Mauborgne 2005)의 "경쟁 없는 시장 공간 발견" 개념을 결합한 접근입니다. 위기관리에만 매몰되면 방어적 사고에 갇히기 쉬우며, 기회 발굴은 별도 모듈로 강제 분리해야 균형 잡힌 전략이 도출된다는 것이 설계 원칙입니다.',
    sources: [
      {
        label: 'Andrews (1971) "The Concept of Corporate Strategy"',
        detail: 'Dow Jones-Irwin. SWOT 프레임워크의 학술적 정립.',
      },
      {
        label: 'Kim & Mauborgne (2005) "Blue Ocean Strategy"',
        detail: 'Harvard Business School Press. 미개척 시장 공간 발견 방법론.',
      },
      {
        label: 'Porter (1985) "Competitive Advantage"',
        detail: 'Free Press. 가치 사슬 기반 차별화 기회 분석.',
      },
    ],
  },
  {
    id: 'strategy',
    no: 7,
    displayName: '종합 전략 도출',
    enName: 'Strategy',
    stage: 'Stage 2',
    stageLabel: '심화 분석 (순차)',
    model: 'Claude Sonnet 4.6',
    role: '정치 여론 전략 수립 전문가',
    whatItDoes:
      'Stage 1의 분석 결과 + Stage 2의 리스크/기회를 종합해 "누가, 무엇을, 언제까지, 어떤 채널로" 수준의 실행 가능한 전략을 도출합니다. 타겟·메시지·콘텐츠·리스크 대응의 4개 축으로 구조화하고, 메시지는 15자 이내로 압축합니다.',
    methodology: [
      '타겟 전략: Swing 포섭 vs Core 결집 vs Opposition 전환의 비용/효과 비교',
      '메시지 전략: 핵심 메시지 15자 이내 압축, 성공 패턴 재현/실패 패턴 회피',
      '콘텐츠 전략: 플랫폼별 최적 포맷 + 확산력 높은 유형 우선',
      '리스크 대응 3단계: 즉각(24시간) / 예방(1주) / 비상 계획',
      '각 전략의 구체성 검증 — 누가/무엇/언제/채널 4요소 필수',
    ],
    inputs: 'risk-map + opportunity + Stage 1 모든 결과',
    outputs: [
      { field: 'targetStrategy', desc: '타겟 전략 (primary/secondary, approach)' },
      { field: 'messageStrategy', desc: '메시지 전략 (coreMessage, supportingMessages, tone)' },
      { field: 'contentStrategy', desc: '콘텐츠 전략 (formats, topics, channels)' },
      { field: 'riskResponse', desc: '리스크 대응 (immediate/preventive/contingency)' },
    ],
    howToUse: [
      '캠페인 회의 결정 사항 — 그대로 액션 아이템화 가능',
      '주간 메시지 가이드라인 발행',
      '광고 카피·SNS 운영 매뉴얼의 1차 초안',
      '"이번 주 우리는 무엇을 할 것인가" 답변',
    ],
    theory:
      '정치 캠페인 전략의 전통적 4P(Product·Price·Place·Promotion) 프레임을 디지털 여론 환경에 맞춰 재구성한 것입니다. Newman(1994)의 정치 마케팅 모델과 Kotler의 STP 프레임을 통합해, 추상적 방향이 아닌 실행 가능한 액션으로 결과물을 강제합니다.',
    sources: [
      {
        label: 'Newman (1994) "The Marketing of the President"',
        detail: 'Sage Publications. 정치 캠페인의 마케팅 모델.',
      },
      {
        label: 'Kotler & Keller (2016) "Marketing Management" (15th ed.)',
        detail: 'Pearson. STP 마케팅 프레임의 표준 교과서.',
      },
      {
        label: 'Issenberg (2012) "The Victory Lab"',
        detail: 'Crown. 데이터 기반 캠페인 전략의 현대적 사례 연구.',
      },
    ],
  },
  {
    id: 'final-summary',
    no: 8,
    displayName: '최종 전략 요약',
    enName: 'Final Summary',
    stage: 'Stage 3',
    stageLabel: '최종 요약 (순차)',
    model: 'Claude Sonnet 4.6',
    role: '정치 전략 브리핑 전문가',
    whatItDoes:
      '모든 분석 결과를 의사결정자가 3분 내 파악하고 즉시 행동 가능한 형태로 압축합니다. "[현재 상태] -- [승부 핵심]" 형식의 한 줄 요약(30~50자), 핵심 발견 3개, 즉시 실행 과제 3~5개, 단기·중기 전망을 한 페이지에 담습니다.',
    methodology: [
      'oneLiner: "[진단] -- [돌파구]" 30~50자 형식 강제',
      '핵심 발견 3개 추출 (전체 분석에서 가장 중요한 시그널)',
      '실행 과제: 누가/무엇/언제/채널 4요소 필수, "~하라" 명령문 형태',
      '추상적 제안 금지 — 측정 가능한 expectedImpact 명시',
      '단기(1~2주) + 중기(1~3개월) 전망 + 핵심 변수(keyVariable) 명시',
    ],
    inputs: 'Stage 1 + Stage 2 모든 결과 통합',
    outputs: [
      { field: 'oneLiner', desc: '한 줄 요약 (30~50자)' },
      { field: 'currentState', desc: '현재 상태 진단 (summary, sentiment, keyFactor)' },
      {
        field: 'criticalActions',
        desc: '최우선 실행 과제 (priority, action, expectedImpact, timeline)',
      },
      { field: 'outlook', desc: '단기/중기 전망 + 핵심 변수' },
    ],
    howToUse: [
      'CEO·후보자·대표 보고용 1페이지 자료',
      '아침 회의 모두 발언 원고',
      '슬라이드 표지 카피로 그대로 사용',
      '"3분만 줘" 요청에 즉답',
    ],
    theory:
      '미군 지휘 통신의 BLUF(Bottom Line Up Front) 원칙과 Barbara Minto의 피라미드 원칙(Pyramid Principle)에 기반합니다. 핵심 결론을 먼저, 근거를 뒤에 배치하는 톱-다운 구조는 의사결정자의 시간을 가장 효율적으로 사용하는 검증된 보고 양식입니다.',
    sources: [
      {
        label: 'Minto (1987) "The Pyramid Principle"',
        detail: 'Pearson. 컨설팅 업계 표준 보고 구조.',
      },
      {
        label: 'US Army "Field Manual 6-0: Commander and Staff Organization"',
        detail: 'BLUF 원칙의 군사 표준.',
      },
      {
        label: 'Heath & Heath (2007) "Made to Stick"',
        detail: 'Random House. 단순/구체/신뢰성 있는 메시지의 SUCCESs 모델.',
      },
    ],
  },

  /* ─────────── Stage 4 ADVN ─────────── */
  {
    id: 'approval-rating',
    no: 9,
    displayName: 'AI 지지율 추정',
    enName: 'Approval Rating',
    stage: 'Stage 4',
    stageLabel: '고급 분석 — ADVN-01',
    model: 'Claude Sonnet 4.6',
    role: '온라인 여론 데이터 기반 지지율 추정 전문가',
    whatItDoes:
      '댓글·기사·영상 데이터에서 플랫폼별 편향을 보정한 AI 추정 지지율 범위를 산출합니다. 단일 수치가 아닌 범위(min~max)로 제시하고, 신뢰도(high/medium/low)에 따라 범위 폭을 조정합니다. 여론조사를 대체하지 않는다는 면책 문구를 반드시 포함합니다.',
    methodology: [
      '플랫폼별 원시 감정 비율 산출 후 편향 보정 (네이버 ×0.7~0.85, 클리앙 ×1.1~1.2 등)',
      '신뢰도 판정: high(플랫폼 3+, 댓글 100+) / medium(2개·50~100) / low(단일)',
      '단일 수치 금지 — 반드시 min~max 범위로 출력',
      '신뢰도별 범위 폭: high ±3%p / medium ±5%p / low ±8%p',
      '면책 조항(과학적 여론조사 대체 아님) 필수 포함',
    ],
    inputs: 'sentiment-framing(감정 비율) + segmentation(플랫폼별 분포)',
    outputs: [
      { field: 'estimatedRange', desc: '지지율 범위 (min, max)' },
      { field: 'confidence', desc: '신뢰도 (high/medium/low)' },
      { field: 'methodology', desc: '편향 보정 내역' },
      { field: 'disclaimer', desc: '면책 문구 (필수)' },
    ],
    howToUse: [
      '여론조사 발표 사이의 공백 메우기 — 매일 추적 가능',
      '실시간 정책 발표 효과 측정',
      '"이번 주 분위기 어때?" 정량 답변',
      '여론조사와 차이가 있을 때 원인 분석 트리거',
    ],
    theory:
      '비확률 표본 보정(non-probability sample correction) 연구에 기반합니다. Wang et al.(2015)의 Xbox 사용자 패널 연구는 명백히 편향된 비표본 데이터도 적절한 통계적 보정으로 여론조사 수준의 정확도를 낼 수 있음을 입증했습니다. 본 모듈은 이를 LLM 기반 정성적 보정으로 구현한 것이며, 동시에 한계(확률 표본 대체 불가)를 명시적으로 고지합니다.',
    sources: [
      {
        label:
          'Wang, Rothschild, Goel & Gelman (2015) "Forecasting elections with non-representative polls"',
        detail:
          'International Journal of Forecasting 31(3), 980-991. 비확률 표본 보정의 대표 사례.',
      },
      {
        label: 'O\'Connor, Balasubramanyan, Routledge & Smith (2010) "From Tweets to Polls"',
        detail: 'ICWSM. 트위터 감성과 여론조사 상관관계 실증 연구.',
      },
      {
        label:
          'Gayo-Avello (2013) "A Meta-Analysis of State-of-the-Art Electoral Prediction From Twitter Data"',
        detail: 'Social Science Computer Review 31(6). 소셜미디어 선거 예측의 한계와 가능성.',
      },
    ],
  },
  {
    id: 'frame-war',
    no: 10,
    displayName: '프레임 전쟁',
    enName: 'Frame War',
    stage: 'Stage 4',
    stageLabel: '고급 분석 — ADVN-02',
    model: 'Claude Sonnet 4.6',
    role: '미디어 프레임 전쟁 및 담론 역학 전문가',
    whatItDoes:
      'sentiment-framing이 식별한 프레임을 출발점으로, 프레임 간 세력 역학·시간 추이·플랫폼 격차·반전 조건을 심층 분석합니다. 프레임을 지배적(dominant)/위협적(threatening)/반전 가능(reversible) 3분류로 정리해 "어떤 담론이 헤게모니를 잡고 있고 어떻게 뒤집을 수 있는가"를 보여줍니다.',
    methodology: [
      'sentiment-framing 결과 재기술 금지 — "프레임 간 힘 관계"에 집중',
      '프레임 3분류: dominant(지배) / threatening(위협) / reversible(반전 가능)',
      '시간 추이 분석: 프레임 강도가 상승/하락 중인가',
      '플랫폼 격차: 같은 프레임이 매체별로 다른 강도를 갖는가',
      '반전 조건 명시: 약세 프레임이 우세로 전환될 트리거',
    ],
    inputs: 'sentiment-framing + message-impact',
    outputs: [
      { field: 'dominantFrames', desc: '지배적 프레임 TOP 5 (strength 0~100)' },
      { field: 'threateningFrames', desc: '위협 프레임 (threatLevel, counterStrategy)' },
      { field: 'reversibleFrames', desc: '반전 가능 프레임 (potentialShift, requiredAction)' },
      { field: 'battlefieldSummary', desc: '프레임 전쟁 종합 요약' },
    ],
    howToUse: [
      '경쟁 진영의 공격 프레임에 대한 반격 시나리오 작성',
      '약세 프레임을 우세로 전환할 핵심 카드 선택',
      '"우리가 담론 전쟁에서 이기고 있나?" 답변',
      '장기 담론 캠페인 (6개월~1년) 설계',
    ],
    theory:
      '프레임 경쟁 이론(Chong & Druckman 2007)과 담론 헤게모니(Laclau & Mouffe 1985)에 기반합니다. 프레임은 정적 분류가 아니라 동적 경쟁 구조이며, 어떤 프레임이 지배적이 되느냐는 메시지 빈도뿐 아니라 정서적 공명·내적 일관성·상대 프레임과의 양립 가능성에 의해 결정된다는 것이 핵심 통찰입니다.',
    sources: [
      {
        label: 'Chong & Druckman (2007) "Framing Theory"',
        detail: 'Annual Review of Political Science 10, 103-126. 프레임 경쟁의 표준 이론.',
      },
      {
        label: 'Laclau & Mouffe (1985) "Hegemony and Socialist Strategy"',
        detail: 'Verso. 담론 헤게모니 이론.',
      },
      {
        label: 'Lakoff (2004) "Don\'t Think of an Elephant!"',
        detail: 'Chelsea Green. 정치 프레임의 인지언어학적 분석.',
      },
    ],
  },
  {
    id: 'crisis-scenario',
    no: 11,
    displayName: '위기 대응 시나리오',
    enName: 'Crisis Scenario',
    stage: 'Stage 4',
    stageLabel: '고급 분석 — ADVN-03',
    model: 'Claude Sonnet 4.6',
    role: '정치 위기 관리 및 시나리오 플래닝 전문가',
    whatItDoes:
      '리스크 분석과 지지율 추정을 결합해 정확히 3가지 시나리오(확산/통제/역전)를 시뮬레이션합니다. 각 시나리오는 트리거 조건 → 전개 경로 → 예상 결과 → 대응 전략 → 타임프레임으로 구성되어, "최악·중도·최선"의 미래를 미리 가늠하게 해줍니다.',
    methodology: [
      '정확히 3개 시나리오 (순서 고정): spread / control / reverse',
      'risk-map 리스크 목록을 재기술하지 않음 — 시나리오 전개로 변환',
      '각 시나리오의 트리거 → 전개 → 결과 인과 사슬 명시',
      'approval-rating 범위를 기반선으로 각 시나리오별 지지율 변동 추정',
      '시나리오별 발생 확률(0~100%) 산출',
    ],
    inputs: 'risk-map + approval-rating',
    outputs: [
      {
        field: 'scenarios',
        desc: '3개 시나리오 (type, name, probability, trigger, outcome, response, timeframe)',
      },
      { field: 'currentRiskLevel', desc: '현재 위기 수준' },
      { field: 'recommendedAction', desc: '권장 즉시 조치' },
    ],
    howToUse: [
      '위기관리 매뉴얼 — 각 시나리오를 그대로 SOP 초안화',
      '이사회/대표 보고 — "최악의 경우 어떻게 되는가" 답변',
      '대응 인력·예산 사전 배치',
      '시뮬레이션 워크숍 토론 자료',
    ],
    theory:
      '쉘(Royal Dutch Shell)이 1970년대 개발한 시나리오 플래닝 방법론(Schwartz 1991)과 위기 커뮤니케이션의 SCCT(Situational Crisis Communication Theory, Coombs 2007)를 결합한 접근입니다. 미래는 단일 예측 대신 복수 시나리오로 다뤄야 의사결정자가 "어떤 미래에도 대비된" 상태를 만들 수 있다는 것이 시나리오 플래닝의 핵심입니다.',
    sources: [
      {
        label: 'Schwartz (1991) "The Art of the Long View"',
        detail: 'Doubleday. 시나리오 플래닝의 표준 방법론.',
      },
      {
        label: 'Coombs (2007) "Protecting Organization Reputations During a Crisis"',
        detail: 'Corporate Reputation Review 10(3). SCCT 위기 대응 이론.',
      },
      {
        label: 'Wack (1985) "Scenarios: Uncharted Waters Ahead"',
        detail: 'Harvard Business Review. Shell의 시나리오 플래닝 사례.',
      },
    ],
  },
  {
    id: 'win-simulation',
    no: 12,
    displayName: '승리 확률 시뮬레이션',
    enName: 'Win Simulation',
    stage: 'Stage 4',
    stageLabel: '고급 분석 — ADVN-04',
    model: 'Claude Sonnet 4.6',
    role: '선거/여론 전략 시뮬레이션 전문가',
    whatItDoes:
      '11개 선행 분석 결과(Stage 1~3 + ADVN-01~03)를 모두 종합해 승리 확률(0~100%)을 산출합니다. 승리 조건 3~7개와 패배 조건 2~5개를 각각 met/partial/unmet으로 평가하고, 시뮬레이션 결과를 반영한 핵심 전략 우선순위를 재배치합니다.',
    methodology: [
      'winProbability 산출: approval-rating 기반선 + risk-map 가중 감점 + opportunity 가점 + frame-war 우세/열세 + crisis-scenario 확산 확률 리스크',
      '승리 조건 3~7개: 각각 met/partial/unmet 상태 + critical/high/medium 중요도',
      '패배 조건 2~5개: 각각 현재 리스크 수준 + 완화 방안(mitigation)',
      'strategy 결과를 반복하지 않고 시뮬레이션 결과로 우선순위 재배치',
      '신뢰도(confidenceLevel)와 종합 요약(simulationSummary) 제시',
    ],
    inputs: '11개 선행 모듈 모두 (Stage 1 + 2 + 3 + ADVN 1·2·3)',
    outputs: [
      { field: 'winProbability', desc: '승리 확률 (0~100%)' },
      { field: 'confidenceLevel', desc: '신뢰도 (high/medium/low)' },
      { field: 'winConditions', desc: '승리 조건 (met/partial/unmet)' },
      { field: 'loseConditions', desc: '패배 조건 (currentRisk, mitigation)' },
      { field: 'keyStrategies', desc: '핵심 전략 (priority 재배치)' },
    ],
    howToUse: [
      '캠프/이사회 최종 의사결정 회의 자료',
      '"우리는 이길 수 있는가? 무엇을 해야 이기는가?" 답변',
      '조건별 KPI 추적 — 승리 조건 충족도 모니터링',
      '리소스 재배분 — 가장 임팩트 큰 전략에 집중',
    ],
    theory:
      'Nate Silver(FiveThirtyEight)가 대중화한 베이지안 정치 예측 모델과 몬테카를로 시뮬레이션 접근에서 영감을 받았습니다. 단일 예측치가 아닌 확률 분포로 결과를 표현하고, 여러 요인(여론·리스크·기회·프레임)의 결합 효과를 종합한다는 점이 핵심입니다. 승리 조건을 met/partial/unmet으로 분해하는 방식은 OKR(Objectives and Key Results) 추적 모델에서 차용했습니다.',
    sources: [
      {
        label: 'Silver (2012) "The Signal and the Noise"',
        detail: 'Penguin. 베이지안 예측 모델의 대중적 표준.',
      },
      {
        label: 'Lewis-Beck & Rice (1992) "Forecasting Elections"',
        detail: 'CQ Press. 선거 예측 모델의 학술적 정리.',
      },
      {
        label: 'Doerr (2018) "Measure What Matters" (OKR)',
        detail: 'Portfolio. 목표·핵심결과 추적 모델.',
      },
    ],
  },

  /* ─────────── 보너스 모듈 (실제 코드 존재) ─────────── */
  {
    id: 'integrated-report',
    no: 13,
    displayName: '통합 리포트 생성',
    enName: 'Integrated Report',
    stage: 'Stage 3',
    stageLabel: '리포트 통합 (자동)',
    model: 'Claude Sonnet 4.6',
    role: '정치 컨설팅 보고서 작성 전문가',
    whatItDoes:
      '12개 분석 모듈의 결과를 한 권의 종합 리포트로 묶어, 표지/요약/본문/부록으로 구조화합니다. 의사결정자용 한 줄 요약부터 분석가용 상세 데이터까지 한 문서에 담아 PDF/Markdown 형태로 출력합니다.',
    methodology: [
      '문서 구조 자동 생성 (표지·목차·본문·각주·부록)',
      '동일 결론은 한 번만 — 모듈 간 중복 정보 자동 통합',
      '분석가용 디테일과 의사결정자용 요약을 레이어 구조로 분리',
      '인용 출처(소스 댓글·기사 URL) 자동 부록화',
    ],
    inputs: '12개 모듈 결과 전체',
    outputs: [
      { field: 'markdown', desc: '전체 리포트 마크다운' },
      { field: 'sections', desc: '섹션 구조 (헤더, 본문, 부록)' },
      { field: 'metadata', desc: '메타데이터 (생성일, 모델, 토큰 사용량)' },
    ],
    howToUse: [
      '의뢰인 납품 보고서 자동 생성',
      '주간/월간 정기 리포트 자동화',
      '내부 회의록·위키 자동 업로드',
    ],
    theory:
      'Minto의 피라미드 원칙과 컨설팅 업계 표준 보고서 구조(Executive Summary → Findings → Recommendations → Appendix)에 기반합니다. 정보를 계층화해 독자별로 다른 깊이로 소비할 수 있게 하는 것이 핵심입니다.',
    sources: [
      {
        label: 'Minto (1987) "The Pyramid Principle"',
        detail: 'Pearson. 컨설팅 보고서 구조 표준.',
      },
      {
        label: 'Friga (2008) "The McKinsey Engagement"',
        detail: 'McGraw-Hill. 컨설팅 보고서 작성 실무.',
      },
    ],
  },
  {
    id: 'pipeline-orchestration',
    no: 14,
    displayName: '파이프라인 오케스트레이션',
    enName: 'Pipeline Orchestration',
    stage: 'Stage 1',
    stageLabel: '시스템 — 전 단계 제어',
    model: 'BullMQ + Redis',
    role: '12개 AI 모듈을 올바른 순서로 실행하고 결과를 통합하는 오케스트레이터',
    whatItDoes:
      '12개 분석 모듈을 의존성 그래프에 따라 정확한 순서로 실행합니다. Stage 1은 병렬, Stage 2는 순차, Stage 4는 병렬+순차 혼합으로 실행되며, 한 모듈이 실패해도 전체가 중단되지 않도록 격리·재시도·부분 결과 보존을 처리합니다.',
    methodology: [
      'BullMQ 기반 작업 큐로 모듈 단위 분리 실행',
      'Redis로 중간 결과 영속화 (모듈 단위 캐시)',
      '의존성 그래프 기반 자동 토폴로지 정렬',
      '실패 모듈 재시도 정책 (지수 백오프)',
      '진행률·로그 실시간 SSE 스트리밍',
    ],
    inputs: '5개 수집기의 정규화된 데이터',
    outputs: [
      { field: 'jobStatus', desc: '각 모듈 실행 상태 (waiting/active/completed/failed)' },
      { field: 'progress', desc: '전체 진행률 (0~100%)' },
      { field: 'partialResults', desc: '완료된 모듈의 부분 결과 (실시간 조회 가능)' },
    ],
    howToUse: [
      '대규모 분석 작업의 안정적 실행',
      '한 모듈 실패 시에도 11개 결과는 살리는 견고함',
      '실시간 진행률 표시 (대시보드 UX)',
      '재실행 시 캐시된 단계는 건너뛰어 비용 절감',
    ],
    theory:
      'Workflow Orchestration 패턴(Apache Airflow, Temporal 등)의 아이디어를 큐 기반으로 단순화한 것입니다. 의존성 있는 비동기 작업의 신뢰성 있는 실행은 분산 시스템 설계의 고전적 문제이며, BullMQ + Redis 조합은 단일 노드 환경에서 검증된 표준 솔루션입니다.',
    sources: [
      {
        label: 'Kleppmann (2017) "Designing Data-Intensive Applications"',
        detail: "O'Reilly. 분산 작업 실행의 표준 참고서.",
      },
      {
        label: 'BullMQ 공식 문서',
        detail: 'https://docs.bullmq.io — Node.js 작업 큐 표준.',
      },
    ],
  },
  /* ─────────── 지식 인프라 ─────────── */
  {
    id: 'ontology',
    no: 15,
    displayName: '지식 그래프 (온톨로지)',
    enName: 'Knowledge Graph / Ontology',
    stage: 'Stage 1',
    stageLabel: '후처리 (자동)',
    model: '규칙 기반 매핑 (AI 모델 미사용)',
    role: '지식 엔지니어 — 여론의 구조적 관계를 모델링하는 엔티티-관계 추출 전문가',
    whatItDoes:
      '분석 파이프라인 완료 후, 6개 분석 모듈(sentiment-framing, segmentation, frame-war, risk-map, message-impact, macro-view, strategy)의 구조화된 JSON 결과에서 핵심 엔티티(인물/조직/이슈/키워드/프레임/주장)와 그들 간의 관계를 자동 추출하여 지식 그래프를 구성합니다. 추출된 엔티티와 관계는 PostgreSQL에 영속화되어, 대시보드의 인터랙티브 네트워크 그래프와 엔티티 기반 검색에 활용됩니다.',
    methodology: [
      '분석 모듈 결과의 구조화된 필드를 온톨로지 엔티티/관계로 매핑 (LLM 재호출 없이 기존 결과 활용)',
      '엔티티 정규화: 동일 엔티티의 mentionCount 증가 및 메타데이터 병합',
      '6개 엔티티 타입: person(인물), organization(조직), issue(이슈), keyword(키워드), frame(프레임), claim(주장)',
      '6개 관계 타입: supports(지지), opposes(대립), related(관련), causes(연쇄), cooccurs(공동출현), threatens(위협)',
      '파이프라인 후처리로 비차단 실행 — 실패해도 분석 결과에 영향 없음',
    ],
    inputs:
      'Stage 1~4 분석 모듈 결과 (sentiment-framing, segmentation, frame-war, risk-map, message-impact, macro-view, strategy)',
    outputs: [
      { field: 'entities', desc: '추출된 엔티티 목록 (name, type, mentionCount, metadata)' },
      { field: 'relations', desc: '엔티티 간 관계 (source→target, type, weight, evidence)' },
      { field: 'knowledgeGraph', desc: 'D3.js 네트워크 그래프 시각화 데이터 (nodes, edges)' },
    ],
    howToUse: [
      '대시보드의 지식 그래프에서 여론의 구조적 관계를 한눈에 파악',
      '엔티티 타입 필터로 관심 영역(인물/이슈/프레임 등)만 집중 분석',
      '노드 클릭으로 엔티티 상세 정보와 관련 문서 확인',
      '의미 검색과 결합하여 특정 엔티티가 언급된 문서 검색',
      '시간 경과에 따른 엔티티 등장/소멸 추적으로 여론 변화 구조 파악',
    ],
    theory:
      '지식 그래프(Knowledge Graph)는 정보를 엔티티와 관계의 네트워크로 구조화하는 표현 방식으로, Google Knowledge Graph(2012) 이후 산업 표준으로 자리잡았습니다. 온톨로지(Ontology)는 도메인 내 개념과 관계를 형식적으로 정의하는 철학적·컴퓨터과학적 프레임워크입니다. 본 시스템은 NLP 기반 Named Entity Recognition 대신 분석 모듈의 구조화된 출력을 직접 매핑하여, 높은 정밀도의 엔티티 추출을 zero-shot으로 달성합니다.',
    sources: [
      {
        label: 'Hogan et al. (2021) "Knowledge Graphs"',
        detail: 'ACM Computing Surveys 54(4), 1-37. 지식 그래프 종합 서베이.',
      },
      {
        label:
          'Paulheim (2017) "Knowledge Graph Refinement: A Survey of Approaches and Evaluation Methods"',
        detail: 'Semantic Web 8(3), 489-508. 엔티티 정규화 및 관계 추출 방법론.',
      },
      {
        label: 'pgvector 공식 문서',
        detail: 'https://github.com/pgvector/pgvector — PostgreSQL 벡터 검색 확장.',
      },
    ],
  },
  {
    id: 'semantic-search',
    no: 16,
    displayName: '시맨틱 검색',
    enName: 'Semantic Search',
    stage: 'System',
    stageLabel: '지식 인프라 — 의미 기반 검색',
    model: 'multilingual-e5-small (384차원) + pgvector HNSW',
    role: '정보 검색 엔지니어 — 벡터 공간 모델과 밀집 임베딩으로 의미 기반 검색을 제공하는 전문가',
    whatItDoes:
      '수집된 기사·댓글·엔티티를 384차원 다국어 임베딩(multilingual-e5-small)으로 벡터화하여 PostgreSQL pgvector에 저장하고, 자연어 질의를 같은 공간에 투영해 코사인 유사도로 관련 문서를 즉시 찾습니다. 키워드가 정확히 일치하지 않아도 "의미"가 가까운 문서를 찾아주므로, 분석가가 질문을 먼저 하고 근거를 뒤에 찾는 탐색적 조사 방식을 지원합니다.',
    methodology: [
      '수집 단계 완료 후 기사/댓글/엔티티 텍스트를 384차원 벡터로 인코딩',
      'pgvector의 HNSW(Hierarchical Navigable Small World) 인덱스로 근사 최근접 검색 수행',
      '코사인 유사도(cosine similarity) 기반 정렬 + 감정·소스·날짜 등 메타 필터 결합',
      '질의 임베딩과 문서 임베딩의 차원·모델을 동일하게 강제 (비대칭 검색 금지)',
      '엔티티 임베딩을 별도 테이블에 저장해 "인물/조직 단위"의 맥락 검색도 제공',
    ],
    inputs: '수집기 정규화 결과 (article.body / comment.text / entity.name) + 사용자 자연어 질의',
    outputs: [
      { field: 'results', desc: '유사도 내림차순 문서 목록 (id, similarity, snippet, source)' },
      { field: 'entityMatches', desc: '관련 엔티티 후보 (인물·조직·이슈 단위 매칭)' },
      { field: 'filters', desc: '적용된 메타 필터 (감정/소스/날짜 범위)' },
    ],
    howToUse: [
      '"경제에 미치는 영향" 같은 자연어 질의로 관련 기사·댓글 일괄 탐색',
      '분석 리포트 작성 시 인용 근거 찾기 — 주장에 맞는 원문 증거 즉시 조회',
      '특정 엔티티(후보자·브랜드·기관)에 대한 맥락 수집 — 검색어 변종을 몰라도 됨',
      '지식 그래프 노드 클릭 시 해당 엔티티가 등장하는 원문으로 이동',
    ],
    theory:
      '벡터 공간 모델(Vector Space Model, Salton et al. 1975)과 밀집 임베딩(Dense Retrieval) 연구에 기반합니다. 전통적 BM25는 어휘 일치에 강하지만 동의어·어순·맥락에는 약하고, 반면 다국어 사전학습 모델 기반 임베딩은 "의미"로 거리를 정의해 어휘 불일치 문제를 해결합니다. pgvector + HNSW 조합은 Malkov & Yashunin(2018)의 근사 최근접 검색 알고리즘을 PostgreSQL에 내장한 표준 구현입니다.',
    sources: [
      {
        label: 'Salton, Wong & Yang (1975) "A Vector Space Model for Automatic Indexing"',
        detail: 'Communications of the ACM 18(11), 613-620. 벡터 공간 모델의 원전.',
      },
      {
        label: 'Wang et al. (2024) "Multilingual E5 Text Embeddings: A Technical Report"',
        detail: 'arXiv:2402.05672. multilingual-e5 계열 임베딩 모델의 기술 보고.',
      },
      {
        label:
          'Malkov & Yashunin (2018) "Efficient and robust approximate nearest neighbor search using HNSW graphs"',
        detail: 'IEEE TPAMI 42(4), 824-836. HNSW 인덱스 표준 논문.',
      },
      {
        label: 'Karpukhin et al. (2020) "Dense Passage Retrieval for Open-Domain QA"',
        detail: 'EMNLP 2020. 밀집 검색(Dense Retrieval) 방법론의 대표 사례.',
      },
    ],
  },

  /* ─────────── Stage 4-F 팬덤 도메인 ─────────── */
  {
    id: 'fan-loyalty-index',
    no: 17,
    displayName: '팬덤 충성도 지수',
    enName: 'Fan Loyalty Index',
    stage: 'Stage 4-F',
    stageLabel: '고급 분석 — 팬덤 도메인',
    model: 'Claude Sonnet 4.6',
    role: '스포츠·엔터테인먼트 팬덤 심리 분석 전문가',
    whatItDoes:
      '팬덤 커뮤니티의 댓글·게시글에서 충성도 신호(자발적 옹호·감정 유대·반복 구매 언급)와 이탈 징후(무관심·비판·경쟁 아티스트 관심)를 추출해 0~100 지수로 정량화합니다. 평균값 뒤에 숨은 활성/수동/위기 팬덤 비율을 드러내고, 플랫폼별 충성도 편차를 비교해 위기 조기 감지선을 제공합니다.',
    methodology: [
      '충성도 신호 추출: 아티스트명·호칭·공식 굿즈·직캠 언급 등 긍정 어휘 가중',
      '이탈 징후 추출: "탈덕", "식었다", "다른 그룹" 등 부정 어휘 가중',
      '팬덤 세분화: 활성(Active) / 수동(Passive) / 위기(At-risk) 비율 산출',
      '플랫폼별 충성도 편차 비교 (공식 카페 vs 일반 커뮤니티 vs 해외 팬 사이트)',
      '팬 정체성 척도(FIS) 7개 요인 중 관찰 가능한 온라인 행동 지표만 사용',
    ],
    inputs: '팬덤 관련 커뮤니티/SNS 수집 데이터 (Stage 1 sentiment-framing·segmentation 선행)',
    outputs: [
      { field: 'loyaltyIndex', desc: '종합 충성도 지수 (0~100)' },
      { field: 'segments', desc: 'Active/Passive/At-risk 비율' },
      { field: 'leavingSignals', desc: '이탈 징후 목록 (어휘·빈도·증가율)' },
      { field: 'platformVariance', desc: '플랫폼별 충성도 편차' },
    ],
    howToUse: [
      '컴백/이벤트 기획 시 팬덤 열기 사전 측정',
      '이탈 징후 조기 경고 — "탈덕" 증가율이 임계값 초과 시 알림',
      '해외 vs 국내 팬덤 온도차 진단 후 타겟 캠페인 설계',
      '소속사 내부 보고용 팬덤 건전도 대시보드',
    ],
    theory:
      'Wann & Branscombe(1993)의 Sport Spectator Identification Scale(SSIS)과 팬 정체성(Fan Identification) 연구에 기반합니다. 팬덤은 단일 집단이 아니라 정체성 강도와 행동 패턴에 따라 층위가 나뉘며, 충성도는 소비 행동·자발적 옹호·감정 투자의 합으로 조작화할 수 있다는 것이 핵심 통찰입니다. 본 모듈은 이를 온라인 텍스트 신호에 적용한 zero-shot 측정입니다.',
    sources: [
      {
        label:
          'Wann & Branscombe (1993) "Sports Fans: Measuring Degree of Identification with Their Team"',
        detail: 'International Journal of Sport Psychology 24(1), 1-17. SSIS의 원전.',
      },
      {
        label: 'Jenkins (1992) "Textual Poachers: Television Fans and Participatory Culture"',
        detail: 'Routledge. 참여형 팬 문화의 사회학적 원전.',
      },
      {
        label:
          'Kozinets (2001) "Utopian Enterprise: Articulating the Meanings of Star Trek’s Culture of Consumption"',
        detail: 'Journal of Consumer Research 28(1), 67-88. 팬 커뮤니티의 소비 행동 연구.',
      },
    ],
  },
  {
    id: 'fandom-narrative-war',
    no: 18,
    displayName: '팬덤 내러티브 경쟁',
    enName: 'Fandom Narrative War',
    stage: 'Stage 4-F',
    stageLabel: '고급 분석 — 팬덤 도메인',
    model: 'Claude Sonnet 4.6',
    role: '팬덤 담론·서사 구조 분석 전문가',
    whatItDoes:
      '팬덤 vs 안티, 소속사 vs 팬덤, 경쟁 팬덤 간 내러티브 경쟁을 지배적/도전적/반전 가능 3분류로 분석합니다. 단순 감정 집계가 아니라 "어떤 서사가 주도권을 잡고 있고, 누가 어떤 이야기로 반격 중인가"를 드러내, 팬덤 커뮤니케이션 담당자가 어떤 서사를 밀어야 하는지 판단할 수 있게 해줍니다.',
    methodology: [
      '지배적 vs 도전적 내러티브 식별 — 빈도·좋아요 가중·확산 경로 결합',
      '발화 주체 분리: 공식 팬덤·안티·일반 대중·소속사·매체 주체별 프레임 분해',
      '내러티브 강도 시간 추이 — 상승/정체/하락 트렌드 표시',
      '약세 내러티브의 우세 전환 트리거 조건 도출 (사건·발언·수상 등)',
      '팬덤 특유의 서사 장치(떡밥·밈·서사 호) 추출',
    ],
    inputs: 'sentiment-framing + fan-loyalty-index',
    outputs: [
      { field: 'dominantNarratives', desc: '지배적 내러티브 TOP 3 (strength 0~100)' },
      { field: 'challengerNarratives', desc: '도전 내러티브 (반전 조건 포함)' },
      { field: 'subjectFrames', desc: '주체별(팬/안티/일반/소속사/매체) 프레임' },
      { field: 'flipConditions', desc: '약세→우세 전환 트리거 조건' },
    ],
    howToUse: [
      '소속사 커뮤니케이션 팀의 공식 입장문 프레임 결정',
      '팬덤 위기 시점의 반격 서사 기획',
      '경쟁 아티스트 대비 서사 점유율 비교',
      '팬덤이 자발적으로 퍼뜨리고 싶어 하는 메시지 포맷 발굴',
    ],
    theory:
      '서사 이송 이론(Narrative Transportation Theory, Green & Brock 2000)과 팬덤 문화 연구(Jenkins 1992)를 결합한 접근입니다. 사람들은 사실을 논리로 받아들이기보다 서사 속 인물에 감정 이입하는 방식으로 설득되며, 팬덤은 이 서사 이송이 가장 강하게 작동하는 자발적 커뮤니티입니다. 본 모듈은 서사 경쟁을 "어떤 이야기가 사람들을 더 깊이 빨아들이고 있는가"로 조작화합니다.',
    sources: [
      {
        label:
          'Green & Brock (2000) "The Role of Transportation in the Persuasiveness of Public Narratives"',
        detail: 'Journal of Personality and Social Psychology 79(5), 701-721. 서사 이송 이론 원전.',
      },
      {
        label: 'Chong & Druckman (2007) "Framing Theory"',
        detail: 'Annual Review of Political Science 10, 103-126. 프레임 경쟁 이론.',
      },
      {
        label: 'Hills (2002) "Fan Cultures"',
        detail: 'Routledge. 팬덤 내부 담론과 정체성 협상의 이론적 정리.',
      },
    ],
  },
  {
    id: 'fandom-crisis-scenario',
    no: 19,
    displayName: '팬덤 위기 시나리오',
    enName: 'Fandom Crisis Scenario',
    stage: 'Stage 4-F',
    stageLabel: '고급 분석 — 팬덤 도메인',
    model: 'Claude Sonnet 4.6',
    role: '팬덤 위기관리 및 시나리오 플래닝 전문가',
    whatItDoes:
      '열애 루머, 표절 의혹, 멤버 이탈, 기획사 갈등 등 팬덤 특유 위기를 확산(Spread)·통제(Control)·역전(Reverse) 3가지 경로로 시뮬레이션합니다. 각 시나리오마다 트리거 조건, 예상 전개, 팬덤 이탈률, 대응 전략, 타임프레임을 제시해 소속사가 "어떤 미래에도 대비된 상태"를 만들 수 있게 돕습니다.',
    methodology: [
      '고정 3시나리오: spread / control / reverse',
      'risk-map 결과를 팬덤 전개 언어로 변환 (불매·보이콧·자진 탈퇴 등)',
      '팬덤 이탈률 추정 — fan-loyalty-index의 At-risk 비율을 기반선으로 사용',
      '각 시나리오의 골든타임(0~24h / 24~48h / 48h+) 명시',
      '소속사 공식 대응·팬덤 자정 작용·외부 변수(매체 보도)의 3축 대응',
    ],
    inputs: 'risk-map + fan-loyalty-index + fandom-narrative-war',
    outputs: [
      { field: 'scenarios', desc: '3개 시나리오 (type, trigger, outcome, response, timeframe)' },
      { field: 'estimatedChurn', desc: '시나리오별 팬덤 이탈률 범위' },
      { field: 'goldenTime', desc: '공식 대응 골든타임 평가' },
    ],
    howToUse: [
      '소속사 위기관리 매뉴얼 초안 — 시나리오를 그대로 SOP화',
      '아티스트 컴백 시기 리스크 점검 회의 자료',
      '"최악의 경우 얼마나 잃는가" 정량 답변',
      '팬덤 대상 공식 입장문 톤 결정',
    ],
    theory:
      'SCCT(Situational Crisis Communication Theory, Coombs 2007)와 시나리오 플래닝(Schwartz 1991)을 팬덤 영역에 적용한 접근입니다. 팬덤은 일반 대중과 달리 감정적 투자가 깊어 위기 전파 속도가 빠르고, 동시에 자정 작용도 강력하므로 "일반 기업 위기관리 매뉴얼"을 그대로 적용하면 실패한다는 것이 핵심 통찰입니다.',
    sources: [
      {
        label: 'Coombs (2007) "Protecting Organization Reputations During a Crisis: SCCT"',
        detail: 'Corporate Reputation Review 10(3), 163-176. 위기 커뮤니케이션 표준 이론.',
      },
      {
        label: 'Schwartz (1991) "The Art of the Long View"',
        detail: 'Doubleday. 시나리오 플래닝 방법론 원전.',
      },
      {
        label:
          'Click, Lee & Holladay (2013) "Making Monsters: Lady Gaga, Fan Identification, and Social Media"',
        detail: 'Popular Music and Society 36(3), 360-379. 팬덤 위기와 소셜미디어 연구.',
      },
    ],
  },
  {
    id: 'release-reception-prediction',
    no: 20,
    displayName: '컴백/신곡 반응 예측',
    enName: 'Release Reception Prediction',
    stage: 'Stage 4-F',
    stageLabel: '고급 분석 — 팬덤 도메인',
    model: 'Claude Sonnet 4.6',
    role: '음악·콘텐츠 릴리즈 반응 예측 전문가',
    whatItDoes:
      '현재 팬덤 열기, 경쟁 아티스트의 동시기 컴백, 플랫폼별 기대감 편차를 종합해 신곡/컴백의 초기 반응을 예측합니다. 단일 점수가 아니라 성공/부진 조건을 분리하고, 플랫폼별(유튜브·스트리밍·커뮤니티) 기대감을 따로 산출해 프로모션 채널 배분 의사결정을 지원합니다.',
    methodology: [
      '팬덤 열기 지수: 과거 컴백 반응 추이 + 현재 언급량 + 좋아요 가중 평균',
      '경쟁 환경 분석: 같은 주간 예정 컴백 리스트와 팬덤 규모 비교',
      '플랫폼별 기대감 편차 — 유튜브/커뮤니티/SNS의 기대 표현 밀도 분리',
      'Expectation Confirmation Theory 기반 "기대-현실 간극" 리스크 평가',
      '성공 조건 3~5개 / 부진 조건 2~3개를 met/partial/unmet으로 평가',
    ],
    inputs: 'fan-loyalty-index + fandom-narrative-war + 과거 릴리즈 수집 데이터',
    outputs: [
      { field: 'receptionScore', desc: '종합 반응 예측 점수 (0~100)' },
      { field: 'successConditions', desc: '성공 조건 + 이행 상태' },
      { field: 'underperformConditions', desc: '부진 조건 + 리스크 수준' },
      { field: 'platformExpectation', desc: '플랫폼별 기대감 분포' },
    ],
    howToUse: [
      '릴리즈 전 마케팅 예산 배분 — 기대감 높은 플랫폼에 우선 투자',
      '프로모션 콘텐츠 포맷 결정 (뮤직비디오 vs 리얼리티 vs 라이브)',
      '기획사 내부 리스크 보고 — "이번 컴백 반응 예상치"',
      '발매 직후 실측 데이터와 비교해 예측 모델 보정',
    ],
    theory:
      'Expectation Confirmation Theory(Oliver 1980)는 만족도가 절대적 품질이 아니라 "기대와 실제의 간극"에 의해 결정된다는 이론입니다. 팬덤 영역에서는 컴백 전 기대감이 지나치게 부풀면 같은 품질이라도 실망으로 이어지므로, 발매 전 기대감 자체를 관리 지표로 삼아야 한다는 것이 본 모듈의 설계 원칙입니다.',
    sources: [
      {
        label:
          'Oliver (1980) "A Cognitive Model of the Antecedents and Consequences of Satisfaction Decisions"',
        detail: 'Journal of Marketing Research 17(4), 460-469. ECT 원전.',
      },
      {
        label: 'Rogers (1962) "Diffusion of Innovations"',
        detail: 'Free Press. 혁신 확산 이론 — 신곡 수용 곡선의 이론적 배경.',
      },
      {
        label: 'Krishnan (2006) "The Willingness to Pay for Event Tickets: A Conjoint Analysis"',
        detail: 'International Journal of Arts Management 9(1). 문화 콘텐츠 수요 예측 사례.',
      },
    ],
  },

  /* ─────────── Stage 4-PR PR/위기관리 ─────────── */
  {
    id: 'scct-crisis-classifier',
    no: 21,
    displayName: 'SCCT 위기 유형 분류',
    enName: 'SCCT Crisis Classifier',
    stage: 'Stage 4-PR',
    stageLabel: '고급 분석 — PR/위기관리',
    model: 'Claude Sonnet 4.6',
    role: '상황적 위기 커뮤니케이션 이론(SCCT) 기반 위기 분류 전문가',
    whatItDoes:
      '현재 발생한 위기를 Coombs(2007)의 SCCT 3분류(희생자형/사고형/예방가능형)로 판정하고, Benoit(1997) Image Repair Theory의 5가지 대응 전략(부정·책임회피·비중축소·수정행동·사과)에 대해 우선순위를 매깁니다. 책임 귀인 수준에 맞춰 대응 강도를 조절함으로써 과잉/과소 대응 위험을 낮춥니다.',
    methodology: [
      'SCCT 3분류: Victim(희생자형·책임 낮음) / Accidental(사고형·책임 중간) / Preventable(예방가능형·책임 높음)',
      '책임 귀인(Crisis Responsibility) 수준 0~100 산출',
      'Image Repair 5전략 우선순위 — 위기 유형에 맞춘 조합',
      '골든타임 평가: Critical(0~24h) / High(24~48h) / Medium(48~72h)',
      '이전 위기 이력(Crisis History)·과거 평판(Prior Reputation) 가중치 반영',
    ],
    inputs: 'risk-map + sentiment-framing + 현재 이벤트/사건 기술',
    outputs: [
      { field: 'crisisType', desc: 'SCCT 위기 유형 (victim/accidental/preventable)' },
      { field: 'responsibilityLevel', desc: '책임 귀인 수준 (0~100)' },
      { field: 'strategyPriority', desc: 'Image Repair 전략 우선순위 (1~5)' },
      { field: 'goldenTime', desc: '대응 골든타임 평가' },
    ],
    howToUse: [
      '위기 발생 첫 1시간 내 대응 방향 결정 — 공식 입장문 톤 선택',
      '법무·홍보·경영진 3자 의견 충돌 시 이론적 중재안 제공',
      '"사과해야 하는가 vs 부정해야 하는가" 즉답',
      '위기 유형별 과거 사례(벤치마크) 매칭',
    ],
    theory:
      'SCCT(Coombs 2007)는 위기의 객관적 특성이 아닌 "공중이 책임을 얼마나 크게 지각하는가"에 따라 대응 전략이 달라져야 한다고 본 이론입니다. Image Repair Theory(Benoit 1997)는 조직이 평판을 복구하기 위해 사용할 수 있는 수사적 전략을 체계화한 것으로, 두 이론의 결합은 현대 위기관리 실무의 표준입니다.',
    sources: [
      {
        label: 'Coombs (2007) "Protecting Organization Reputations During a Crisis: SCCT"',
        detail: 'Corporate Reputation Review 10(3), 163-176. SCCT 표준 논문.',
      },
      {
        label: 'Benoit (1997) "Image Repair Discourse and Crisis Communication"',
        detail: 'Public Relations Review 23(2), 177-186. Image Repair Theory 원전.',
      },
      {
        label: 'Coombs & Holladay (2002) "Helping Crisis Managers Protect Reputational Assets"',
        detail: 'Management Communication Quarterly 16(2), 165-186. SCCT 실증 연구.',
      },
    ],
  },
  {
    id: 'reputation-index',
    no: 22,
    displayName: '평판 지수 측정',
    enName: 'Reputation Index',
    stage: 'Stage 4-PR',
    stageLabel: '고급 분석 — PR/위기관리',
    model: 'Claude Sonnet 4.6',
    role: 'RepTrak 기반 평판 측정 전문가',
    whatItDoes:
      'Fombrun & van Riel(2004)의 RepTrak 모델 7개 차원(제품·혁신·직장환경·거버넌스·시민의식·리더십·재무)에 따라 기업·기관의 평판을 0~100으로 정량화합니다. 단일 점수가 아닌 차원별 점수와 이해관계자별(투자자/소비자/임직원) 인식 차이를 드러내 어느 축을 우선 개선해야 하는지 알려줍니다.',
    methodology: [
      'RepTrak 7차원 키워드 맵핑 후 차원별 여론 점수 산출',
      '차원별 추세(개선/유지/악화) 판정 — 과거 대비 기울기',
      '이해관계자 집단(투자자·소비자·임직원·지역사회) 분리 측정',
      '취약 지점 식별: 점수 낮음 + 부정 추세 교차 영역',
      '경쟁사 벤치마크 — 동종 업계 평균 대비 상대 위치',
    ],
    inputs: 'sentiment-framing + segmentation + macro-view',
    outputs: [
      { field: 'compositeIndex', desc: '종합 평판 지수 (0~100)' },
      { field: 'dimensionScores', desc: '7차원별 점수와 추세' },
      { field: 'stakeholderViews', desc: '이해관계자별 인식 차이' },
      { field: 'weakSpots', desc: '우선 개선 권고 영역' },
    ],
    howToUse: [
      '분기 평판 관리 보고서 — 경영진 대시보드 지표',
      '"우리는 어느 축에서 무너지고 있는가" 즉답',
      '이해관계자별 커스텀 커뮤니케이션 전략 수립',
      '경쟁사 대비 평판 포지션 시각화',
    ],
    theory:
      'RepTrak Model(Fombrun & van Riel 2004)은 평판을 단일 호감도가 아닌 7개 하위 차원의 집계로 본 최초의 종합 모델입니다. Reputation Institute가 2만개 이상 기업에 적용해 실증한 표준 프레임으로, 본 모듈은 전통 설문 기반 측정을 온라인 여론 데이터 기반 zero-shot 측정으로 대체합니다.',
    sources: [
      {
        label:
          'Fombrun & van Riel (2004) "Fame & Fortune: How Successful Companies Build Winning Reputations"',
        detail: 'Prentice Hall. RepTrak 모델 원전.',
      },
      {
        label:
          'Fombrun, Ponzi & Newburry (2015) "Stakeholder Tracking and Analysis: RepTrak System"',
        detail: 'Corporate Reputation Review 18(1), 3-24. RepTrak 실증 방법론.',
      },
      {
        label: 'Walker (2010) "A Systematic Review of the Corporate Reputation Literature"',
        detail: 'Corporate Reputation Review 12(4), 357-387. 기업 평판 연구 메타 분석.',
      },
    ],
  },

  /* ─────────── Stage 4-Corp 기업 평판 ─────────── */
  {
    id: 'stakeholder-salience-map',
    no: 23,
    displayName: '이해관계자 영향력 지도',
    enName: 'Stakeholder Salience Map',
    stage: 'Stage 4-Corp',
    stageLabel: '고급 분석 — 기업 평판',
    model: 'Claude Sonnet 4.6',
    role: '이해관계자 관리(Stakeholder Management) 전문가',
    whatItDoes:
      'Mitchell, Agle & Wood(1997)의 Stakeholder Salience Model에 따라 이해관계자를 권력(Power)·합법성(Legitimacy)·긴급성(Urgency) 3차원으로 평가하고 7가지 현출성 유형(Dormant/Discretionary/Demanding/Dominant/Dangerous/Dependent/Definitive)으로 분류합니다. 이를 통해 "누구 말을 먼저 들어야 하는가" 우선순위 지도를 생성합니다.',
    methodology: [
      '이해관계자 식별: 댓글·게시글·기사의 발화 주체 분류',
      '권력 평가: 의사결정 영향력·자원 동원력·미디어 접근성',
      '합법성 평가: 사회적·법적·도덕적 정당성',
      '긴급성 평가: 주장의 시간 민감도·중요도',
      '3축 조합으로 7개 현출성 유형 매핑 + 최우선 관리 대상 선정',
    ],
    inputs: 'segmentation + sentiment-framing + 외부 이해관계자 목록',
    outputs: [
      { field: 'stakeholders', desc: '이해관계자별 현출성 유형과 3축 점수' },
      { field: 'priorityMap', desc: '우선순위 2D 지도 (권력 × 긴급성)' },
      { field: 'urgentActions', desc: '긴급 대응 대상 및 조치 목록' },
      { field: 'coalitionRisks', desc: '이해관계자 연합 가능성 (결집 시나리오)' },
    ],
    howToUse: [
      '이사회 이해관계자 관리 보고서 — 현출성 유형별 대응 전략',
      '위기 상황에서 "누구부터 설득할 것인가" 우선순위 결정',
      '투자자·소비자·정부·NGO 등 다축 이해관계자 대응 매뉴얼',
      '미디어 발언의 발화 주체 영향력 판정',
    ],
    theory:
      'Mitchell, Agle & Wood(1997)는 Freeman(1984)의 이해관계자 이론을 한 단계 발전시켜, "모든 이해관계자가 동등하지 않다"는 관찰에서 현출성(Salience) 개념을 도입했습니다. 3축(권력·합법성·긴급성)의 조합이 관리자의 주목을 결정하며, 이 모델은 경영·PR·정책 영역의 표준 진단 도구가 되었습니다.',
    sources: [
      {
        label:
          'Mitchell, Agle & Wood (1997) "Toward a Theory of Stakeholder Identification and Salience"',
        detail: 'Academy of Management Review 22(4), 853-886. 현출성 모델 원전.',
      },
      {
        label: 'Freeman (1984) "Strategic Management: A Stakeholder Approach"',
        detail: 'Pitman. 이해관계자 이론의 기초.',
      },
      {
        label: 'Agle, Mitchell & Sonnenfeld (1999) "Who Matters to CEOs?"',
        detail: 'Academy of Management Journal 42(5), 507-525. 현출성 모델 실증.',
      },
    ],
  },
  {
    id: 'esg-sentiment',
    no: 24,
    displayName: 'ESG 여론 분석',
    enName: 'ESG Sentiment Analysis',
    stage: 'Stage 4-Corp',
    stageLabel: '고급 분석 — 기업 평판',
    model: 'Claude Sonnet 4.6',
    role: 'ESG(환경·사회·지배구조) 여론 및 규제 리스크 분석 전문가',
    whatItDoes:
      'E(환경)·S(사회)·G(지배구조) 3차원별로 기업·기관에 대한 여론을 분리 측정합니다. 각 축에 해당 키워드 셋을 매핑해 점수화하고, 그린워싱·워싱 논란 같은 허위 주장 패턴을 감지하며, ESG 규제 기관의 동향과 연계해 규제 리스크 수준을 판정합니다.',
    methodology: [
      'E 키워드: 탄소·오염·재생에너지·폐기물·생물다양성',
      'S 키워드: 노사·다양성·인권·지역사회·소비자 보호',
      'G 키워드: 투명성·반부패·이사회 구조·내부통제·공시',
      '3차원별 긍정·부정 요인 분리 + 점수(0~100) 산출',
      '그린워싱 패턴 감지: 공식 메시지와 실제 행동 간 간극 측정',
      '규제 리스크: 환경부·공정위·금감원 등 감독기관 언급 강도 가중',
    ],
    inputs: 'sentiment-framing + 수집 원시 데이터 (키워드 필터링)',
    outputs: [
      { field: 'esgScores', desc: '3차원별 점수 (0~100) 및 주요 이슈' },
      { field: 'greenwashingSignals', desc: '허위 주장 의심 패턴 목록' },
      { field: 'regulatoryRisk', desc: '규제 리스크 수준 (low/medium/high)' },
      { field: 'stakeholderConcerns', desc: '이해관계자별 ESG 우려 분포' },
    ],
    howToUse: [
      'ESG 위원회 분기 보고 — 3축 정량 지표',
      '투자자 IR 자료 — 글로벌 ESG 펀드 평가 대응',
      '공급망 실사(Supply Chain Due Diligence) 리스크 사전 포착',
      '경영진 ESG 전략 우선순위 결정 (가장 약한 축 우선 개선)',
    ],
    theory:
      'ESG Framework는 GRI Standards(2012~)와 SASB Standards를 통해 국제 공시 표준으로 자리잡았으며, Friede, Busch & Bassen(2015)의 메타분석은 ESG 성과와 재무 성과의 양의 상관관계를 2,000건 이상의 연구에서 확인했습니다. 본 모듈은 공식 공시 데이터 대신 여론 데이터로 실시간 ESG 신호를 감지하는 보완 지표를 제공합니다.',
    sources: [
      {
        label: 'GRI Standards (2016 업데이트)',
        detail: 'Global Reporting Initiative. ESG 공시의 국제 표준 프레임워크.',
      },
      {
        label: 'Friede, Busch & Bassen (2015) "ESG and Financial Performance"',
        detail: 'Journal of Sustainable Finance & Investment 5(4), 210-233. ESG 효과 메타분석.',
      },
      {
        label: 'Delmas & Burbano (2011) "The Drivers of Greenwashing"',
        detail: 'California Management Review 54(1), 64-87. 그린워싱 동인 연구.',
      },
    ],
  },

  /* ─────────── Stage 4-HC 헬스케어 ─────────── */
  {
    id: 'health-risk-perception',
    no: 25,
    displayName: '건강 위험 인식 분석',
    enName: 'Health Risk Perception',
    stage: 'Stage 4-HC',
    stageLabel: '고급 분석 — 헬스케어',
    model: 'Claude Sonnet 4.6',
    role: '위험 인식 심리학(Risk Perception Psychology) 및 공중보건 커뮤니케이션 전문가',
    whatItDoes:
      'Slovic(1987)의 Risk Perception Theory 기반으로 대중이 특정 건강 이슈(감염병·약물·식품 등)를 어떻게 왜곡해서 인식하는지 4가지 편향 유형(Dread·Unknown·Normalcy·Availability)으로 진단하고, 전문가 평가와 대중 인식 간 간극 크기를 측정해 오정보 정정 우선순위를 도출합니다.',
    methodology: [
      '공포 요소(Dread) 지표: 파국적·통제 불가·비자발·불공평 느낌 어휘',
      '미지성(Unknown) 지표: "잘 모른다·새로운·검증 안 된" 어휘',
      '정상화편향(Normalcy) 지표: "괜찮을 거야·나는 아니야" 어휘',
      '가용성 휴리스틱 지표: 최근 사건 언급 빈도 + 감정 강도',
      '전문가 평가(의학 가이드라인·WHO 입장) vs 대중 인식 간극 산출',
      '오정보·과장 주장 확산 패턴과 정정 우선순위',
    ],
    inputs: 'sentiment-framing + segmentation + 공식 의료 가이드라인 참조',
    outputs: [
      { field: 'biasProfile', desc: '4개 편향 유형별 강도 (0~100)' },
      { field: 'expertPublicGap', desc: '전문가-대중 인식 간극 크기' },
      { field: 'misinformationPatterns', desc: '오정보 패턴과 확산 경로' },
      { field: 'communicationRecs', desc: '위험 커뮤니케이션 권고' },
    ],
    howToUse: [
      '공중보건 캠페인 메시지 설계 — 편향에 맞춘 프레이밍',
      '백신·의료 정책 공청회 대비 반대 논리 사전 파악',
      '의료 광고·약국 매뉴얼의 위험 고지 문구 개선',
      '"왜 시민들이 과학적 근거를 믿지 않는가" 원인 분석',
    ],
    theory:
      'Slovic(1987)의 Risk Perception 연구는 전문가와 일반인의 위험 인식이 체계적으로 다르다는 것을 실증했습니다. 일반인은 통계적 기대값이 아니라 정성적 속성(공포·미지·통제 가능성)에 의해 위험을 판단하며, 이 간극을 이해하지 못한 리스크 커뮤니케이션은 불신을 증폭시킵니다. 본 모듈은 이 간극을 온라인 담론에서 실시간 측정합니다.',
    sources: [
      {
        label: 'Slovic (1987) "Perception of Risk"',
        detail: 'Science 236(4799), 280-285. 위험 인식 심리학의 표준 논문.',
      },
      {
        label: 'Kasperson et al. (1988) "The Social Amplification of Risk"',
        detail: 'Risk Analysis 8(2), 177-187. 사회적 위험 증폭 프레임워크.',
      },
      {
        label: 'Tversky & Kahneman (1974) "Judgment under Uncertainty: Heuristics and Biases"',
        detail: 'Science 185(4157), 1124-1131. 가용성 휴리스틱의 원전.',
      },
    ],
  },
  {
    id: 'compliance-predictor',
    no: 26,
    displayName: '의료 순응도 예측',
    enName: 'Compliance Predictor',
    stage: 'Stage 4-HC',
    stageLabel: '고급 분석 — 헬스케어',
    model: 'Claude Sonnet 4.6',
    role: '건강 행동 이론(Health Behavior Theory) 기반 순응도 예측 전문가',
    whatItDoes:
      'Rosenstock(1966) Health Belief Model의 6개 요인과 Ajzen(1991) Theory of Planned Behavior의 태도·주관적 규범·지각된 행동 통제를 결합해 특정 의료 행동(예방접종·복약·검진)의 순응 확률을 집단별로 예측합니다. 가장 큰 장벽 요인을 식별해 개입 전략 우선순위를 제공합니다.',
    methodology: [
      'HBM 6요인 점수화: 취약성·심각성·이익·장벽·행동계기·자기효능감',
      'TPB 3요인: 태도·주관적 규범·지각된 행동 통제 추출',
      '집단별(환자·보호자·일반 대중) 순응 확률 분리 산출',
      '가장 큰 장벽 요인 식별 — 우선 해소 대상',
      '개입 전략 매칭: 교육·인센티브·접근성 개선·사회적 규범 변화',
    ],
    inputs: 'sentiment-framing + segmentation + 특정 의료 행동 타깃 정의',
    outputs: [
      { field: 'complianceProbability', desc: '전체 순응 확률 (%)' },
      { field: 'hbmFactors', desc: 'HBM 6요인 점수' },
      { field: 'largestBarrier', desc: '가장 큰 장벽 요인' },
      { field: 'interventionRecs', desc: '개입 전략 우선순위' },
    ],
    howToUse: [
      '보건소·병원의 행동 변화 캠페인 타겟팅',
      '제약사·의료기기사의 환자 교육 자료 우선순위 결정',
      '보건 당국의 예방접종률·검진률 제고 전략 수립',
      '"왜 환자들이 약을 안 먹는가" 원인 분석',
    ],
    theory:
      'Health Belief Model(Rosenstock 1966)과 Theory of Planned Behavior(Ajzen 1991)는 건강 행동 연구에서 가장 널리 검증된 두 이론입니다. HBM은 위험·이익·장벽 인지를, TPB는 태도·규범·통제 지각을 각각 강조하며, 두 이론의 결합은 행동 의도 분산의 40~60%를 설명합니다. 본 모듈은 이를 온라인 담론 기반 zero-shot 진단으로 구현합니다.',
    sources: [
      {
        label: 'Rosenstock (1966) "Why People Use Health Services"',
        detail: 'Milbank Memorial Fund Quarterly 44(3), 94-127. HBM 원전.',
      },
      {
        label: 'Ajzen (1991) "The Theory of Planned Behavior"',
        detail: 'Organizational Behavior and Human Decision Processes 50(2), 179-211. TPB 원전.',
      },
      {
        label:
          'Carpenter (2010) "A Meta-Analysis of the Effectiveness of Health Belief Model Variables"',
        detail: 'Health Communication 25(8), 661-669. HBM 메타분석.',
      },
    ],
  },

  /* ─────────── Stage 4-SP 스포츠 ─────────── */
  {
    id: 'performance-narrative',
    no: 27,
    displayName: '성과 내러티브 분석',
    enName: 'Performance Narrative',
    stage: 'Stage 4-SP',
    stageLabel: '고급 분석 — 스포츠',
    model: 'Claude Sonnet 4.6',
    role: '스포츠 팬 행동(BIRGing/CORFing) 및 서사 분석 전문가',
    whatItDoes:
      'Cialdini et al.(1976)의 BIRGing/CORFing Theory에 따라 팀·선수 성적과 팬덤 여론 온도 간 상관관계를 분석합니다. 승리 시 팬들이 정체성을 적극 표출하는 BIRGing 패턴과 패배 시 거리두기 CORFing 패턴을 정량화하고, 지배적 서사 호(부활·몰락·영웅·악역·라이벌리)를 식별합니다.',
    methodology: [
      'BIRGing 신호: "우리 팀·우리 선수" 1인칭 복수 사용 빈도',
      'CORFing 신호: "그 팀·그 선수" 3인칭 거리두기 어휘',
      '성적-여론 상관관계 — 승/패 이벤트 기준 시계열 분석',
      '서사 호 5유형 중 지배적 내러티브 선정',
      '미디어 프레임 vs 팬 커뮤니티 프레임 차이 측정',
    ],
    inputs: 'macro-view + sentiment-framing + 경기 결과 외부 데이터',
    outputs: [
      { field: 'birgScore', desc: 'BIRGing 강도 (0~100)' },
      { field: 'corfScore', desc: 'CORFing 강도 (0~100)' },
      { field: 'dominantArc', desc: '지배적 서사 호 유형' },
      { field: 'momentumStability', desc: '모멘텀 안정성 지수' },
    ],
    howToUse: [
      '구단 마케팅 — 팬덤 온도에 맞춘 캠페인 톤 결정',
      '선수 이적·은퇴 커뮤니케이션 전략',
      '스폰서십 가치 평가 — 서사 호에 따른 브랜드 노출 효과',
      '라이벌전 주간 특별 콘텐츠 기획',
    ],
    theory:
      'Cialdini et al.(1976)의 BIRGing(Basking In Reflected Glory)과 Snyder et al.(1986)의 CORFing(Cutting Off Reflected Failure)은 사회 정체성 이론(Tajfel & Turner 1979)의 스포츠 팬 적용 사례로, 팬의 언어 사용 패턴만으로 심리적 거리를 측정할 수 있음을 보였습니다. 본 모듈은 이를 온라인 커뮤니티 담론에 대규모 적용합니다.',
    sources: [
      {
        label:
          'Cialdini et al. (1976) "Basking in Reflected Glory: Three (Football) Field Studies"',
        detail: 'Journal of Personality and Social Psychology 34(3), 366-375. BIRGing 원전.',
      },
      {
        label: 'Snyder, Lassegard & Ford (1986) "Distancing After Group Success and Failure"',
        detail: 'Journal of Personality and Social Psychology 51(2), 382-388. CORFing 원전.',
      },
      {
        label: 'Tajfel & Turner (1979) "An Integrative Theory of Intergroup Conflict"',
        detail: 'Social Identity Theory 원전. 집단 정체성의 기초 이론.',
      },
    ],
  },
  {
    id: 'season-outlook-prediction',
    no: 28,
    displayName: '시즌 전망 예측',
    enName: 'Season Outlook Prediction',
    stage: 'Stage 4-SP',
    stageLabel: '고급 분석 — 스포츠',
    model: 'Claude Sonnet 4.6',
    role: '스포츠 소비자 동기 이론(SCMT) 기반 시즌 전망 분석 전문가',
    whatItDoes:
      'Trail et al.(2003)의 Sport Consumer Motivation Theory에 기반해 팬 기대치 지수(0~100), 참여도 전망, 주요 관전 포인트를 예측합니다. 성적 기대·스타 선수 보유·라이벌전 일정 등 복합 요인을 종합해 시즌 초반 팬덤 동력과 리스크·기회 요인을 제시합니다.',
    methodology: [
      '팬 기대치 지수 = 전년도 성적 기대 + 전력 보강 언급 + 스타 선수 언급',
      '참여도 예측: 증가/유지/감소 3분류 + 근거',
      '관전 포인트 추출: 라이벌전·복귀·신인 데뷔·기록 도전',
      '경쟁 팀 대비 상대 포지션 — 리그 내 여론 점유율',
      'SCMT 9동기 중 주력 동기 식별 (성취·드라마·정체성·미학 등)',
    ],
    inputs: 'performance-narrative + macro-view + 시즌 일정 외부 데이터',
    outputs: [
      { field: 'expectationIndex', desc: '팬 기대치 지수 (0~100)' },
      { field: 'engagementForecast', desc: '참여도 예측 (증가/유지/감소)' },
      { field: 'highlightGames', desc: '주요 관전 포인트 목록' },
      { field: 'riskOpportunity', desc: '리스크·기회 요인' },
    ],
    howToUse: [
      '시즌 티켓 판매 전략 — 기대치 높은 경기 우선 프로모션',
      '중계권·스폰서 세일즈 피치 자료',
      '팬덤 캠페인 예산 배분 — 관전 포인트에 집중',
      '시즌 개막 프리뷰 콘텐츠 기획',
    ],
    theory:
      'Trail et al.(2003)의 Sport Consumer Motivation Theory는 팬의 관람 동기를 9개 축(성취·드라마·정체성·미학·가족·지식·신체·탈출·사회적 교류)으로 체계화한 프레임으로, 스포츠 마케팅의 표준 측정 도구가 되었습니다. 본 모듈은 전통 설문 대신 온라인 담론에서 동기 축을 자동 추출합니다.',
    sources: [
      {
        label: 'Trail, Fink & Anderson (2003) "Sport Spectator Consumption Behavior"',
        detail: 'Sport Marketing Quarterly 12(1), 8-17. SCMT 표준 논문.',
      },
      {
        label: 'Wann (1995) "Preliminary Validation of the Sport Fan Motivation Scale"',
        detail: 'Journal of Sport and Social Issues 19(4), 377-396. 팬 동기 척도.',
      },
      {
        label: 'Funk, Mahony & Havitz (2003) "Sport Consumer Behavior: Marketing Opportunities"',
        detail: 'Sport Marketing Quarterly 12(4), 200-205. 스포츠 소비자 행동 종합.',
      },
    ],
  },

  /* ─────────── Stage 4-Policy 정책 ─────────── */
  {
    id: 'policy-acceptance-estimate',
    no: 29,
    displayName: '정책 수용도 추정',
    enName: 'Policy Acceptance Estimate',
    stage: 'Stage 4-Policy',
    stageLabel: '고급 분석 — 정책',
    model: 'Claude Sonnet 4.6',
    role: '정책 여론 분석 및 Advocacy Coalition 이론 전문가',
    whatItDoes:
      '특정 정책안에 대한 대중 수용도를 플랫폼별 편향 보정 후 min~max 범위로 추정합니다. 정치인 지지율과 분리해 "정책 자체"에 대한 여론을 측정하며, 전문가 vs 일반 대중 의견을 구분하고, Sabatier의 Advocacy Coalition Framework로 찬반 연합 세력을 함께 측정합니다.',
    methodology: [
      '정책 수용도 키워드 셋 매핑 (정책명·효과·문제점)',
      '전문가 집단 vs 일반 대중 의견 분리 — 발화자 유형 기반',
      '플랫폼별 편향 보정 후 수용도 범위 산출 (min~max)',
      '찬성 연합(Advocacy Coalition)·반대 연합 세력 측정',
      '신뢰도(high/medium/low)에 따라 범위 폭 조정',
    ],
    inputs: 'sentiment-framing + segmentation + 정책 사양 외부 입력',
    outputs: [
      { field: 'acceptanceRange', desc: '수용도 범위 (min, max)' },
      { field: 'expertVsPublic', desc: '전문가 vs 대중 의견 차이' },
      { field: 'coalitions', desc: '찬성·반대 연합 세력 지표' },
      { field: 'confidence', desc: '신뢰도 수준' },
    ],
    howToUse: [
      '정책 발표 전 사전 여론 점검 — "통과 가능성이 있는가"',
      '공청회·입법 토론회 대응 자료',
      '정책 홍보 메시지 프레임 결정',
      '찬반 연합 핵심 인사 리스트업',
    ],
    theory:
      'Sabatier & Jenkins-Smith(1993)의 Advocacy Coalition Framework는 정책 변화가 개인이 아니라 "신념 체계를 공유하는 연합" 간 경쟁에 의해 일어난다고 본 이론입니다. 여론은 정책 통과의 필요조건이지만 충분조건이 아니며, 연합 구조를 함께 보아야 정책 현실성을 제대로 판단할 수 있습니다.',
    sources: [
      {
        label:
          'Sabatier & Jenkins-Smith (1993) "Policy Change and Learning: An Advocacy Coalition Approach"',
        detail: 'Westview Press. ACF 원전.',
      },
      {
        label:
          'Weible et al. (2009) "Themes and Variations: Taking Stock of the Advocacy Coalition Framework"',
        detail: 'Policy Studies Journal 37(1), 121-140. ACF 20년 리뷰.',
      },
      {
        label: 'Kingdon (1984) "Agendas, Alternatives, and Public Policies"',
        detail: 'Little Brown. 정책 창(Policy Window) 개념 원전.',
      },
    ],
  },
  {
    id: 'policy-frame-war',
    no: 30,
    displayName: '프레임 전쟁 (정책)',
    enName: 'Policy Frame War',
    stage: 'Stage 4-Policy',
    stageLabel: '고급 분석 — 정책',
    model: 'Claude Sonnet 4.6',
    role: '정책 담론 분석 및 프레임 경쟁 전문가',
    whatItDoes:
      '정책을 둘러싼 지지 연합 vs 반대 연합의 프레임 경쟁을 지배적/위협적/반전 가능 3분류로 분해합니다. 전문가의 기술적 논거 프레임과 대중의 체감 효과 프레임 차이를 드러내고, 약세 프레임의 우세 전환 조건을 제시합니다.',
    methodology: [
      '정책 프레임 3분류: dominant / threatening / reversible',
      '연합별 핵심 신념(Core Beliefs) 및 정책 신념(Policy Beliefs) 추출',
      '기술적 논거(전문가) vs 체감 효과(대중) 프레임 분리',
      '프레임 강도 시간 추이',
      '약세 프레임 전환 조건 — 사건·보도·데이터 공개',
    ],
    inputs: 'sentiment-framing + policy-acceptance-estimate',
    outputs: [
      { field: 'frameMap', desc: '프레임 세력 지도 (3분류)' },
      { field: 'coalitionArguments', desc: '연합별 핵심 논거' },
      { field: 'expertPublicFrames', desc: '전문가 vs 대중 프레임 차이' },
      { field: 'flipTriggers', desc: '약세→우세 전환 조건' },
    ],
    howToUse: [
      '정책 홍보팀의 메시지 기획 — 지배적 프레임 대항 전략',
      '입법 토론회 반격 논거 준비',
      '언론 브리핑 자료 — "정책을 어떻게 설명할 것인가"',
      '시민단체·전문가 협력 대상 선정',
    ],
    theory:
      'Entman(1993)의 프레이밍 이론과 Chong & Druckman(2007)의 프레임 경쟁 모델을 정책 영역에 적용한 접근입니다. 동일한 정책도 어떤 측면을 부각시키느냐에 따라 대중의 평가가 달라지며, 프레임 경쟁의 승자는 메시지 빈도가 아니라 정서적 공명과 내적 일관성에 의해 결정됩니다.',
    sources: [
      {
        label: 'Entman (1993) "Framing: Toward Clarification of a Fractured Paradigm"',
        detail: 'Journal of Communication 43(4), 51-58. 프레이밍 이론 표준.',
      },
      {
        label: 'Chong & Druckman (2007) "Framing Theory"',
        detail: 'Annual Review of Political Science 10, 103-126. 프레임 경쟁 이론.',
      },
      {
        label: 'Schön & Rein (1994) "Frame Reflection"',
        detail: 'Basic Books. 정책 프레임 갈등의 구조 분석.',
      },
    ],
  },
  {
    id: 'policy-crisis-scenario',
    no: 31,
    displayName: '정책 위기 시나리오',
    enName: 'Policy Crisis Scenario',
    stage: 'Stage 4-Policy',
    stageLabel: '고급 분석 — 정책',
    model: 'Claude Sonnet 4.6',
    role: '정책 변화 이론(Punctuated Equilibrium) 기반 시나리오 플래닝 전문가',
    whatItDoes:
      'True et al.(2007)의 Punctuated Equilibrium Theory 기반으로 정책 여론의 안정기-급변기 전환 시나리오를 확산(좌초)/통제(단계 추진)/역전(정책 창 활용) 3가지로 시뮬레이션합니다. 각 시나리오의 트리거 조건과 정책 창(Policy Window) 개방 타이밍을 제시합니다.',
    methodology: [
      '고정 3시나리오: spread (좌초) / control (단계 추진) / reverse (창 활용)',
      'Punctuated Equilibrium: 안정기와 급변기 구분',
      '정책 창 개방 조건: 문제의 흐름 + 정책의 흐름 + 정치의 흐름 교차',
      '각 시나리오별 타임프레임 (단기/중기/장기)',
      '반대 연합 강화·약화 경로 분석',
    ],
    inputs: 'risk-map + policy-acceptance-estimate + policy-frame-war',
    outputs: [
      { field: 'scenarios', desc: '3개 시나리오 상세 전개' },
      { field: 'policyWindowTiming', desc: '정책 창 활용 타이밍' },
      { field: 'recommendedAction', desc: '권장 즉시 조치' },
    ],
    howToUse: [
      '정책 집행 전략 회의 자료',
      '"정책이 좌초되면 어떻게 되는가" 시뮬레이션',
      '정책 창 기회 포착 타이밍 알림',
      '반대 연합 세력 약화 시점 판별',
    ],
    theory:
      'Punctuated Equilibrium Theory(True, Jones & Baumgartner 2007)는 정책 변화가 점진적이지 않고 "오랜 안정기 + 짧은 급변기"의 반복이라고 본 이론입니다. Kingdon(1984)의 Multiple Streams와 결합하면 언제 정책 창이 열리는지 예측 가능하며, 본 모듈은 이를 온라인 여론 동역학으로 조작화합니다.',
    sources: [
      {
        label: 'True, Jones & Baumgartner (2007) "Punctuated-Equilibrium Theory"',
        detail: 'In Theories of the Policy Process (2nd ed.), Westview Press. PET 표준 장.',
      },
      {
        label: 'Kingdon (1984) "Agendas, Alternatives, and Public Policies"',
        detail: 'Little Brown. Multiple Streams Framework 원전.',
      },
      {
        label: 'Baumgartner & Jones (1993) "Agendas and Instability in American Politics"',
        detail: 'University of Chicago Press. PET의 정치 과정 실증.',
      },
    ],
  },
  {
    id: 'policy-approval-simulation',
    no: 32,
    displayName: '정책 승인 시뮬레이션',
    enName: 'Policy Approval Simulation',
    stage: 'Stage 4-Policy',
    stageLabel: '고급 분석 — 정책',
    model: 'Claude Sonnet 4.6',
    role: '정책 확산 이론(Policy Diffusion) 기반 통과 확률 시뮬레이션 전문가',
    whatItDoes:
      '정책 수용도·리스크·기회·프레임 전쟁·위기 시나리오를 종합해 정책 통과/무산 확률을 0~100%로 산출합니다. 승인 조건 3~7개와 무산 조건 2~5개를 met/partial/unmet으로 평가하고, 반대 연합 설득 전략과 정책 브로커 활용 방안을 제시합니다.',
    methodology: [
      'winProbability = acceptance 기반선 ± risk 감점 + opportunity 가점 ± frame-war 점유율',
      '승인 조건 3~7개: 각각 met/partial/unmet + 중요도',
      '무산 조건 2~5개: 현재 리스크 수준 + 완화 방안',
      '정책 브로커(Policy Broker) 활용 방안 — 중재 가능한 중립 인사 식별',
      'Policy Diffusion 기반 인접 지자체·국가 확산 가능성',
    ],
    inputs:
      'policy-acceptance-estimate + risk-map + opportunity + policy-frame-war + policy-crisis-scenario',
    outputs: [
      { field: 'passingProbability', desc: '정책 통과 확률 (0~100%)' },
      { field: 'approvalConditions', desc: '승인 조건 + 이행 상태' },
      { field: 'failureConditions', desc: '무산 조건 + 완화 방안' },
      { field: 'brokerList', desc: '중립 정책 브로커 후보' },
    ],
    howToUse: [
      '국회·시의회 통과 가능성 점검',
      '반대 연합 설득 시나리오 작성',
      '정책 담당자 대시보드 핵심 KPI',
      '정책 브로커 협상 전략 수립',
    ],
    theory:
      'Berry & Berry(1990)의 Policy Diffusion 연구는 정책이 단일 결정이 아니라 관할권 간 확산 패턴에 의해 진행됨을 보였으며, 이는 현대 정책 연구의 표준 프레임입니다. 본 모듈은 이를 여론 예측과 결합해 "몇 % 확률로 통과하는가"라는 확률적 의사결정 지원 도구로 만듭니다.',
    sources: [
      {
        label:
          'Berry & Berry (1990) "State Lottery Adoptions as Policy Innovations: An Event History Analysis"',
        detail: 'American Political Science Review 84(2), 395-415. Policy Diffusion 원전.',
      },
      {
        label: 'Shipan & Volden (2008) "The Mechanisms of Policy Diffusion"',
        detail: 'American Journal of Political Science 52(4), 840-857. 확산 메커니즘 분류.',
      },
      {
        label: 'Walker (1969) "The Diffusion of Innovations among the American States"',
        detail: 'American Political Science Review 63(3), 880-899. 정책 확산 연구의 기초.',
      },
    ],
  },

  /* ─────────── Stage 4-Edu 교육기관 ─────────── */
  {
    id: 'institutional-reputation-index',
    no: 33,
    displayName: '기관 평판 지수 (교육)',
    enName: 'Institutional Reputation Index',
    stage: 'Stage 4-Edu',
    stageLabel: '고급 분석 — 교육기관',
    model: 'Claude Sonnet 4.6',
    role: '대학·교육기관 평판 분석 전문가',
    whatItDoes:
      'Fombrun(1996)의 Reputation Institute 프레임을 교육기관에 맞춰 재구성해 4차원(교육 품질·연구력·취업률·학생 생활)으로 평판을 정량화합니다. 지원자·재학생·졸업생·일반 대중 4집단의 인식 차이를 드러내고, 입시 키워드와 교육 품질 키워드를 분리 측정합니다.',
    methodology: [
      '4차원 키워드 셋: 교육 품질·연구력·취업률·학생 생활',
      '집단 분리: 지원자·재학생·졸업생·일반 대중',
      '입시 프레임(커트라인·경쟁률) vs 교육 프레임(교수진·커리큘럼) 분리',
      '경쟁 기관 대비 상대 포지션 — 지역·전공·규모 매칭',
      '부정 키워드(비리·폐과·구조조정) 조기 경고 임계값',
    ],
    inputs: 'sentiment-framing + segmentation + 교육기관 타깃',
    outputs: [
      { field: 'reputationIndex', desc: '기관 평판 지수 (0~100)' },
      { field: 'dimensionScores', desc: '4차원별 점수' },
      { field: 'groupPerceptions', desc: '4집단별 인식 차이' },
      { field: 'competitivePosition', desc: '경쟁 기관 대비 포지션' },
    ],
    howToUse: [
      '입시 홍보팀의 타깃 집단 선정 — 지원자 vs 학부모',
      '대학 홍보실 분기 평판 보고서',
      '구조조정·학과 개편 여론 점검',
      '졸업생 네트워크 활용 평판 강화 전략',
    ],
    theory:
      'Fombrun(1996)은 기업 평판 연구를 체계화한 선구자로, 그의 Reputation Quotient는 이후 RepTrak으로 발전했습니다. 교육기관 적용에서는 Signaling Theory(Spence 1973)와 결합해 "기관이 발신하는 신호"와 "시장이 해석하는 신호"의 간극을 분석할 수 있습니다.',
    sources: [
      {
        label: 'Fombrun (1996) "Reputation: Realizing Value from the Corporate Image"',
        detail: 'Harvard Business School Press. 기업 평판 연구의 표준서.',
      },
      {
        label: 'Spence (1973) "Job Market Signaling"',
        detail: 'Quarterly Journal of Economics 87(3), 355-374. Signaling Theory 원전.',
      },
      {
        label:
          'Vidaver-Cohen (2007) "Reputation Beyond the Rankings: A Conceptual Framework for Business School Research"',
        detail: 'Corporate Reputation Review 10(4), 278-304. 교육기관 평판 연구.',
      },
    ],
  },
  {
    id: 'education-opinion-frame',
    no: 34,
    displayName: '교육 여론 프레임',
    enName: 'Education Opinion Frame',
    stage: 'Stage 4-Edu',
    stageLabel: '고급 분석 — 교육기관',
    model: 'Claude Sonnet 4.6',
    role: '교육 담론 프레임 분석 전문가',
    whatItDoes:
      'Signaling Theory(Spence 1973)에 기반해 교육기관이 발신하는 품질 신호(연구 실적·취업률·교수진)와 대중이 실제로 해석하는 프레임 간 간극을 분석합니다. 취업·연봉·전공 프레임 vs 캠퍼스 생활·교수 프레임의 세력 비교, 부정 프레임(전공 기피·학과 폐과·비리) 확산 구조를 드러냅니다.',
    methodology: [
      '기관 공식 메시지 프레임 추출 (보도자료·공식 SNS)',
      '대중 반응 프레임 추출 (커뮤니티·뉴스 댓글)',
      '두 프레임 간 간극 정량화 — "무엇을 말하는가" vs "무엇으로 듣는가"',
      '취업·학문·생활 프레임 세력 비교',
      '부정 프레임 확산 경로 + 강화 전략',
    ],
    inputs: 'sentiment-framing + institutional-reputation-index',
    outputs: [
      { field: 'frameMap', desc: '프레임 세력 지도' },
      { field: 'signalGap', desc: '기관-대중 메시지 간극 크기' },
      { field: 'negativeFrames', desc: '부정 프레임 확산 구조' },
      { field: 'reinforcementStrategy', desc: '약세 긍정 프레임 강화 전략' },
    ],
    howToUse: [
      '입시 홍보 캠페인 메시지 개선',
      '"우리가 말하는 것이 제대로 전달되는가" 점검',
      '부정 프레임 사전 차단 콘텐츠 기획',
      '학과·전공 재정비 의사결정',
    ],
    theory:
      'Spence(1973)의 Signaling Theory는 정보 비대칭 시장에서 교육 학력이 신호로 작동하는 메커니즘을 설명한 노벨경제학상 수상 이론입니다. 교육기관은 품질을 직접 관찰할 수 없는 수요자에게 신호를 발신하는 주체이며, 신호와 해석의 간극이 평판 관리의 핵심 과제입니다.',
    sources: [
      {
        label: 'Spence (1973) "Job Market Signaling"',
        detail: 'Quarterly Journal of Economics 87(3), 355-374. Signaling Theory 원전.',
      },
      {
        label: 'Connelly et al. (2011) "Signaling Theory: A Review and Assessment"',
        detail: 'Journal of Management 37(1), 39-67. Signaling Theory 리뷰.',
      },
      {
        label: 'Rindova et al. (2005) "Being Good or Being Known"',
        detail: 'Academy of Management Journal 48(6), 1033-1049. 기관 평판과 지명도 구분.',
      },
    ],
  },
  {
    id: 'education-crisis-scenario',
    no: 35,
    displayName: '교육 위기 시나리오',
    enName: 'Education Crisis Scenario',
    stage: 'Stage 4-Edu',
    stageLabel: '고급 분석 — 교육기관',
    model: 'Claude Sonnet 4.6',
    role: '교육기관 위기관리 전문가',
    whatItDoes:
      '교육기관 특유의 위기(입결 하락·비리 의혹·구조조정·학과 폐과)를 확산/통제/역전 3가지 경로로 시뮬레이션합니다. 각 시나리오의 입시 기피·정원 미달 영향을 추정하고, 개혁 기회로 전환 가능한 역전 경로를 제시합니다.',
    methodology: [
      '고정 3시나리오: spread / control / reverse',
      'SCCT 위기 유형(희생자형/사고형/예방가능형) 자동 매핑',
      '입시·취업·연구 3개 지표에 미치는 영향 추정',
      '학부모·지원자·재학생·졸업생 4집단별 파급 분석',
      '평판 회복 타임프레임 (단기 6개월 / 중기 1~2년 / 장기 3~5년)',
    ],
    inputs: 'risk-map + institutional-reputation-index + education-opinion-frame',
    outputs: [
      { field: 'scenarios', desc: '3개 시나리오 상세 분석' },
      { field: 'enrollmentImpact', desc: '입시 기피 영향 추정' },
      { field: 'recoveryTimeframe', desc: '평판 회복 소요 시간' },
    ],
    howToUse: [
      '대학 본부 위기관리 매뉴얼 초안',
      '교무·기획처 회의 자료',
      '구조조정 의사결정 사전 여론 점검',
      '이사회 위기 보고서',
    ],
    theory:
      'SCCT(Coombs 2007)를 교육기관 맥락에 적용한 접근입니다. 교육기관의 위기는 기업과 달리 "세대를 넘는 장기 평판"에 영향을 주며, 회복 속도도 느리므로 위기 유형 분류와 골든타임 평가가 특히 중요합니다.',
    sources: [
      {
        label: 'Coombs (2007) "Protecting Organization Reputations During a Crisis: SCCT"',
        detail: 'Corporate Reputation Review 10(3), 163-176.',
      },
      {
        label: 'Schwartz (1991) "The Art of the Long View"',
        detail: 'Doubleday. 시나리오 플래닝 원전.',
      },
      {
        label: 'Menon & Rosenbaum (2020) "Universities and Crisis Management"',
        detail: 'Journal of College Student Development 61(1). 대학 위기 대응 연구.',
      },
    ],
  },
  {
    id: 'education-outcome-simulation',
    no: 36,
    displayName: '교육기관 목표 달성 시뮬레이션',
    enName: 'Education Outcome Simulation',
    stage: 'Stage 4-Edu',
    stageLabel: '고급 분석 — 교육기관',
    model: 'Claude Sonnet 4.6',
    role: '교육기관 평판 회복 및 목표 달성 전략 시뮬레이션 전문가',
    whatItDoes:
      '기관 평판 지수·위기·기회·프레임 분석을 종합해 평판 회복 확률(0~100%)과 핵심 전략 우선순위를 도출합니다. 이해관계자별(재학생·학부모·고용주·동문) 달성 조건을 met/partial/unmet으로 평가하고 단기 위기 대응 vs 장기 평판 구축의 전략 배분을 제시합니다.',
    methodology: [
      'winProbability = 평판 지수 기반선 ± 위기 감점 + 기회 가점',
      '이해관계자별 달성 조건 평가 — 4~6개 조건',
      '언론 프레임 중립화·입학 지원자 신뢰 회복·비리 이슈 해소 조건',
      '단기(6개월) vs 장기(3년) 전략 우선순위 재배치',
      '차별화 포지셔닝 제안',
    ],
    inputs: 'institutional-reputation-index + education-crisis-scenario + education-opinion-frame',
    outputs: [
      { field: 'recoveryProbability', desc: '평판 회복 확률 (0~100%)' },
      { field: 'stakeholderConditions', desc: '이해관계자별 달성 조건' },
      { field: 'strategyPriority', desc: '단기/장기 전략 우선순위' },
      { field: 'differentiation', desc: '차별화 포지셔닝' },
    ],
    howToUse: [
      '총장·이사회 중장기 평판 전략 수립',
      '기획처 연간 KPI 설계',
      '개혁 의제 우선순위 결정',
      '입시 시즌 캠페인 총괄 지표',
    ],
    theory:
      'Fombrun(1996)의 기업 평판 관리 프레임과 OKR(Doerr 2018)의 목표 추적 모델을 결합한 것입니다. 평판 회복은 단일 이벤트가 아니라 조건 충족의 누적 결과이므로, met/partial/unmet 평가가 장기 관리에 적합합니다.',
    sources: [
      {
        label: 'Fombrun (1996) "Reputation: Realizing Value from the Corporate Image"',
        detail: 'Harvard Business School Press.',
      },
      {
        label: 'Doerr (2018) "Measure What Matters"',
        detail: 'Portfolio. OKR 모델.',
      },
      {
        label: 'Rindova et al. (2005) "Being Good or Being Known"',
        detail: 'Academy of Management Journal 48(6), 1033-1049.',
      },
    ],
  },

  /* ─────────── Stage 4-PS 공공기관 ─────────── */
  {
    id: 'public-trust-estimate',
    no: 37,
    displayName: '시민 신뢰도 추정',
    enName: 'Public Trust Estimate',
    stage: 'Stage 4-PS',
    stageLabel: '고급 분석 — 공공기관',
    model: 'Claude Sonnet 4.6',
    role: '공공 신뢰 이론(Public Trust Theory) 기반 시민 신뢰도 측정 전문가',
    whatItDoes:
      'Putnam(2000)과 Levi & Stoker(2000)의 공공 신뢰 이론에 기반해 공공기관·지자체에 대한 시민 신뢰도를 4요소(역량·도덕·절차·결과)로 분해해 측정합니다. 플랫폼별 편향 보정 후 종합 신뢰 지수(0~100)를 산출하고, 신뢰 하락 트리거 사건과 회복 경로를 제시합니다.',
    methodology: [
      '4요소 키워드 셋: 역량(전문성·실행력)·도덕(청렴·공정)·절차(투명·참여)·결과(성과·체감)',
      '집단 분리: 지지층·일반 시민·이해관계자',
      '플랫폼 편향 보정 후 종합 신뢰 지수 산출',
      '신뢰 하락 트리거 사건 식별 — 시계열 기준 변곡점',
      '회복 경로 추정 — 과거 유사 사례 비교',
    ],
    inputs: 'sentiment-framing + segmentation + macro-view',
    outputs: [
      { field: 'trustIndex', desc: '종합 시민 신뢰 지수 (0~100)' },
      { field: 'fourDimensions', desc: '역량·도덕·절차·결과 4요소 점수' },
      { field: 'triggerEvents', desc: '신뢰 하락 트리거 사건' },
      { field: 'recoveryPath', desc: '회복 경로 및 소요 기간' },
    ],
    howToUse: [
      '지자체장·기관장 분기 브리핑 자료',
      '시민 참여 예산제 여론 점검',
      '감사·국정감사 대응 사전 진단',
      '공공기관 ESG 보고의 사회 항목 근거',
    ],
    theory:
      'Putnam(2000)의 "Bowling Alone"은 사회적 자본과 공공 신뢰의 붕괴를 체계적으로 분석했고, Levi & Stoker(2000)는 신뢰를 역량·도덕·절차·결과로 다차원화한 표준 프레임을 제시했습니다. 본 모듈은 설문 기반 측정의 한계를 극복하고 실시간 여론 데이터로 대체합니다.',
    sources: [
      {
        label: 'Putnam (2000) "Bowling Alone: The Collapse and Revival of American Community"',
        detail: 'Simon & Schuster. 사회적 자본과 공공 신뢰 연구.',
      },
      {
        label: 'Levi & Stoker (2000) "Political Trust and Trustworthiness"',
        detail: 'Annual Review of Political Science 3, 475-507. 신뢰 다차원 모델.',
      },
      {
        label: 'OECD (2017) "Trust and Public Policy"',
        detail: 'OECD Public Governance Reviews. 공공 신뢰 국제 비교 지표.',
      },
    ],
  },
  {
    id: 'public-frame-war',
    no: 38,
    displayName: '공공 프레임 전쟁',
    enName: 'Public Frame War',
    stage: 'Stage 4-PS',
    stageLabel: '고급 분석 — 공공기관',
    model: 'Claude Sonnet 4.6',
    role: '참여형 거버넌스(Participatory Governance) 기반 프레임 분석 전문가',
    whatItDoes:
      'Fung(2006)의 Participatory Governance 이론에 기반해 공공 사업·정책을 둘러싼 지지 시민·반대 시민·이해관계자 간 프레임 경쟁을 분석합니다. 기관 공식 프레임과 시민 반응 프레임의 간극을 측정하고, 지역 이슈 프레임의 전국 확산 가능성을 평가합니다.',
    methodology: [
      '기관 공식 메시지 프레임 vs 시민 반응 프레임 간극 측정',
      '찬성 주민·반대 주민·전문가·미디어 발화 주체별 프레임 분해',
      '지역→전국 확산 가능성 평가 (연결 노드·매체 반응 강도)',
      '시민 소통 전략 도출 — 프레임 전환 가능 지점',
      'Deliberative Democracy 지표 — 상호 반응성·근거 기반 대화 비율',
    ],
    inputs: 'sentiment-framing + public-trust-estimate',
    outputs: [
      { field: 'frameMap', desc: '프레임 세력 지도' },
      { field: 'institutionCitizenGap', desc: '기관-시민 메시지 간극' },
      { field: 'nationalSpreadRisk', desc: '전국 확산 가능성' },
      { field: 'communicationStrategy', desc: '시민 소통 전략' },
    ],
    howToUse: [
      '지역 개발 사업 주민 공청회 대응',
      '민원·진정서 패턴 분석으로 프레임 구조 파악',
      '지자체 홍보실 메시지 개선',
      '전국 이슈화 위험 조기 감지',
    ],
    theory:
      'Fung(2006)은 참여형 거버넌스를 "누가 참여하는가·어떻게 의견을 형성하는가·얼마나 영향력을 갖는가" 3축으로 체계화했습니다. 프레임 경쟁은 이 중 의견 형성 단계의 핵심 동역학이며, 공공 의사결정은 기술적 합리성만으로 환원되지 않고 담론 정당성이 함께 필요합니다.',
    sources: [
      {
        label: 'Fung (2006) "Varieties of Participation in Complex Governance"',
        detail: 'Public Administration Review 66(s1), 66-75. 참여형 거버넌스 표준.',
      },
      {
        label: 'Habermas (1984) "The Theory of Communicative Action"',
        detail: 'Beacon Press. 숙의 민주주의 이론의 철학적 기초.',
      },
      {
        label: 'Arnstein (1969) "A Ladder of Citizen Participation"',
        detail: 'Journal of the American Institute of Planners 35(4), 216-224. 시민 참여 사다리.',
      },
    ],
  },
  {
    id: 'public-crisis-scenario',
    no: 39,
    displayName: '공공 위기 시나리오',
    enName: 'Public Crisis Scenario',
    stage: 'Stage 4-PS',
    stageLabel: '고급 분석 — 공공기관',
    model: 'Claude Sonnet 4.6',
    role: '공공 위기 커뮤니케이션 및 시나리오 플래닝 전문가',
    whatItDoes:
      '공공기관 특유의 위기(예산 낭비 의혹·복지 서비스 논란·지역 개발 갈등)를 확산·통제·역전 3가지 경로로 시뮬레이션합니다. 각 시나리오의 국감·감사 전국화 가능성, 대응 골든타임, 투명성 제고 기회 전환 경로를 제시합니다.',
    methodology: [
      '고정 3시나리오: spread / control / reverse',
      '지역 이슈 → 전국 이슈 전환 트리거 조건',
      '골든타임 평가: Critical(0~24h) / High(24~48h) / Medium(48~72h)',
      '행정 감사·국감 대응 체크리스트',
      '투명성 제고 기회로의 전환 경로 설계',
    ],
    inputs: 'risk-map + public-trust-estimate + public-frame-war',
    outputs: [
      { field: 'scenarios', desc: '3개 시나리오 상세 분석' },
      { field: 'goldenTime', desc: '골든타임 평가' },
      { field: 'responseChecklist', desc: '즉시 조치 체크리스트' },
    ],
    howToUse: [
      '지자체 위기관리 매뉴얼 초안',
      '감사원 감사 대응 사전 시뮬레이션',
      '지역 여론 격화 방지 골든타임 체크',
      '공공기관 대변인 브리핑 자료',
    ],
    theory:
      'Coombs(2007)의 SCCT를 공공 부문에 적용한 것입니다. 공공기관 위기는 기업과 달리 "시민 신뢰" 자체가 조직 존립 근거이므로, 골든타임 내 투명한 소통이 가장 중요한 변수입니다.',
    sources: [
      {
        label: 'Coombs (2007) "Protecting Organization Reputations During a Crisis: SCCT"',
        detail: 'Corporate Reputation Review 10(3), 163-176.',
      },
      {
        label: 'Boin et al. (2005) "The Politics of Crisis Management"',
        detail: 'Cambridge University Press. 공공 위기관리 정치 분석.',
      },
      {
        label: 'Heath (2010) "The SAGE Handbook of Public Relations"',
        detail: 'SAGE. 공공 PR 이론 종합.',
      },
    ],
  },
  {
    id: 'public-trust-recovery-simulation',
    no: 40,
    displayName: '기관 신뢰 회복 시뮬레이션',
    enName: 'Public Trust Recovery Simulation',
    stage: 'Stage 4-PS',
    stageLabel: '고급 분석 — 공공기관',
    model: 'Claude Sonnet 4.6',
    role: '공공 신뢰 회복 전략 시뮬레이션 전문가',
    whatItDoes:
      '시민 신뢰도·위기·기회를 종합해 공공기관의 신뢰 회복 확률(0~100%)과 핵심 소통 전략을 도출합니다. 역량 신뢰·가치 신뢰 회복 조건을 met/partial/unmet으로 평가하고, 지역 미디어 프레임 중립화·시민 참여 구조 개선·행정 성과 공표 조건을 분석합니다.',
    methodology: [
      'winProbability = 신뢰 지수 기반선 ± 위기·기회 가감점',
      '4요소(역량·도덕·절차·결과) 회복 조건별 이행 상태',
      '주민 타겟 전략: 세그먼트별 채널·톤 배분',
      '단기 이슈 대응 vs 장기 신뢰 구축 우선순위',
      '참여 구조 개선 KPI — 시민 참여율·피드백 반영률',
    ],
    inputs: 'public-trust-estimate + public-crisis-scenario + public-frame-war',
    outputs: [
      { field: 'recoveryProbability', desc: '신뢰 회복 확률 (0~100%)' },
      { field: 'dimensionConditions', desc: '4요소 회복 조건 이행 상태' },
      { field: 'targetStrategies', desc: '주민 타겟별 전략' },
      { field: 'channelPlan', desc: '채널별 소통 계획' },
    ],
    howToUse: [
      '지자체장 임기 내 핵심 평판 KPI 설계',
      '시민참여예산·주민자치회 개편 근거',
      '공공기관 경영평가 대비',
      '위기 후 재신뢰 구축 로드맵',
    ],
    theory:
      'Levi & Stoker(2000)의 신뢰 다차원 모델과 OKR 추적 방식을 결합한 접근입니다. 공공 신뢰 회복은 단발 이벤트가 아니라 복수 조건의 누적 충족이며, 측정 가능한 조건 분해가 관리 가능성의 전제입니다.',
    sources: [
      {
        label: 'Levi & Stoker (2000) "Political Trust and Trustworthiness"',
        detail: 'Annual Review of Political Science 3, 475-507.',
      },
      {
        label: 'Bouckaert & Van de Walle (2003) "Comparing Measures of Citizen Trust"',
        detail: 'International Review of Administrative Sciences 69(3), 329-343.',
      },
      {
        label: 'Van Ryzin (2011) "Outcomes, Process, and Trust in Civil Servants"',
        detail: 'Journal of Public Administration Research and Theory 21(4), 745-760.',
      },
    ],
  },

  /* ─────────── Stage 4-Legal 법률 ─────────── */
  {
    id: 'legal-reputation-index',
    no: 41,
    displayName: '법률 평판 지수',
    enName: 'Legal Reputation Index',
    stage: 'Stage 4-Legal',
    stageLabel: '고급 분석 — 법률/로펌',
    model: 'Claude Sonnet 4.6',
    role: '법률 시장 평판 분석 및 법조 사회학 전문가',
    whatItDoes:
      'Heinz et al.(2005) "Urban Lawyers" 연구의 법률가 시장 이중 구조 모델과 RepTrak 프레임을 결합해 법률가·로펌의 온라인 평판을 4차원(전문성·윤리성·접근성·고객 만족)으로 측정합니다. 의뢰인·일반 대중·법조 전문가 집단별 인식 차이를 드러냅니다.',
    methodology: [
      '4차원 키워드 셋: 전문성(승소·전문 분야)·윤리성(비리·청구)·접근성(응답)·고객 만족',
      '집단 분리: 의뢰인·일반 대중·법조 전문가',
      '부정 키워드 집중 모니터링: 비리·패소·과잉 청구',
      'RepTrak 가중 평균으로 종합 지수 산출',
      '전문 분야별 세부 포지션 — 형사·가사·기업·IP 등',
    ],
    inputs: 'sentiment-framing + segmentation',
    outputs: [
      { field: 'legalReputationIndex', desc: '법률 평판 지수 (0~100)' },
      { field: 'dimensionScores', desc: '4차원 점수' },
      { field: 'groupPerceptions', desc: '집단별 인식 차이' },
      { field: 'weakSpots', desc: '취약 지점' },
    ],
    howToUse: [
      '로펌 마케팅팀 분기 보고서',
      '신규 수임 영업 대상 분야 결정',
      '변호사회 징계 사전 대응',
      '브랜드 네이밍·광고 메시지 점검',
    ],
    theory:
      'Heinz et al.(2005)의 "Urban Lawyers"는 시카고 로펌 시장을 30년간 추적해 법률 시장의 이중 구조(기업 고객 반구 vs 개인 고객 반구)와 평판 메커니즘을 실증한 대표 연구입니다. 본 모듈은 이 구조적 통찰을 여론 데이터 기반 실시간 측정으로 확장합니다.',
    sources: [
      {
        label:
          'Heinz, Nelson, Sandefur & Laumann (2005) "Urban Lawyers: The New Social Structure of the Bar"',
        detail: 'University of Chicago Press. 법률 시장 이중 구조 연구.',
      },
      {
        label: 'Fombrun & van Riel (2004) "Fame & Fortune"',
        detail: 'Prentice Hall. RepTrak 모델 원전.',
      },
      {
        label: 'Abbott (1988) "The System of Professions"',
        detail: 'University of Chicago Press. 전문직 시장의 사회학.',
      },
    ],
  },
  {
    id: 'legal-frame-war',
    no: 42,
    displayName: '법률 프레임 전쟁',
    enName: 'Legal Frame War',
    stage: 'Stage 4-Legal',
    stageLabel: '고급 분석 — 법률/로펌',
    model: 'Claude Sonnet 4.6',
    role: '법적 담론 프레임 분석 전문가',
    whatItDoes:
      '법적 이슈를 둘러싼 세 가지 경쟁 프레임 — 피해자 감정 프레임 / 법리 중심 프레임 / 사법 불신 프레임 — 의 세력 역학을 분석합니다. 미디어·커뮤니티·법조계 발화 주체별 프레임 차이를 드러내고, 안티 프레임 조직화 수준을 평가합니다.',
    methodology: [
      '법률 프레임 3유형: 피해자 감정 / 법리 중심 / 사법 불신',
      '발화 주체별 프레임: 미디어·커뮤니티·법조계·정치권',
      '안티 프레임 확산 속도와 조직화 수준 측정',
      '명예 회복 프레임 전환 전략 도출',
      '판결 직후 여론 변화 경로 분석',
    ],
    inputs: 'sentiment-framing + legal-reputation-index',
    outputs: [
      { field: 'frameMap', desc: '프레임 세력 지도' },
      { field: 'subjectFrames', desc: '주체별 프레임 분석' },
      { field: 'antiOrganization', desc: '안티 프레임 조직화 수준' },
      { field: 'reframingStrategy', desc: '프레임 전환 전략' },
    ],
    howToUse: [
      '민감 사건 변호인 공식 입장 기획',
      '판결 직후 언론 브리핑 전략',
      '사건 담당 변호사 온라인 공격 대응',
      '법률 홍보 메시지 리스크 점검',
    ],
    theory:
      'Entman(1993)의 프레이밍 이론을 법적 담론에 적용한 접근입니다. 법적 이슈는 사실/법리와 감정/공감 사이의 프레임 경쟁이 특히 강하게 작동하는 영역으로, 법원의 판결과 여론의 수용은 종종 괴리되며 이 간극이 평판 관리의 핵심 과제입니다.',
    sources: [
      {
        label: 'Entman (1993) "Framing: Toward Clarification of a Fractured Paradigm"',
        detail: 'Journal of Communication 43(4), 51-58.',
      },
      {
        label:
          'Haltom & McCann (2004) "Distorting the Law: Politics, Media, and the Litigation Crisis"',
        detail: 'University of Chicago Press. 법적 담론과 미디어 프레임 연구.',
      },
      {
        label: 'Nobles & Schiff (2004) "A Story of Miscarriage: Law in the Media"',
        detail: 'Journal of Law and Society 31(2), 221-244.',
      },
    ],
  },
  {
    id: 'legal-crisis-scenario',
    no: 43,
    displayName: '법률 위기 시나리오',
    enName: 'Legal Crisis Scenario',
    stage: 'Stage 4-Legal',
    stageLabel: '고급 분석 — 법률/로펌',
    model: 'Claude Sonnet 4.6',
    role: '법률 서비스 위기관리 전문가',
    whatItDoes:
      '법률 서비스 특유 위기(수임료 분쟁·패소 논란·윤리 위반 의혹)를 SCCT 기반 확산·통제·역전 3가지 경로로 시뮬레이션합니다. 변호사회 징계·언론 보도 전국화 리스크를 평가하고, 전문성 입증 기회 전환 경로를 제시합니다.',
    methodology: [
      '고정 3시나리오 + SCCT 위기 유형 자동 매핑',
      '변호사회·언론·커뮤니티 3축 확산 경로 분석',
      '징계 절차·평판 회복 타임라인',
      '전문성 입증 기회 전환 경로',
      '개별 사건 합의 vs 공식 반박 비용 비교',
    ],
    inputs: 'risk-map + legal-reputation-index + legal-frame-war',
    outputs: [
      { field: 'scenarios', desc: '3개 시나리오 상세' },
      { field: 'scctType', desc: 'SCCT 위기 유형' },
      { field: 'reputationRecovery', desc: '평판 회복 타임라인' },
    ],
    howToUse: [
      '로펌 경영진 위기관리 회의',
      '변호사 개인 평판 방어 매뉴얼',
      '언론 대응 전략 수립',
      '징계 절차 대응 사전 준비',
    ],
    theory:
      'Coombs(2007) SCCT를 법률 서비스에 적용한 접근입니다. 법률가는 직업 윤리와 전문성이 평판의 두 기둥이며, 위기 유형에 따라 "법리로 반박할 것인가 / 사과할 것인가" 선택이 달라져야 합니다.',
    sources: [
      {
        label: 'Coombs (2007) "Protecting Organization Reputations During a Crisis: SCCT"',
        detail: 'Corporate Reputation Review 10(3), 163-176.',
      },
      {
        label: 'Benoit (1997) "Image Repair Discourse and Crisis Communication"',
        detail: 'Public Relations Review 23(2), 177-186.',
      },
      {
        label: 'Galanter (2005) "Lowering the Bar: Lawyer Jokes and Legal Culture"',
        detail: 'University of Wisconsin Press. 법조 평판의 문화적 맥락.',
      },
    ],
  },
  {
    id: 'legal-win-simulation',
    no: 44,
    displayName: '법률 승리 시뮬레이션',
    enName: 'Legal Win Simulation',
    stage: 'Stage 4-Legal',
    stageLabel: '고급 분석 — 법률/로펌',
    model: 'Claude Sonnet 4.6',
    role: '법률 서비스 평판 회복 및 전략 시뮬레이션 전문가',
    whatItDoes:
      '법률 평판 지수·위기·기회를 종합해 평판 회복 확률(0~100%)과 핵심 전략 우선순위를 도출합니다. Cialdini(1984)의 Social Proof 원리에 기반해 승소 사례·의뢰인 후기 활용 방안을 제안하고, 채널별 신뢰 구축 콘텐츠 전략을 수립합니다.',
    methodology: [
      'winProbability = 평판 지수 기반선 ± 위기·기회 가감점',
      'Social Proof 전략: 승소 사례·고객 후기·수상 이력 활용',
      '채널별 신뢰 구축 콘텐츠 — 뉴스·블로그·유튜브·법률 플랫폼',
      '법조계 내 평판 강화 vs 대중 인지도 제고 우선순위',
      '경쟁 로펌 대비 차별화 포지션',
    ],
    inputs: 'legal-reputation-index + legal-crisis-scenario + legal-frame-war',
    outputs: [
      { field: 'recoveryProbability', desc: '평판 회복 확률 (0~100%)' },
      { field: 'socialProofPlan', desc: 'Social Proof 활용 방안' },
      { field: 'channelStrategy', desc: '채널별 신뢰 구축 전략' },
      { field: 'positioning', desc: '차별화 포지션' },
    ],
    howToUse: [
      '로펌 3개년 브랜드 전략 설계',
      '신규 변호사 영입 마케팅 자료',
      '기존 고객 재수임 유도 전략',
      '법률 플랫폼(로톡 등) 프로필 최적화',
    ],
    theory:
      'Cialdini(1984)의 Social Proof는 의사결정자가 선택의 불확실성 앞에서 타인의 행동을 참조한다는 심리학 원리입니다. 법률 서비스는 품질 사전 검증이 어려운 대표적 경험재(experience goods)이므로, Social Proof의 영향력이 특히 크게 작동합니다.',
    sources: [
      {
        label: 'Cialdini (1984) "Influence: The Psychology of Persuasion"',
        detail: 'HarperBusiness. Social Proof 원리의 대중화.',
      },
      {
        label: 'Nelson (1970) "Information and Consumer Behavior"',
        detail: 'Journal of Political Economy 78(2), 311-329. 경험재 개념 원전.',
      },
      {
        label: 'Heinz et al. (2005) "Urban Lawyers"',
        detail: 'University of Chicago Press.',
      },
    ],
  },

  /* ─────────── Stage 4-Retail 유통/브랜드 ─────────── */
  {
    id: 'brand-equity-index',
    no: 45,
    displayName: '브랜드 평판 지수',
    enName: 'Brand Equity Index',
    stage: 'Stage 4-Retail',
    stageLabel: '고급 분석 — 유통/브랜드',
    model: 'Claude Sonnet 4.6',
    role: 'Customer-Based Brand Equity(CBBE) 모델 기반 브랜드 자산 측정 전문가',
    whatItDoes:
      'Keller(1993)의 CBBE 모델 4단계(인지·연상·판단/감정·공명)에 따라 프랜차이즈·유통 브랜드의 자산을 0~100으로 정량화합니다. 소비자·가맹점주·본사 관계자 집단별 인식 차이를 드러내고, 불매운동 리스크 조기 감지 지수를 산출합니다.',
    methodology: [
      'CBBE 4단계 키워드 셋: Salience·Imagery/Performance·Judgments/Feelings·Resonance',
      '집단 분리: 소비자·가맹점주·본사',
      '경쟁 브랜드 대비 상대 포지션 — 같은 카테고리 평균 대비',
      '불매운동 전조 신호: 조직화된 해시태그·반복 게시 패턴',
      '감성 공명 지수 — 브랜드 스토리 반복 인용 강도',
    ],
    inputs: 'sentiment-framing + segmentation + 경쟁 브랜드 리스트',
    outputs: [
      { field: 'brandEquityIndex', desc: '브랜드 자산 지수 (0~100)' },
      { field: 'cbbeStages', desc: 'CBBE 4단계 점수' },
      { field: 'groupPerceptions', desc: '집단별 인식' },
      { field: 'boycottRisk', desc: '불매운동 리스크 지수' },
    ],
    howToUse: [
      '브랜드 매니저 분기 리포트',
      '신제품 출시 전 기존 브랜드 자산 점검',
      '가맹점주 vs 소비자 인식 간극 진단',
      '경쟁 브랜드 대비 광고 전략 수립',
    ],
    theory:
      'Keller(1993)의 Customer-Based Brand Equity 모델은 브랜드 자산을 소비자 인식 관점에서 단계별로 구축되는 피라미드로 모델링한 마케팅 표준 이론입니다. 본 모듈은 전통 설문 측정을 온라인 담론 기반 실시간 측정으로 대체합니다.',
    sources: [
      {
        label:
          'Keller (1993) "Conceptualizing, Measuring, and Managing Customer-Based Brand Equity"',
        detail: 'Journal of Marketing 57(1), 1-22. CBBE 모델 원전.',
      },
      {
        label: 'Aaker (1991) "Managing Brand Equity"',
        detail: 'Free Press. 브랜드 자산 관리의 실무 표준.',
      },
      {
        label:
          'Keller (2001) "Building Customer-Based Brand Equity: A Blueprint for Creating Strong Brands"',
        detail: 'Marketing Management 10(2), 14-19. CBBE 피라미드 모델.',
      },
    ],
  },
  {
    id: 'esg-brand-sentiment',
    no: 46,
    displayName: 'ESG 브랜드 여론',
    enName: 'ESG Brand Sentiment',
    stage: 'Stage 4-Retail',
    stageLabel: '고급 분석 — 유통/브랜드',
    model: 'Claude Sonnet 4.6',
    role: 'ESG 브랜드 여론 및 불매운동 리스크 분석 전문가',
    whatItDoes:
      '프랜차이즈·유통 브랜드에 대한 ESG 3차원(환경·사회·지배구조) 여론을 분리 측정하고, 불매운동 트리거를 분석합니다. 가맹점주 여론과 소비자 여론을 분리해 이해관계 충돌을 파악하며, 그린워싱·사회공헌 허위 주장 패턴을 식별합니다.',
    methodology: [
      'E: 친환경 포장·탄소 배출·플라스틱 / S: 노무·가맹점주 처우·소비자 보호 / G: 본사 갑질·투명성',
      '가맹점주 커뮤니티 vs 소비자 커뮤니티 분리 측정',
      '불매운동 전조 신호: 특정 키워드 급증·조직화 게시글·해시태그',
      '그린워싱 패턴: 공식 메시지와 실제 관행 간 간극',
      'Franchise System Dynamics 가맹-본사 갈등 패턴',
    ],
    inputs: 'sentiment-framing + brand-equity-index + 수집 원시 데이터',
    outputs: [
      { field: 'esgScores', desc: 'ESG 3차원별 점수' },
      { field: 'boycottSignals', desc: '불매운동 전조 신호' },
      { field: 'franchiseConflict', desc: '가맹-본사 갈등 패턴' },
      { field: 'greenwashingFlags', desc: '그린워싱 의심 패턴' },
    ],
    howToUse: [
      '본사 가맹사업부·ESG팀 분기 점검',
      '광고 캠페인 사전 리스크 스캔',
      '가맹점주 커뮤니티 여론 조기 경고',
      'ESG 보고서 허위 논란 방지',
    ],
    theory:
      'GRI Standards와 Kaufmann & Dant(1996)의 Franchise System Dynamics를 결합한 접근입니다. 프랜차이즈는 본사·가맹점·소비자 3자 관계의 이해 충돌이 불가피한 구조이며, ESG 여론은 이 구조적 긴장이 드러나는 첨예한 지점입니다.',
    sources: [
      {
        label: 'GRI Standards (2016 업데이트)',
        detail: 'Global Reporting Initiative. ESG 공시 국제 표준.',
      },
      {
        label: 'Kaufmann & Dant (1996) "Multi-Unit Franchising: Growth and Management Issues"',
        detail: 'Journal of Business Venturing 11(5), 343-358. 프랜차이즈 시스템 동역학.',
      },
      {
        label: 'Delmas & Burbano (2011) "The Drivers of Greenwashing"',
        detail: 'California Management Review 54(1), 64-87.',
      },
    ],
  },
  {
    id: 'retail-crisis-scenario',
    no: 47,
    displayName: '유통 위기 시나리오',
    enName: 'Retail Crisis Scenario',
    stage: 'Stage 4-Retail',
    stageLabel: '고급 분석 — 유통/브랜드',
    model: 'Claude Sonnet 4.6',
    role: '프랜차이즈·유통 위기관리 및 시나리오 플래닝 전문가',
    whatItDoes:
      '유통 특유의 위기(가맹점주 갈등·소비자 불매·식품 안전 사고·오너 리스크)를 확산·통제·역전 3가지 경로로 시뮬레이션합니다. 각 시나리오의 불매운동 전국화 리스크와 가맹점 이탈률을 추정하고, 브랜드 개혁 기회 전환 경로를 제시합니다.',
    methodology: [
      '고정 3시나리오 + 불매운동 전국화 확률',
      '가맹점 이탈률 추정 — 가맹점주 커뮤니티 이탈 신호 기반',
      '가맹점주 vs 소비자 이해 충돌 해결 타임프레임',
      '식품 안전 사고 회복 타임라인',
      'Franchise System Dynamics 기반 본사 대응 옵션',
    ],
    inputs: 'risk-map + brand-equity-index + esg-brand-sentiment',
    outputs: [
      { field: 'scenarios', desc: '3개 시나리오 상세' },
      { field: 'boycottSpread', desc: '불매운동 확산 경로' },
      { field: 'franchiseChurn', desc: '가맹점 이탈률 추정' },
    ],
    howToUse: [
      '본사 위기대응 TFT 회의 자료',
      '가맹점주 협의회 대응 전략',
      '식품안전 사고 회복 로드맵',
      'ESG 불매 리스크 사전 점검',
    ],
    theory:
      'Kaufmann & Dant(1996)의 Franchise System Dynamics는 프랜차이즈 시스템의 구조적 갈등과 변동 메커니즘을 설명한 대표 연구입니다. 본 모듈은 이를 온라인 여론 동역학과 결합해 위기 시나리오를 구성합니다.',
    sources: [
      {
        label: 'Kaufmann & Dant (1996) "Multi-Unit Franchising"',
        detail: 'Journal of Business Venturing 11(5), 343-358.',
      },
      {
        label: 'Coombs (2007) "SCCT"',
        detail: 'Corporate Reputation Review 10(3), 163-176.',
      },
      {
        label: 'Friedman (1999) "Consumer Boycotts"',
        detail: 'Routledge. 불매운동 이론과 실증.',
      },
    ],
  },
  {
    id: 'brand-win-simulation',
    no: 48,
    displayName: '브랜드 승리 시뮬레이션',
    enName: 'Brand Win Simulation',
    stage: 'Stage 4-Retail',
    stageLabel: '고급 분석 — 유통/브랜드',
    model: 'Claude Sonnet 4.6',
    role: '브랜드 자산 강화 및 통합 마케팅 전략 시뮬레이션 전문가',
    whatItDoes:
      '브랜드 평판·ESG 여론·위기 시나리오를 종합해 브랜드 자산 강화 확률(0~100%)과 핵심 전략 우선순위를 도출합니다. 소비자·가맹점주 동시 공략 메시지를 설계하고 SNS·커뮤니티·유튜브 채널별 브랜드 스토리 전략, 불매운동 예방 vs 사후 수습 비용을 비교합니다.',
    methodology: [
      'winProbability = 브랜드 자산 기반선 ± ESG·위기 가감점',
      '소비자·가맹점주 동시 공략 메시지 — 이해관계 상충 최소화',
      '채널별 스토리 전략 — SNS·커뮤니티·유튜브',
      '불매운동 예방 vs 사후 수습 비용 비교',
      'Aaker(1991) 브랜드 자산 5요소 강화 우선순위',
    ],
    inputs: 'brand-equity-index + esg-brand-sentiment + retail-crisis-scenario',
    outputs: [
      { field: 'equityGrowthProbability', desc: '브랜드 자산 강화 확률 (%)' },
      { field: 'channelStrategy', desc: '채널별 스토리 전략' },
      { field: 'boycottPrevention', desc: '불매운동 예방 전략' },
      { field: 'dualTargetMessage', desc: '소비자·가맹점주 동시 공략 메시지' },
    ],
    howToUse: [
      '연간 브랜드 전략 회의 자료',
      '마케팅·가맹사업부 합동 계획',
      '대형 캠페인 런칭 전 리스크 점검',
      '위기 대응 예산 배분 의사결정',
    ],
    theory:
      'Aaker(1991)의 브랜드 자산 5요소(인지·연상·지각된 품질·충성도·기타 자산) 프레임과 통합 마케팅 커뮤니케이션(IMC) 이론을 결합한 접근입니다. 브랜드 자산은 단일 캠페인이 아닌 복수 채널의 일관된 스토리 축적으로 구축됩니다.',
    sources: [
      {
        label: 'Aaker (1991) "Managing Brand Equity"',
        detail: 'Free Press. 브랜드 자산 관리의 기초.',
      },
      {
        label: 'Keller (1993) "CBBE Model"',
        detail: 'Journal of Marketing 57(1), 1-22.',
      },
      {
        label: 'Schultz, Tannenbaum & Lauterborn (1993) "Integrated Marketing Communications"',
        detail: 'NTC Business Books. IMC 표준.',
      },
    ],
  },

  /* ─────────── Stage 4-Fin 금융 ─────────── */
  {
    id: 'investor-sentiment-index',
    no: 49,
    displayName: '투자 심리 지수',
    enName: 'Investor Sentiment Index',
    stage: 'Stage 4-Fin',
    stageLabel: '고급 분석 — 금융/투자 여론',
    model: 'Claude Sonnet 4.6',
    role: '행동재무학(Behavioral Finance) 및 투자자 심리 분석 전문가',
    whatItDoes:
      'Baker & Wurgler(2006)의 투자자 심리 지수 모델과 Kahneman & Tversky(1979) 전망 이론에 기반해 공포-탐욕 스펙트럼(0~100)을 측정합니다. 손실 회피·앵커링·군집 행동 등 6가지 행동 편향을 식별하고, 투자자 집단별(개인·기관·외국인) 심리 방향을 분리 측정합니다. ⚠️ 투자 자문이 아닌 여론 분석 참고 자료입니다.',
    methodology: [
      '심리 지수(0~100): 극단적 공포(0~20) → 중립(41~60) → 극단적 탐욕(81~100)',
      '6가지 행동 편향 추출: 손실 회피·앵커링·군집·확증 편향·가용성·과신',
      '투자자 집단 분리: 개인·기관·외국인 (발화 주체별)',
      '역발상 신호 — 극단적 심리 지점에서의 반대 베팅 시점',
      '⚠️ 면책 문구 필수 포함 — 투자 자문 아님',
    ],
    inputs: 'sentiment-framing + segmentation + 시장 관련 수집 데이터',
    outputs: [
      { field: 'sentimentIndex', desc: '심리 지수 (0~100)' },
      { field: 'sentimentLabel', desc: '극공포/공포/중립/탐욕/극탐욕' },
      { field: 'biasPatterns', desc: '6가지 편향 패턴' },
      { field: 'groupSentiment', desc: '집단별 심리' },
      { field: 'contrarianSignal', desc: '역발상 신호' },
      { field: 'disclaimer', desc: '면책 문구 (필수)' },
    ],
    howToUse: [
      '투자 리서치팀의 여론 보조 지표',
      '시장 코멘터리·뉴스레터 원천 데이터',
      '리스크 관리자의 과열·과매도 조기 경고',
      '개인 투자자 교육 콘텐츠 — 편향 자각 자료',
    ],
    theory:
      'Baker & Wurgler(2006)는 투자자 심리가 체계적으로 자산 가격에 영향을 준다는 것을 실증한 대표 연구이며, Kahneman & Tversky(1979)의 전망 이론은 손실 회피·프레이밍 효과 등 행동 편향의 이론적 기초입니다. 본 모듈은 이를 온라인 담론 기반 실시간 측정으로 구현합니다.',
    sources: [
      {
        label: 'Baker & Wurgler (2006) "Investor Sentiment and the Cross-Section of Stock Returns"',
        detail: 'Journal of Finance 61(4), 1645-1680. 투자자 심리 지수 모델.',
      },
      {
        label: 'Kahneman & Tversky (1979) "Prospect Theory: An Analysis of Decision under Risk"',
        detail: 'Econometrica 47(2), 263-291. 전망 이론 원전.',
      },
      {
        label: 'Barberis & Thaler (2003) "A Survey of Behavioral Finance"',
        detail: 'Handbook of the Economics of Finance. 행동재무학 리뷰.',
      },
    ],
  },
  {
    id: 'information-asymmetry',
    no: 50,
    displayName: '정보 비대칭 분석',
    enName: 'Information Asymmetry',
    stage: 'Stage 4-Fin',
    stageLabel: '고급 분석 — 금융/투자 여론',
    model: 'Claude Sonnet 4.6',
    role: '정보 폭포(Information Cascade) 및 시장 미시구조 분석 전문가',
    whatItDoes:
      'Bikhchandani, Hirshleifer & Welch(1992)의 Information Cascade Theory에 기반해 온라인 군집 행동의 정보 폭포 현상과 선행 지표를 포착합니다. 초기 소수 신호가 군중 모방 행동으로 확산되는 패턴을 식별하고, 스마트머니(기관) 역방향 행동 신호를 감지합니다.',
    methodology: [
      '정보 폭포 패턴: 초기 신호 → 반복 인용 → 군중 모방',
      '선행 지표: 주류 미디어 반영 전 커뮤니티에 먼저 나타나는 신호',
      '정보 공백 영역: 공식 정보 부재로 루머가 채우는 영역',
      '스마트머니 역방향 행동 — 기관 발화 주체 반대 포지션 힌트',
      '정보 비대칭 수준 0~100 정량화',
    ],
    inputs: 'macro-view + message-impact + 시장 관련 데이터',
    outputs: [
      { field: 'asymmetryLevel', desc: '정보 비대칭 수준 (0~100)' },
      { field: 'cascadePatterns', desc: '정보 폭포 현상 목록' },
      { field: 'leadingIndicators', desc: '선행 지표 목록' },
      { field: 'informationGaps', desc: '정보 공백 영역' },
    ],
    howToUse: [
      '투자 리서치의 얼터너티브 데이터 레이어',
      '홍보·IR 팀의 공백 정보 보완',
      '리서치 리포트 발표 타이밍 결정',
      '루머 유포 경로 역추적',
    ],
    theory:
      'Bikhchandani, Hirshleifer & Welch(1992)의 Information Cascade 이론은 개인이 자신의 정보를 무시하고 앞사람의 선택을 따라가는 합리적 군중 행동을 수학적으로 모델링했습니다. 시장 미시구조에서 이 이론은 가격 거품·패닉 매도의 이론적 근거가 됩니다.',
    sources: [
      {
        label:
          'Bikhchandani, Hirshleifer & Welch (1992) "A Theory of Fads, Fashion, Custom, and Cultural Change as Informational Cascades"',
        detail: 'Journal of Political Economy 100(5), 992-1026. Information Cascade 원전.',
      },
      {
        label: 'Banerjee (1992) "A Simple Model of Herd Behavior"',
        detail: 'Quarterly Journal of Economics 107(3), 797-817. 군중 행동 모델.',
      },
      {
        label: 'Shiller (2000) "Irrational Exuberance"',
        detail: 'Princeton University Press. 시장 거품과 심리 연구.',
      },
    ],
  },
  {
    id: 'market-scenario-analysis',
    no: 51,
    displayName: '시장 시나리오 분석',
    enName: 'Market Scenario Analysis',
    stage: 'Stage 4-Fin',
    stageLabel: '고급 분석 — 금융/투자 여론',
    model: 'Claude Sonnet 4.6',
    role: 'Noise Trader Theory 기반 시장 시나리오 분석 전문가',
    whatItDoes:
      'De Long, Shleifer, Summers & Waldmann(1990)의 Noise Trader Theory에 기반해 소음 거래자 심리가 만드는 강세(Bull)·기본(Base)·약세(Bear) 3가지 시장 시나리오를 구성합니다. 노이즈(단기 과잉반응)와 시그널(구조적 변화)을 구분해 각 시나리오의 촉발 이벤트와 확률을 제시합니다.',
    methodology: [
      '고정 3시나리오: bull / base / bear',
      '노이즈 vs 시그널 분리 — 지속성·범위·일관성 기준',
      '각 시나리오의 촉발 이벤트·전개·확률',
      '가장 유력한 시나리오 선정 + 핵심 변수',
      '⚠️ 투자 자문 아님 면책 문구',
    ],
    inputs: 'investor-sentiment-index + information-asymmetry + risk-map',
    outputs: [
      { field: 'scenarios', desc: 'Bull/Base/Bear 3시나리오 (확률·촉발·전개)' },
      { field: 'mostLikely', desc: '가장 유력한 시나리오' },
      { field: 'keyVariables', desc: '핵심 변수' },
    ],
    howToUse: [
      '리서치 리포트의 "여론 기반 시나리오" 섹션',
      '뉴스레터·팟캐스트 콘텐츠 원천',
      '리스크 관리 시나리오 테스트 보조',
      '고객 질의 대응 시 구조화된 답변',
    ],
    theory:
      'De Long et al.(1990)의 Noise Trader Theory는 합리적 차익거래자가 존재하더라도 소음 거래자가 일정 기간 시장 가격을 왜곡시킬 수 있음을 수학적으로 증명했습니다. 이는 "여론이 일시적으로 가격을 움직인다"는 직관에 이론적 근거를 제공합니다.',
    sources: [
      {
        label:
          'De Long, Shleifer, Summers & Waldmann (1990) "Noise Trader Risk in Financial Markets"',
        detail: 'Journal of Political Economy 98(4), 703-738. Noise Trader Theory 원전.',
      },
      {
        label: 'Shleifer & Summers (1990) "The Noise Trader Approach to Finance"',
        detail: 'Journal of Economic Perspectives 4(2), 19-33.',
      },
      {
        label: 'Shiller (2000) "Irrational Exuberance"',
        detail: 'Princeton University Press.',
      },
    ],
  },
  {
    id: 'investment-signal-synthesis',
    no: 52,
    displayName: '투자 신호 종합',
    enName: 'Investment Signal Synthesis',
    stage: 'Stage 4-Fin',
    stageLabel: '고급 분석 — 금융/투자 여론',
    model: 'Claude Sonnet 4.6',
    role: '효율적 시장 가설과 여론 분석을 결합한 종합 신호 도출 전문가',
    whatItDoes:
      '투자 심리·정보 비대칭·시장 시나리오를 종합해 단기(1~2주)·중기(1~3개월) 여론 기반 투자 신호(Strong Buy/Buy/Hold/Sell/Strong Sell)를 도출합니다. 다수 지표가 일치하면 강한 신호, 혼재하면 약한 신호로 판정하고, 극단적 심리 경고와 면책 조항을 필수 포함합니다. ⚠️ 투자 자문이 아니며 공식 재무 분석과 병행이 필수입니다.',
    methodology: [
      '종합 신호 5단계: Strong Buy / Buy / Hold / Sell / Strong Sell',
      '신호 강도(0~100) — 지표 일치도 기반',
      '단기(1~2주) vs 중기(1~3개월) 분리',
      '극단적 심리 경고: 심리 지수 20 이하 또는 80 이상',
      '면책 조항 필수 — 투자 자문 아님, 공식 재무 분석과 병행 필수',
    ],
    inputs: 'investor-sentiment-index + information-asymmetry + market-scenario-analysis',
    outputs: [
      { field: 'overallSignal', desc: '종합 신호 (Strong Buy ~ Strong Sell)' },
      { field: 'signalStrength', desc: '신호 강도 (0~100)' },
      { field: 'shortMediumTerm', desc: '단기·중기 신호 분리' },
      { field: 'extremeWarning', desc: '극단적 심리 경고' },
      { field: 'disclaimer', desc: '면책 조항 (필수)' },
    ],
    howToUse: [
      '투자 뉴스레터의 "여론 시그널" 섹션',
      '개인 투자자 교육 — 편향 자각 자료',
      '리서치 리포트의 정성 지표 보조',
      '리스크 관리 모니터링 체크리스트',
    ],
    theory:
      'Fama(1970)의 효율적 시장 가설(Efficient Market Hypothesis)은 시장이 공개 정보를 즉시 가격에 반영한다고 주장했지만, Shiller(1981) 등의 실증 연구는 시장이 과잉 변동성(excess volatility)을 보이며 여론·심리가 단기 가격 변동의 상당 부분을 설명할 수 있음을 보였습니다. 본 모듈은 EMH를 부정하지 않으면서 "여론이 포착하는 단기 편차"를 보조 지표로 활용합니다.',
    sources: [
      {
        label: 'Fama (1970) "Efficient Capital Markets: A Review of Theory and Empirical Work"',
        detail: 'Journal of Finance 25(2), 383-417. EMH 원전.',
      },
      {
        label:
          'Shiller (1981) "Do Stock Prices Move Too Much to Be Justified by Subsequent Changes in Dividends?"',
        detail: 'American Economic Review 71(3), 421-436. 과잉 변동성 실증.',
      },
      {
        label:
          'Tetlock (2007) "Giving Content to Investor Sentiment: The Role of Media in the Stock Market"',
        detail: 'Journal of Finance 62(3), 1139-1168. 미디어 심리와 주가 상관 연구.',
      },
    ],
  },
];

/* ─────────── 리포트 레벨 메타데이터 ─────────── */

export const REPORT_META = {
  title: 'AI SignalCraft 종합 기술 리포트',
  subtitle:
    '57개 AI 분석 모듈 + 1개 파이프라인 오케스트레이션의 작동 원리·방법론·이론적 근거 — 영업 담당자 및 의사결정자를 위한 상세 명세서',
  classification: '영업 자료 (사내 배포용)',
  audience: '영업 담당자, 도입 검토 의사결정자, 기술 평가자',
  version: '2.0',
};

export const REPORT_SECTIONS = [
  { id: 'summary', no: '한 줄 요약', title: '리포트 한 줄 요약' },
  { id: 'overview', no: '0', title: '제품 개요' },
  { id: 'pipeline', no: '1', title: '4단계 파이프라인' },
  { id: 'sources', no: '2', title: '5개 데이터 소스' },
  { id: 'modules', no: '3', title: '57개 분석 모듈 상세' },
  { id: 'model-strategy', no: '4', title: '멀티 LLM 모델 전략' },
  { id: 'theory', no: '5', title: '이론적 기반 종합' },
  { id: 'comparison', no: '6', title: '경쟁 접근과의 차이' },
  { id: 'limits', no: '7', title: '한계와 정직한 고지' },
  { id: 'references', no: '8', title: '참고 문헌 전체 목록' },
];
