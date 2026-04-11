/**
 * 기업 평판 관리 도메인 설정
 *
 * 이론적 기반:
 * - RepTrak Model / Corporate Reputation Theory (Fombrun & van Riel, 2004)
 * - Stakeholder Theory (Freeman, 1984)
 * - Social License to Operate (Thomson & Joyce, 2000)
 * - Signaling Theory (Spence, 1973)
 */
import type { DomainConfig } from '../types';

export const CORPORATE_DOMAIN: DomainConfig = {
  id: 'corporate',
  displayName: '기업 평판 관리',

  theoreticalBasis: [
    {
      theory: 'RepTrak Model / Corporate Reputation Theory',
      scholar: 'Fombrun, C.J. & van Riel, C.B.M.',
      year: 2004,
      keyConceptKo: '기업 평판 지수 모델 (RepTrak)',
      application:
        '제품/서비스·혁신·직장환경·거버넌스·시민의식·리더십·재무성과 7개 차원으로 기업 평판 측정. 각 차원별 온라인 여론을 매핑하여 평판 취약 지점 식별.',
      applicableModules: ['stakeholder-map', 'esg-sentiment'],
    },
    {
      theory: 'Stakeholder Theory',
      scholar: 'Freeman, R.E.',
      year: 1984,
      keyConceptKo: '이해관계자 이론',
      application:
        '투자자·소비자·임직원·규제기관·미디어 등 핵심 이해관계자 식별 및 영향력 매핑. 이해관계자별 기대와 현실 간 갭 분석.',
      applicableModules: ['stakeholder-map', 'segmentation'],
    },
    {
      theory: 'Social License to Operate',
      scholar: 'Thomson, I. & Joyce, S.',
      year: 2000,
      keyConceptKo: '사회적 운영 허가권',
      application:
        '기업이 사회로부터 암묵적으로 부여받는 운영 허가 개념. 여론 악화 시 SLO 철회 위험 측정.',
      applicableModules: ['risk-map', 'opportunity'],
    },
    {
      theory: 'Signaling Theory',
      scholar: 'Spence, A.M.',
      year: 1973,
      keyConceptKo: '신호 이론',
      application:
        '기업의 공시, 경영진 발언, CSR 활동이 이해관계자에게 어떤 신호로 해석되는지 분석. 의도와 수신 간 간극 측정.',
      applicableModules: ['message-impact', 'sentiment-framing'],
    },
  ],

  platformKnowledge: `
## 한국 온라인 기업 평판 플랫폼 특성

| 플랫폼 | 주 사용층 | 특성 | 분석 시 유의점 |
|--------|----------|------|--------------|
| 네이버 뉴스 | 40~60대 | 주류 경제·기업 보도 | 주요 언론 보도 = 공식 기업 이미지. 기사 댓글이 소비자·일반 대중 여론 반영 |
| 유튜브 | 전 연령 | 기업 리뷰·제품 언박싱·고발 영상 | 소비자 경험 콘텐츠 풍부. 조회수 높은 부정 영상은 평판에 장기적 영향 |
| DC인사이드 | 20~30대 남성 | 소비자 집단 비판 문화 | 불만 결집 및 조직적 불매운동 진원지가 되는 경우 존재. 유머로 포장된 비판 주의 |
| 클리앙 | 30~40대 IT직종 | 소비자·투자자 관점 분석 | IT·전자제품·금융상품 관련 정보 정확성 높음. AS·약관 이슈에 민감 |
| FM코리아 | 20~30대 남성 | 소비자 경험 공유 | 제품·서비스 불만이 유머로 확산되는 패턴. 초기 감지 중요 |

기업 이슈는 투자자(주가 관련)·소비자(제품·서비스)·임직원(노무·복지)·규제기관(법·규정) 측면을 분리해서 해석하세요.`,

  impactScoreAnchor: `
## impactScore / negativeScore 기준 (1~10) — 기업 평판 기준

| 점수 | 기준 | 사례 예시 |
|------|------|----------|
| 9~10 | 전 플랫폼 동시 확산, 주가 영향, 규제기관 개입 가능성 | 대규모 리콜, 회계 비리, CEO 도덕성 스캔들 |
| 7~8 | 복수 플랫폼 확산, 주요 경제지 보도, 소비자 집단행동 시작 | 서비스 장애 반복, 직원 처우 논란, 환경 위반 |
| 5~6 | 단일 플랫폼 핫이슈, 업계 내부 주목 | 고객 서비스 불만 집중, 마케팅 역효과 |
| 3~4 | 일부 반응, 주목도 낮음 | 개별 불만 접수, 소규모 커뮤니티 논의 |
| 1~2 | 거의 반응 없음 | 일상적 고객 피드백 수준 |`,

  frameStrengthAnchor: `
## 프레임 강도 기준 (0~100) — 기업 평판 기준

| 범위 | 기준 | 설명 |
|------|------|------|
| 80~100 | 지배적 프레임 | 언론·소비자·투자자 모두 동일 관점 |
| 60~79 | 우세 프레임 | 주요 미디어와 다수 이해관계자가 이 관점 |
| 40~59 | 경합 프레임 | 기업 주장과 비판 여론이 팽팽히 맞섬 |
| 20~39 | 약세 프레임 | 특정 이해관계자 그룹 내에서만 통용 |
| 0~19 | 미약 프레임 | 거의 언급되지 않거나 새로 등장 중 |`,

  probabilityAnchor: `
## 확률 기준

| 범위 | 의미 | 판단 근거 |
|------|------|----------|
| 80~100% | 거의 확실 | 현재 추세 명확, 반전 요인 없음 |
| 60~79% | 가능성 높음 | 주요 지표 방향 일치, 변수 1~2개 존재 |
| 40~59% | 반반 | 지표 혼재, 핵심 변수 미결정 |
| 20~39% | 가능성 낮음 | 현 추세 반하나 특정 조건 시 가능 |
| 0~19% | 거의 불가능 | 데이터 근거 부족 |`,

  segmentationLabels: {
    types: ['investors', 'consumers', 'employees', 'regulators', 'media'],
    criteria: {
      investors: '투자자·주주. 주가·수익성·지배구조에 관심. ESG 요인 중시 추세',
      consumers: '소비자·고객. 제품 품질·가격·서비스에 관심. 불만 집단행동 가능',
      employees: '임직원·구직자. 복지·조직문화·고용안정에 관심. 내부 발언이 외부로 확산 가능',
      regulators: '규제기관·정부·공공기관. 법규 준수·공정거래·환경 기준 모니터링',
      media: '언론·경제지·전문 미디어. 기업 정보 게이트키퍼 역할. 프레임 형성 핵심',
    },
  },

  modulePrompts: {
    'macro-view': {
      systemPrompt: `당신은 기업 평판 관리 전문가입니다.
온라인 데이터에서 **기업을 둘러싼 여론의 흐름과 평판 변화 추이**를 분석합니다.

## 이론적 기반
- **RepTrak Model** (Fombrun & van Riel, 2004): 7개 차원(제품·혁신·직장·거버넌스·시민의식·리더십·재무) 중 어떤 차원이 이슈화되었는지 분류
- **Social License to Operate** (Thomson & Joyce, 2000): 여론 악화가 기업의 사회적 운영 허가에 미치는 영향 추적

## 분석 중점
- 어떤 RepTrak 차원이 긍정/부정 여론을 주도하는지 파악
- 이해관계자 집단별로 관심 차원이 다름에 유의 (투자자 = 재무·거버넌스, 소비자 = 제품·서비스)
- 여론 변화의 촉발 이벤트와 지속 기간 분석`,
    },
    segmentation: {
      systemPrompt: `당신은 기업 이해관계자 분석 전문가입니다.
**Stakeholder Theory(Freeman, 1984)**를 적용하여 기업에 영향을 미치거나 영향을 받는 핵심 집단을 분류합니다.

## 집단 분류 기준
- **Investors(투자자)**: 주가·수익성·ESG 평가에 반응. 경제지·투자 커뮤니티에서 주로 발화
- **Consumers(소비자)**: 제품·가격·서비스 품질에 반응. 리뷰·커뮤니티에서 발화
- **Employees(임직원)**: 복지·문화·고용 이슈에 반응. 잡플래닛·블라인드 등에서 발화
- **Regulators(규제기관)**: 법규 위반·공정거래·환경 이슈. 공식 발표·뉴스를 통해 영향력 행사
- **Media(미디어)**: 모든 이슈의 프레임 형성 주체. 언론 논조와 소비자 여론의 상관관계 파악 필수`,
    },
    'risk-map': {
      systemPrompt: `당신은 기업 평판 리스크 전문가입니다.
**RepTrak 7개 차원**에 걸쳐 현재 잠재된 평판 리스크를 체계적으로 매핑합니다.

## 리스크 평가 프레임
각 리스크를 RepTrak 차원으로 분류하고 다음 4가지 측면을 평가하세요:
1. **이해관계자 민감도**: 어느 집단이 가장 강하게 반응하는가?
2. **확산 채널**: 어느 플랫폼에서 시작하여 어디로 퍼지는가?
3. **비즈니스 영향**: 매출·주가·채용·규제 중 어느 영역에 직접 타격이 있는가?
4. **회복 가능성**: 평판 회복에 걸리는 시간과 필요한 자원 규모 추정`,
    },
    strategy: {
      systemPrompt: `당신은 기업 평판 전략 전문가입니다.
**RepTrak 차원별 취약점**을 보완하는 맞춤형 전략을 수립합니다.

## 전략 수립 원칙
- 이해관계자별로 다른 메시지와 채널 전략 수립
- 단기(위기 대응)와 장기(평판 구축) 전략을 분리하여 제시
- ESG 관련 리스크는 규제 대응과 자발적 개선 두 경로로 나누어 접근
- 내부 이해관계자(임직원) 신뢰 복원이 외부 평판 회복의 선결 조건임을 반드시 포함`,
    },
  },

  stage4: {
    parallel: ['stakeholder-map', 'esg-sentiment'],
    sequential: ['crisis-scenario', 'win-simulation'],
  },

  reportSystemPrompt: `당신은 기업 평판 관리 분야의 최고 전략가입니다.
RepTrak 모델과 이해관계자 이론에 기반하여 **경영진이 즉시 활용 가능한** 평판 관리 전략 보고서를 작성합니다.`,

  reportSectionTemplate: `
## 한 줄 요약
## 평판 현황 (RepTrak 차원별)
## 이해관계자별 반응
## 프레임/감정 분석
## 메시지 효과
## 리스크 지도
## 기회 분석
## 이해관계자 영향력 지도
## ESG 여론 분석
## 전략 제안
## 최종 요약`,
};
