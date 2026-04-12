/**
 * 분석 도메인별 도움말 데이터
 * DomainHelpModal에서 사용되는 UI 데이터 (이론 설명, 모듈 설명, 활용 예시 포함)
 */
import type { DomainHelpData } from '../domain-help-modal';

/** 공통 Stage 1~2 모듈 설명 */
const COMMON_MODULES = [
  {
    stage: 'Stage 1',
    label: '초기 분석',
    modules: [
      { name: '거시 여론 구조', description: '시간축 기반 여론 흐름, 변곡점 포착' },
      { name: '집단별 반응', description: '도메인별 집단 분류 및 영향력 평가' },
      { name: '감정/프레임 분석', description: '감정 비율, 키워드, 경쟁 프레임 분석' },
      { name: '메시지 파급력', description: '성공/실패 메시지 식별 및 확산 패턴' },
    ],
  },
  {
    stage: 'Stage 2',
    label: '심화 분석',
    modules: [
      { name: '리스크 지도', description: '5~7개 리스크 도출, 4차원 평가' },
      { name: '기회 분석', description: '긍정 자산, 미개발 영역, 전환 기회 발굴' },
      { name: '전략 도출', description: '타겟·메시지·콘텐츠·리스크 대응 전략' },
      { name: '최종 요약', description: '3분 내 파악 가능한 실행 가능 요약' },
    ],
  },
];

export const DOMAIN_HELP_DATA: Record<string, DomainHelpData> = {
  political: {
    id: 'political',
    displayName: '정치 캠프',
    description:
      '실시간 여론 추적, 지지율 추정, 프레임 전쟁 분석으로 선거 전략을 데이터 기반으로 수립합니다.',
    tagline: '수일이 걸리던 여론 분석을 수시간으로',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: '고급 정치 분석',
        modules: [
          { name: 'AI 지지율 추정', description: '플랫폼 편향 보정, min~max 범위 추정' },
          { name: '프레임 전쟁 분석', description: '진영 간 프레임 세력 역학 분석' },
          { name: '위기 시나리오', description: '확산/통제/역전 3가지 시나리오 시뮬레이션' },
          { name: '승리 시뮬레이션', description: '승리 확률, 승패 조건, 핵심 전략 도출' },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'Framing Theory',
        scholar: 'Entman, R.M.',
        year: 1993,
        keyConceptKo: '프레이밍 이론',
        application: '경쟁 프레임 식별 및 sentiment-framing, frame-war 모듈 핵심 이론',
      },
      {
        theory: 'Agenda-Setting Theory',
        scholar: 'McCombs, M.E. & Shaw, D.L.',
        year: 1972,
        keyConceptKo: '의제 설정 이론',
        application: '미디어 의제 형성 메커니즘 분석, macro-view 모듈 이론적 기반',
      },
      {
        theory: 'Prospect Theory',
        scholar: 'Kahneman, D. & Tversky, A.',
        year: 1979,
        keyConceptKo: '전망 이론',
        application: '유권자 위험 인식 편향 분석, risk-map 모듈 적용',
      },
    ],
    usageExamples: [
      {
        scenario: '선거 D-30, 지지율 정체 돌파',
        context: '여론조사 지지율은 답보 상태, 온라인 여론은 파악 안 됨',
        outcome: '핵심 이탈 유권자 집단 식별 + MZ세대 타겟 메시지 개발로 2주 내 반등',
      },
      {
        scenario: '상대 후보 공격 프레임 방어',
        context: '갑작스러운 네거티브 공세로 여론 악화 중',
        outcome: '프레임 전쟁 분석으로 역공 메시지 설계, 48시간 내 대응 완료',
      },
    ],
  },

  pr: {
    id: 'pr',
    displayName: 'PR / 위기관리',
    description:
      'SCCT 이론 기반 위기 유형 분류, Image Repair Theory 기반 대응 전략, 골든타임 내 실행 계획을 제공합니다.',
    tagline: '수동 클리핑 주 20시간 → 0, 골든타임 사수',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: 'PR 고급 분석',
        modules: [
          {
            name: 'SCCT 위기 유형 분류',
            description: '희생자형/사고형/예방가능형 분류 + Image Repair 전략 5유형 우선순위 매핑',
          },
          { name: '평판 지수', description: 'RepTrak 7차원별 평판 점수 및 취약 지점 식별' },
          { name: '위기 시나리오', description: '확산/통제/역전 시나리오 PR 맥락 적용' },
          { name: '프레임 전쟁', description: '기업 vs 미디어 vs 소비자 프레임 경쟁 분석' },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'Situational Crisis Communication Theory (SCCT)',
        scholar: 'Coombs, W.T.',
        year: 2007,
        keyConceptKo: '상황적 위기 커뮤니케이션 이론',
        application:
          '위기 유형(희생자/사고/예방가능)별 최적 대응 전략 분기. crisis-type-classifier 모듈 핵심 이론',
      },
      {
        theory: 'Image Repair Theory',
        scholar: 'Benoit, W.L.',
        year: 1997,
        keyConceptKo: '이미지 회복 이론',
        application: '평판 회복 전략 5유형(부정/책임회피/비중축소/수정행동/사과) 우선순위 결정',
      },
      {
        theory: 'Issue Management Theory',
        scholar: 'Heath, R.L. & Nelson, R.A.',
        year: 1986,
        keyConceptKo: '이슈 관리 이론',
        application: '이슈 생애주기(잠재→발현→위기→해소) 단계 파악, 선제적 대응 시점 결정',
      },
    ],
    usageExamples: [
      {
        scenario: 'CEO 발언 논란 초기 대응',
        context: '임원 발언이 SNS에서 급속 확산, 언론 포착 임박',
        outcome: 'SCCT 분류: 사고형 위기 → 즉각 사과+수정행동 전략, 24시간 내 성명 발표',
      },
      {
        scenario: '제품 안전 논란 프레임 관리',
        context: '소비자 불만이 커뮤니티에서 조직화, 불매운동 조짐',
        outcome: '평판 지수로 취약 차원 식별 + 타겟 이해관계자별 맞춤 대응 메시지 개발',
      },
    ],
  },

  corporate: {
    id: 'corporate',
    displayName: '기업 평판 관리',
    description:
      'RepTrak 7차원 모델과 이해관계자 이론을 기반으로 기업 평판을 체계적으로 측정하고 관리합니다.',
    tagline: '보고서 작성 3일 → 자동 생성',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: '기업 평판 고급 분석 (ADVN)',
        modules: [
          {
            name: '이해관계자 영향력 지도',
            description: 'Stakeholder Salience Model 기반 권력·합법성·긴급성 3축 현출성 매핑',
          },
          {
            name: 'ESG 여론 분석',
            description: '환경(E)·사회(S)·지배구조(G) 차원별 여론 점수 및 규제 리스크 측정',
          },
          {
            name: '평판 지수 측정',
            description: 'RepTrak 7차원(제품·혁신·직장·거버넌스·시민의식·리더십·재무) 평판 점수',
          },
          {
            name: 'SCCT 위기 유형 분류',
            description: 'Coombs(2007) SCCT로 위기 책임도 분류 + Image Repair 전략 매핑',
          },
          {
            name: '미디어 프레임 의제 설정력',
            description: 'Entman(1993) Framing Theory — 언론 vs 댓글 프레임 간극 + 기업 메시지 반영도',
          },
          {
            name: 'CSR 공약 진정성 간극',
            description: 'Brunsson(1989) 조직 위선 이론 — ESG 공약 신뢰도 + 그린워싱 위험 진단',
          },
          {
            name: '위기 시나리오 (기업)',
            description: 'SCCT 기반 기업 위기 확산/통제/역전 3가지 시나리오 플래닝',
          },
          {
            name: '평판 회복 시뮬레이션',
            description: 'RepTrak·SCCT·SLO 종합 — 평판 회복 목표 달성 확률 + 우선순위 전략',
          },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'RepTrak Model / Corporate Reputation Theory',
        scholar: 'Fombrun, C.J. & van Riel, C.B.M.',
        year: 2004,
        keyConceptKo: '기업 평판 지수 모델',
        application: '제품/혁신/직장/거버넌스/시민의식/리더십/재무 7차원 평판 측정',
      },
      {
        theory: 'Stakeholder Theory',
        scholar: 'Freeman, R.E.',
        year: 1984,
        keyConceptKo: '이해관계자 이론',
        application: '투자자·소비자·임직원·규제기관·미디어 영향력 분석 및 우선순위 결정',
      },
      {
        theory: 'Social License to Operate',
        scholar: 'Thomson, I. & Joyce, S.',
        year: 2000,
        keyConceptKo: '사회적 운영 허가권',
        application: '여론 악화 시 사회적 허가 철회 위험 측정',
      },
      {
        theory: 'Signaling Theory',
        scholar: 'Spence, A.M.',
        year: 1973,
        keyConceptKo: '신호 이론',
        application: '기업 공식 메시지가 이해관계자에게 어떤 신호로 수신되는지 분석',
      },
      {
        theory: 'Media Framing Theory',
        scholar: 'Entman, R.M.',
        year: 1993,
        keyConceptKo: '미디어 프레이밍 이론',
        application: '언론 프레임 vs 온라인 여론 프레임 간극 측정 (media-framing-dominance 모듈)',
      },
      {
        theory: 'Situational Crisis Communication Theory (SCCT)',
        scholar: 'Coombs, W.T.',
        year: 2007,
        keyConceptKo: 'SCCT 위기 커뮤니케이션 이론',
        application: '기업 위기 유형 분류 및 Image Repair 전략 매핑 (crisis-type-classifier 모듈)',
      },
    ],
    usageExamples: [
      {
        scenario: '분기 경영진 보고서 자동화',
        context: '매월 온라인 모니터링 보고서 수동 작성에 3일 소요',
        outcome: 'RepTrak 7차원 자동 분석 + ESG 차원별 취약점 선제 파악으로 즉시 보고 가능',
      },
      {
        scenario: 'M&A 前 평판 리스크 진단',
        context: '인수 대상 기업의 온라인 평판 리스크 빠른 파악 필요',
        outcome: '이해관계자별 불만 패턴과 ESG 위험 요소를 72시간 내 종합 리포트로 제공',
      },
    ],
  },

  fandom: {
    id: 'fandom',
    displayName: '연예인 / 기획사',
    description:
      '팬덤 충성도 지수, 내러티브 경쟁, 컴백 반응 예측으로 팬덤 관계와 콘텐츠 전략을 최적화합니다.',
    tagline: '팬심을 데이터로',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: '팬덤 고급 분석',
        modules: [
          { name: '팬덤 충성도 지수', description: '충성도 신호·이탈 징후·자발적 옹호 분석' },
          {
            name: '팬덤 내러티브 경쟁',
            description: '팬·안티·일반인 발화 주체별 프레임 분석',
          },
          {
            name: '팬덤 위기 시나리오',
            description: '열애·표절·기획사 갈등 등 팬덤 특유 위기',
          },
          { name: '컴백/신곡 반응 예측', description: '팬덤 열기·경쟁환경·플랫폼 기대감 종합' },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'Fan Engagement Ladder',
        scholar: 'Hills, M.',
        year: 2002,
        keyConceptKo: '팬 참여 사다리 모델',
        application: 'Core-Fan/Casual-Fan/Anti-Fan/General-Public 4단계 집단 분류 기반',
      },
      {
        theory: 'Parasocial Relationship Theory',
        scholar: 'Horton, D. & Wohl, R.R.',
        year: 1956,
        keyConceptKo: '준사회적 관계 이론',
        application: '팬과 아티스트 간 감정적 유대 측정, 충성도 지수 이론적 기반',
      },
    ],
    usageExamples: [
      {
        scenario: '컴백 전략 최적화',
        context: '새 앨범 발매 4주 전, 팬덤 온도와 기대감 파악 필요',
        outcome: '반응 예측 점수로 컴백 시기·타이틀곡 방향·플랫폼 홍보 전략 조정',
      },
      {
        scenario: '소속사-팬덤 갈등 위기 관리',
        context: '기획사 결정에 팬덤 반발 확산, 불매 조짐',
        outcome: '핵심팬 vs 이탈팬 비율 정량화 + 내러티브 전환 전략 수립',
      },
    ],
  },

  policy: {
    id: 'policy',
    displayName: '정책 연구 / 싱크탱크',
    description:
      '옹호 연합 프레임워크(ACF)와 단절적 균형 이론을 통해 정책 수용도와 여론 연합 구조를 분석합니다.',
    tagline: '정책 결정을 데이터로 뒷받침',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: '정책 고급 분석',
        modules: [
          { name: '정책 수용도 추정', description: '지지/반대 연합별 수용도 범위 추정' },
          { name: '프레임 전쟁', description: '정책 담론에서 경쟁하는 프레임 세력 분석' },
          { name: '위기 시나리오', description: '정책 저항 확산/통제/역전 시나리오' },
          { name: '통과 시뮬레이션', description: '정책 수용 가능성과 통과 조건 분석' },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'Advocacy Coalition Framework (ACF)',
        scholar: 'Sabatier, P.A. & Jenkins-Smith, H.C.',
        year: 1993,
        keyConceptKo: '옹호 연합 프레임워크',
        application: '정책 지지·반대 연합 집단 식별 및 신념 체계 분석',
      },
      {
        theory: 'Punctuated Equilibrium Theory',
        scholar: 'True, J.L., Jones, B.D. & Baumgartner, F.R.',
        year: 2007,
        keyConceptKo: '단절적 균형 이론',
        application: '정책 여론의 급격한 변화 시점(정책 창) 포착',
      },
      {
        theory: 'Framing Theory',
        scholar: 'Entman, R.M.',
        year: 1993,
        keyConceptKo: '프레이밍 이론',
        application: '경쟁 정책 프레임 분석 및 여론 형성 메커니즘',
      },
    ],
    usageExamples: [
      {
        scenario: '주요 정책 발표 전 여론 사전 조사',
        context: '의료 개혁안 발표 전, 지지·반대 연합 세력 파악 필요',
        outcome: 'ACF 기반 연합 구조 분석 + 핵심 반대 논거 선제 파악으로 소통 전략 수립',
      },
    ],
  },

  finance: {
    id: 'finance',
    displayName: '금융 / 투자 리서치',
    description:
      '⚠️ 이 분석은 투자 자문이 아닙니다. 행동 재무학과 시장 심리 이론으로 투자자 심리와 정보 폭포 현상을 분석합니다.',
    tagline: '시장 심리를 이론으로 읽다',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: '금융 고급 분석 ⚠️',
        modules: [
          {
            name: '투자 심리 지수',
            description: '공포/탐욕 스펙트럼 측정, 행동 재무학 편향 식별',
          },
          {
            name: '정보 비대칭 분석',
            description: '정보 폭포 현상, 선행 지표, 정보 공백 영역 파악',
          },
          { name: '시장 시나리오', description: '강세/기본/약세 3개 시나리오 및 촉발 이벤트' },
          { name: '투자 신호 종합', description: '여론 기반 단기·중기 신호 (투자 자문 아님)' },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'Behavioral Finance Theory / Prospect Theory',
        scholar: 'Kahneman, D. & Tversky, A.',
        year: 1979,
        keyConceptKo: '행동 재무학 / 전망 이론',
        application: '손실 회피·앵커링·군집 행동 등 투자자 심리 왜곡 패턴 식별',
      },
      {
        theory: 'Investor Sentiment Index',
        scholar: 'Baker, M. & Wurgler, J.',
        year: 2006,
        keyConceptKo: '투자자 심리 지수',
        application: '온라인 여론으로 공포/탐욕 심리 지수 구성',
      },
      {
        theory: 'Information Cascade Theory',
        scholar: 'Bikhchandani, S., Hirshleifer, D. & Welch, I.',
        year: 1992,
        keyConceptKo: '정보 폭포 이론',
        application: '군집 행동 패턴 포착 및 정보 폭포 시작점 식별',
      },
    ],
    usageExamples: [
      {
        scenario: '특정 종목 과열 여부 진단',
        context: '커뮤니티 과열 분위기, 실제 매수 타이밍 판단 어려움',
        outcome: '투자 심리 지수 80+ → 역발상 경고 + 군집 행동 패턴 식별으로 신중한 접근 권고',
      },
    ],
  },

  healthcare: {
    id: 'healthcare',
    displayName: '의료 / 헬스케어',
    description:
      'Health Belief Model과 Risk Perception Theory로 건강 위험 인식 편향과 의료 순응도를 예측합니다.',
    tagline: '건강 여론의 과학적 분석',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: '헬스케어 고급 분석',
        modules: [
          {
            name: '건강 위험 인식 분석',
            description: '전문가 평가 vs 대중 인식 간 편향 격차 측정',
          },
          {
            name: '의료 순응도 예측',
            description: 'HBM 6요인 분석으로 집단별 순응 예측 및 장벽 식별',
          },
          { name: '위기 시나리오', description: '공중보건 위기 확산/통제/역전 시나리오' },
          { name: '기회 분석', description: '의료 정보 수용 촉진 기회 발굴' },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'Health Belief Model (HBM)',
        scholar: 'Rosenstock, I.M.',
        year: 1966,
        keyConceptKo: '건강 신념 모델',
        application: '취약성·심각성·이익·장벽·계기·자기효능감 6요인으로 의료 순응 예측',
      },
      {
        theory: 'Risk Perception Theory',
        scholar: 'Slovic, P.',
        year: 1987,
        keyConceptKo: '위험 인식 이론',
        application: '공포요소·미지성·정상화편향 등 위험 인식 편향 유형 식별',
      },
      {
        theory: 'Diffusion of Innovation',
        scholar: 'Rogers, E.M.',
        year: 2003,
        keyConceptKo: '혁신 확산 이론',
        application: '신의료 기술·백신 수용의 5단계 확산 경로 분석',
      },
    ],
    usageExamples: [
      {
        scenario: '백신 접종 캠페인 전략 수립',
        context: '온라인 백신 불신 여론 확산 중, 효과적 캠페인 메시지 필요',
        outcome: '인식 편향 유형 분류 + HBM 장벽 식별로 집단별 맞춤 설득 전략 수립',
      },
    ],
  },

  'public-sector': {
    id: 'public-sector',
    displayName: '지자체 / 공공기관',
    description: '참여 거버넌스 이론과 공공 신뢰 이론으로 시민 여론과 기관 신뢰도를 분석합니다.',
    tagline: '시민 신뢰를 데이터로 관리',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: '공공기관 고급 분석',
        modules: [
          { name: '기관 신뢰도 추정', description: '역량 신뢰 vs 가치 신뢰 분리 측정' },
          { name: '프레임 전쟁', description: '기관 vs 시민·언론 프레임 경쟁 분석' },
          { name: '위기 시나리오', description: '신뢰 위기 확산/통제/회복 시나리오' },
          { name: '신뢰 회복 시뮬레이션', description: '시민 신뢰 회복 경로와 조건 분석' },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'Participatory Governance Theory',
        scholar: 'Fung, A. & Wright, E.O.',
        year: 2003,
        keyConceptKo: '참여 거버넌스 이론',
        application: '시민 참여 구조 분석 및 온라인 공론장 여론 수렴 패턴 측정',
      },
      {
        theory: 'Public Trust Theory',
        scholar: 'Levi, M. & Stoker, L.',
        year: 2000,
        keyConceptKo: '공공 신뢰 이론',
        application: '역량·정직성·가치 공유 3요소로 기관 신뢰도 결정 요인 분석',
      },
    ],
    usageExamples: [
      {
        scenario: '주민 반발 사업 소통 전략',
        context: '지자체 개발 사업에 주민 반발, 조직적 반대 운동 조짐',
        outcome: '반대 집단 핵심 논거 분석 + 시민 신뢰 회복을 위한 참여 소통 전략 수립',
      },
    ],
  },

  education: {
    id: 'education',
    displayName: '대학 / 교육기관',
    description:
      '기관 평판 이론과 신호 이론으로 재학생·학부모·졸업생·고용주의 교육기관 인식을 분석합니다.',
    tagline: '교육 평판을 정량화',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: '교육기관 고급 분석',
        modules: [
          { name: '기관 만족도 추정', description: '재학생·학부모·고용주 만족도 분리 측정' },
          { name: '프레임 전쟁', description: '기관 공식 메시지 vs 학생 경험 프레임 충돌' },
          { name: '평판 위기 시나리오', description: '비리·순위 하락·취업률 논란 시나리오' },
          { name: '평판 강화 전략', description: '평판 회복 및 강화 조건 시뮬레이션' },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'Institutional Reputation Theory',
        scholar: 'Fombrun, C.J.',
        year: 1996,
        keyConceptKo: '기관 평판 이론',
        application: '교육 질·취업률·연구 성과·학생 경험 차원별 평판 측정',
      },
      {
        theory: 'Signaling Theory in Higher Education',
        scholar: 'Spence, A.M.',
        year: 1973,
        keyConceptKo: '신호 이론 (고등교육 적용)',
        application: '대학 순위·취업률이 외부에 발송하는 신호 분석',
      },
    ],
    usageExamples: [
      {
        scenario: '신입생 모집 전략 수립',
        context: '경쟁 대학 대비 인지도 약화, 지원자 감소 우려',
        outcome: '잠재 지원자 집단(수험생·학부모)이 인식하는 평판 차원 파악 + 강조 메시지 개발',
      },
    ],
  },

  sports: {
    id: 'sports',
    displayName: '스포츠 / 스포츠팀',
    description:
      'BIRGing/CORFing 이론과 스포츠 소비자 동기 이론으로 팬덤 심리, 성과 내러티브, 시즌 전망을 분석합니다.',
    tagline: '팬심을 과학으로 분석',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: '스포츠 고급 분석',
        modules: [
          {
            name: '성과 내러티브 분석',
            description: 'BIRGing/CORFing 패턴으로 성적-여론 상관관계 분석',
          },
          {
            name: '시즌 전망 예측',
            description: '팬 기대치 지수, 관전 포인트, 리스크·기회 요인',
          },
          { name: '팬덤 위기 시나리오', description: '팬 이탈, 구단 갈등, 도핑 위기 시나리오' },
          { name: '프레임 전쟁', description: '스포츠 미디어 vs 팬 커뮤니티 프레임 충돌' },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'BIRGing/CORFing Theory',
        scholar: 'Cialdini, R.B. et al.',
        year: 1976,
        keyConceptKo: '반사 영광/실패 회피 이론',
        application: '팀 성적과 팬덤 반응 강도 상관관계 분석, 충성도 지수 기반',
      },
      {
        theory: 'Sport Consumer Motivation Theory',
        scholar: 'Trail, G.T. et al.',
        year: 2003,
        keyConceptKo: '스포츠 소비자 동기 이론',
        application: '스포츠 관람 8대 동기 분석으로 팬 세그먼트 분류',
      },
    ],
    usageExamples: [
      {
        scenario: '시즌 개막 전 팬 참여 전략',
        context: '전 시즌 부진으로 팬 관심 저하, CORFing 패턴 감지',
        outcome: '시즌 전망 분석으로 기대치 지수 파악 + 팬 재결집 내러티브 캠페인 설계',
      },
    ],
  },

  legal: {
    id: 'legal',
    displayName: '법률 / 로펌',
    description:
      '법률 평판 이론과 사회적 증거 이론으로 법률 서비스에 대한 신뢰도와 이해관계자 인식을 분석합니다.',
    tagline: '법률 서비스 평판을 관리',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: '법률 고급 분석',
        modules: [
          { name: '평판 지수', description: '전문성·윤리성·접근성 차원별 법률 평판 측정' },
          { name: '프레임 전쟁', description: '의뢰인 vs 법조계 vs 미디어 프레임 분석' },
          { name: '위기 시나리오', description: '윤리 위반·패소 논란·의뢰비 분쟁 시나리오' },
          { name: '신뢰 회복 전략', description: '법적 맥락에서의 평판 회복 경로 분석' },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'Legal Reputation and Social Capital Theory',
        scholar: 'Heinz, J.P. et al.',
        year: 2005,
        keyConceptKo: '법률 평판 이론',
        application: '전문성·윤리성·접근성·승소율 차원 법률 서비스 신뢰도 분석',
      },
      {
        theory: 'Social Proof Theory',
        scholar: 'Cialdini, R.B.',
        year: 1984,
        keyConceptKo: '사회적 증거 이론',
        application: '판례·승소 사례·의뢰인 후기의 신뢰 형성 영향 분석',
      },
    ],
    usageExamples: [
      {
        scenario: '신규 의뢰인 신뢰 구축 전략',
        context: '온라인 리뷰 부족으로 잠재 의뢰인이 경쟁 로펌을 선택',
        outcome: '사회적 증거 분석으로 부족한 신뢰 신호 식별 + 강화해야 할 평판 차원 파악',
      },
    ],
  },

  retail: {
    id: 'retail',
    displayName: '프랜차이즈 / 유통',
    description:
      'Keller의 CBBE 모델과 소비자 불만 행동 이론으로 브랜드 자산과 소비자 여론을 분석합니다.',
    tagline: '소비자 여론을 브랜드 전략으로',
    analysisModules: [
      ...COMMON_MODULES,
      {
        stage: 'Stage 4',
        label: '프랜차이즈 고급 분석',
        modules: [
          { name: '평판 지수', description: 'CBBE 모델 기반 브랜드 자산 여론 측정' },
          { name: 'ESG 여론 분석', description: 'ESG 차원별 소비자·투자자 여론 분리 측정' },
          { name: '브랜드 위기 시나리오', description: '식품 안전·갑질·가격 인상 위기 시나리오' },
          { name: '브랜드 전략 시뮬레이션', description: '브랜드 충성도 회복 조건 분석' },
        ],
      },
    ],
    theoreticalBasis: [
      {
        theory: 'Customer-Based Brand Equity (CBBE) Model',
        scholar: 'Keller, K.L.',
        year: 1993,
        keyConceptKo: '고객 기반 브랜드 자산 모델',
        application: '브랜드 인지→이미지→반응→공명 4단계 소비자 관계 분석',
      },
      {
        theory: 'Franchise System Dynamics',
        scholar: 'Combs, J.G. & Ketchen, D.J.',
        year: 1999,
        keyConceptKo: '프랜차이즈 시스템 역학',
        application: '본사-가맹점 관계 긴장 구조 및 소비자 여론 전이 패턴 분석',
      },
      {
        theory: 'Customer Complaint Behavior Theory',
        scholar: 'Singh, J.',
        year: 1988,
        keyConceptKo: '소비자 불만 행동 이론',
        application: '불만 행동(성토/전환/무응답) 유형 분류 및 불매운동 조직화 예측',
      },
    ],
    usageExamples: [
      {
        scenario: '신메뉴 출시 전 여론 사전 점검',
        context: '경쟁사 신메뉴 부정 반응 사례 발생 후, 선제적 리스크 파악 필요',
        outcome: '브랜드 자산 현황 파악 + 소비자 집단별 기대치와 우려 사항 사전 파악',
      },
    ],
  },
};
