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

export interface ReportModule {
  id: string;
  no: number;
  displayName: string;
  enName: string;
  stage: 'Stage 1' | 'Stage 2' | 'Stage 3' | 'Stage 4';
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
];

/* ─────────── 리포트 레벨 메타데이터 ─────────── */

export const REPORT_META = {
  title: 'AI SignalCraft 종합 기술 리포트',
  subtitle:
    '14개 AI 분석 모듈의 작동 원리·방법론·이론적 근거 — 영업 담당자 및 의사결정자를 위한 상세 명세서',
  classification: '영업 자료 (사내 배포용)',
  audience: '영업 담당자, 도입 검토 의사결정자, 기술 평가자',
  version: '1.0',
};

export const REPORT_SECTIONS = [
  { id: 'summary', no: '한 줄 요약', title: '리포트 한 줄 요약' },
  { id: 'overview', no: '0', title: '제품 개요' },
  { id: 'pipeline', no: '1', title: '4단계 파이프라인' },
  { id: 'sources', no: '2', title: '5개 데이터 소스' },
  { id: 'modules', no: '3', title: '14개 분석 모듈 상세' },
  { id: 'model-strategy', no: '4', title: '멀티 LLM 모델 전략' },
  { id: 'theory', no: '5', title: '이론적 기반 종합' },
  { id: 'comparison', no: '6', title: '경쟁 접근과의 차이' },
  { id: 'limits', no: '7', title: '한계와 정직한 고지' },
  { id: 'references', no: '8', title: '참고 문헌 전체 목록' },
];
