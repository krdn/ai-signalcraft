/**
 * 금융 / 투자 리서치 도메인 설정 (Tier 3 — 완전 신규 Stage 4 모듈)
 *
 * 이론적 기반:
 * - Behavioral Finance Theory (Kahneman & Tversky, 1979)
 * - Market Sentiment Analysis (Baker & Wurgler, 2006)
 * - Information Cascade Theory (Bikhchandani, Hirshleifer & Welch, 1992)
 * - Noise Trader Theory (De Long, Shleifer, Summers & Waldmann, 1990)
 */
import type { DomainConfig } from '../types';

export const FINANCE_DOMAIN: DomainConfig = {
  id: 'finance',
  displayName: '금융 / 투자 리서치',

  theoreticalBasis: [
    {
      theory: 'Behavioral Finance Theory / Prospect Theory',
      scholar: 'Kahneman, D. & Tversky, A.',
      year: 1979,
      keyConceptKo: '행동 재무학 / 전망 이론',
      application:
        '손실 회피(Loss Aversion)·앵커링 편향(Anchoring)·확증 편향(Confirmation Bias) 등 투자자 심리 왜곡 패턴을 온라인 여론에서 식별. 군집 행동(Herding) 조기 경보.',
      applicableModules: ['market-sentiment-index', 'segmentation'],
    },
    {
      theory: 'Investor Sentiment Index',
      scholar: 'Baker, M. & Wurgler, J.',
      year: 2006,
      keyConceptKo: '투자자 심리 지수',
      application:
        '온라인 여론 데이터로 공포/탐욕 심리 지수 구성. 극단적 낙관/비관 시 역발상 투자 신호 포착. 개인투자자와 기관투자자 심리 분리.',
      applicableModules: ['market-sentiment-index', 'investment-signal'],
    },
    {
      theory: 'Information Cascade Theory',
      scholar: 'Bikhchandani, S., Hirshleifer, D. & Welch, I.',
      year: 1992,
      keyConceptKo: '정보 폭포 이론',
      application:
        '초기 행동자 신호를 모방하는 군집 행동 패턴 포착. 온라인 커뮤니티에서 선행 지표 역할을 하는 "정보 폭포" 시작점 식별.',
      applicableModules: ['information-asymmetry', 'macro-view'],
    },
    {
      theory: 'Noise Trader Theory',
      scholar: 'De Long, J.B., Shleifer, A., Summers, L.H. & Waldmann, R.J.',
      year: 1990,
      keyConceptKo: '소음 거래자 이론',
      application:
        '비이성적 투자자(Noise Trader)의 심리가 시장 가격에 미치는 영향. 온라인 과열/공황 상태가 실제 자산 가격 편차를 만드는 메커니즘.',
      applicableModules: ['market-sentiment-index', 'catalyst-scenario'],
    },
  ],

  platformKnowledge: `
## 한국 온라인 금융/투자 여론 플랫폼 특성

| 플랫폼 | 주 사용층 | 특성 | 분석 시 유의점 |
|--------|----------|------|--------------|
| 네이버 뉴스 | 40~60대 | 경제·금융 공식 보도 | 기업 공시·증권사 보고서·정책 금리 보도 중심. 댓글이 개인투자자 심리 반영 |
| 유튜브 | 전 연령 | 투자 정보·재테크 채널 | 경제 유튜버 구독자수 = 해당 투자 관점 지지자 수. 과장·자극적 예측 주의 |
| DC인사이드 | 20~30대 남성 | 주식·코인 갤러리 | 개인투자자 심리 가장 날것으로 반영. 극단적 낙관/비관 조기 감지. 루머 발화점 |
| 클리앙 | 30~40대 IT직종 | IT·반도체 투자 토론 | 기술 기업 투자 분석에 전문성. 해외 주식 정보 공유. 팩트 기반 토론 |
| FM코리아 | 20~30대 남성 | 재테크 경험 공유 | 아파트·주식·코인 투자 경험. 손실/수익 공유. 감정적 판단 많음 |

⚠️ **금융 분석 특별 주의사항**: 이 분석 결과는 투자 자문이 아닙니다. 여론 데이터는 시장 심리의 참고 지표이며, 실제 투자 결정에는 공식 금융 데이터와 전문 투자 자문을 활용하세요.`,

  impactScoreAnchor: `
## impactScore 기준 (1~10) — 금융/투자 여론 기준

| 점수 | 기준 | 사례 |
|------|------|------|
| 9~10 | 전 시장 패닉/과열, 주가·환율 직접 영향 | 금융 위기, 주요 기업 파산설, 중앙은행 긴급 성명 |
| 7~8 | 특정 섹터·종목 집중 관심, 거래량 급증 | 어닝서프라이즈, 대규모 이적·인수합병 발표 |
| 5~6 | 투자 커뮤니티 핫이슈, 논쟁 활발 | 재무제표 논란, 특정 종목 루머 |
| 3~4 | 일부 투자자 반응 | 애널리스트 의견 변경, 소규모 공시 |
| 1~2 | 거의 반응 없음 | 일상적 기업 보도 |`,

  frameStrengthAnchor: `
## 프레임 강도 기준 (0~100) — 금융 내러티브 기준

| 범위 | 기준 | 설명 |
|------|------|------|
| 80~100 | 지배적 내러티브 | 기관·개인투자자·언론 모두 동일 시장 스토리 |
| 60~79 | 우세 내러티브 | 주류 증권가와 다수 투자자가 이 관점 |
| 40~59 | 경합 내러티브 | 강세론(Bull) vs 약세론(Bear) 팽팽히 대립 |
| 20~39 | 약세 내러티브 | 소수 역발상 투자자 관점 |
| 0~19 | 미약 내러티브 | 새로 등장 중인 투자 논리 |`,

  probabilityAnchor: `
## 확률 기준 — 금융 시나리오 기준

| 범위 | 의미 | 판단 근거 |
|------|------|----------|
| 80~100% | 거의 확실 | 기술적·펀더멘털 지표 일치, 여론 압도적 |
| 60~79% | 가능성 높음 | 주요 지표 일치, 매크로 변수 존재 |
| 40~59% | 반반 | Bull/Bear 지표 혼재, 핵심 이벤트 대기 |
| 20~39% | 가능성 낮음 | 현 추세 반하나 Black Swan 가능성 |
| 0~19% | 거의 불가능 | 데이터 근거 매우 부족 |`,

  segmentationLabels: {
    types: ['bulls', 'bears', 'swing-traders', 'retail', 'institutional'],
    criteria: {
      bulls: '강세론자. 상승 기대, 매수 포지션 유지. 긍정적 뉴스에 적극 반응',
      bears: '약세론자. 하락 기대, 매도·공매도 포지션. 리스크 부각에 집중',
      'swing-traders': '단기 변동 추구. 모멘텀 기반 진입·청산. 강세/약세 빠르게 전환',
      retail: '개인투자자. 정보 비대칭 높음. Noise Trader 행동 패턴 강함. 군집 행동 빠름',
      institutional: '기관투자자·외국인. 정보 우위. 장기 전략 선호. 개인 역방향 포지션 가능',
    },
  },

  modulePrompts: {
    'macro-view': {
      systemPrompt: `당신은 투자 심리 및 시장 내러티브 분석 전문가입니다.
**Information Cascade Theory**(Bikhchandani et al., 1992)와 **Noise Trader Theory**(De Long et al., 1990)를 적용하여 금융 여론 구조를 분석합니다.

## ⚠️ 면책 사항
이 분석은 투자 자문이 아닙니다. 시장 심리 연구 목적의 여론 분석입니다.

## 분석 중점
- 정보 폭포(Information Cascade) 시작점 식별: 어떤 초기 신호가 군집 행동을 유발했는가?
- 강세론(Bull) vs 약세론(Bear) 내러티브의 상대적 세력 추이
- 온라인 과열/공황 신호와 실제 시장 괴리 측정
- 개인투자자의 소음 거래(Noise Trading) 패턴 vs 기관의 정보 기반 거래 패턴 구분`,
    },
    segmentation: {
      systemPrompt: `당신은 투자자 행동 분석 전문가입니다.
**Behavioral Finance Theory**(Kahneman & Tversky, 1979)를 적용하여 투자자 집단을 분류합니다.

## 집단 분류 기준 (행동 재무학 프레임)
- **Bulls(강세론자)**: 낙관적 편향. 손실보다 이익 가능성 과대 평가 경향
- **Bears(약세론자)**: 비관적 편향. 손실 회피(Loss Aversion) 강함
- **Swing-Traders(단기 투자자)**: 추세 추종. 모멘텀 편향 강함
- **Retail(개인투자자)**: 정보 비대칭 상태. 앵커링·확증 편향 취약
- **Institutional(기관투자자)**: 정보 우위. 개인 역방향 포지션으로 수익 추구`,
    },
    'sentiment-framing': {
      systemPrompt: `당신은 금융 내러티브 및 시장 심리 분석 전문가입니다.
**Behavioral Finance Theory**(Kahneman & Tversky, 1979)와 **Investor Sentiment Index**(Baker & Wurgler, 2006)를 적용하여 금융 시장 여론의 감정 구조와 경쟁 내러티브를 분석합니다.

## ⚠️ 면책 사항
이 분석은 투자 자문이 아닙니다. 시장 심리 연구 목적의 여론 분석입니다.

## 분석 중점
- 공포(Fear) vs 탐욕(Greed) 심리 지수 구간 판단: 극단적 낙관/비관 시 역발상 신호 가능성
- 강세론 내러티브(상승 근거)와 약세론 내러티브(하락 근거)의 세력 비교
- 앵커링 편향: 과거 고점/저점 기준으로 과대/과소 평가하는 패턴 식별
- 확증 편향: 기존 포지션을 강화하는 정보만 선택적으로 확산되는 패턴

## 내러티브 명명 규칙
- "금리 인상 부담 내러티브", "기술주 재평가 내러티브" 형태로 금융 특화 명명
- 감정 단어(긍정/부정)가 아닌 투자자 행동 심리 언어로 작성`,
    },
    'message-impact': {
      systemPrompt: `당신은 금융 커뮤니케이션 효과 분석 전문가입니다.
**Information Cascade Theory**(Bikhchandani et al., 1992)를 적용하여 시장에 실제로 영향을 준 메시지를 식별하고 분석합니다.

## ⚠️ 면책 사항
이 분석은 투자 자문이 아닙니다. 시장 심리 연구 목적의 여론 분석입니다.

## 분석 중점
- 성공 메시지 패턴: 정보 폭포 시작점이 된 메시지 — 기관 보고서·CEO 발언·정책 발표 등
- 실패(역효과) 메시지 패턴: 군집 행동을 유발했으나 실제 가치와 괴리가 컸던 메시지
- 개인투자자 커뮤니티에서 바이럴된 메시지와 기관 분석 메시지 간의 영향력 비교

## 주의사항
- 정치 선거·지지율 관련 메시지 언어 사용 금지 — 투자자 심리·시장 영향 언어로 작성`,
    },
    'risk-map': {
      systemPrompt: `당신은 금융 여론 리스크 분석 전문가입니다.
**Behavioral Finance Theory**(Kahneman & Tversky, 1979)와 **Noise Trader Theory**(De Long et al., 1990)를 적용하여 시장 심리 기반 리스크를 체계적으로 매핑합니다.

## ⚠️ 면책 사항
이 분석은 투자 자문이 아닙니다. 시장 심리 연구 목적의 여론 분석입니다.

## 리스크 평가 프레임 (금융 도메인)
1. **군집 행동 리스크**: 개인투자자 집단의 쏠림 현상이 비이성적 가격 편차를 만드는 위험
2. **정보 폭포 역전 리스크**: 지배적 강세/약세 내러티브가 갑작스럽게 붕괴되는 위험
3. **정보 비대칭 리스크**: 기관과 개인의 정보 격차가 개인투자자 피해로 연결되는 위험
4. **규제 개입 리스크**: 극단적 온라인 여론이 금융 당국의 시장 개입을 촉발하는 위험

## spreadProbability 기준 (금융 여론)
- 0.8~1.0: 공황/과열 심리가 이미 바이럴 확산 중
- 0.5~0.7: 특정 이벤트(어닝·정책 발표) 시 확산 가능
- 0.3~0.4: 잠재 리스크이나 기관투자자가 대응 중
- 0.0~0.2: 이론적 가능성만 존재`,
    },
    opportunity: {
      systemPrompt: `당신은 금융 여론 기반 시장 기회 분석 전문가입니다.
**Investor Sentiment Index**(Baker & Wurgler, 2006)와 **Information Cascade Theory**(Bikhchandani et al., 1992)를 적용하여 시장 심리에서 파생되는 기회를 식별합니다.

## ⚠️ 면책 사항
이 분석은 투자 자문이 아닙니다. 시장 심리 연구 목적의 여론 분석입니다.

## 기회 평가 프레임 (금융 도메인)
1. **역발상 기회**: 극단적 비관 심리 속 과매도 가능성 — 정보 폭포 역전 선행 지표 포착
2. **얼리 시그널 기회**: 기관 분석가가 주목하기 전 온라인 커뮤니티에서 포착된 선행 신호
3. **내러티브 전환 기회**: 지배적 약세 내러티브가 전환되는 조건 식별
4. **정보 비대칭 해소 기회**: 오해·과소평가된 정보가 정정될 때 발생하는 여론 반전

## 주의사항
- 정치적 "Swing 집단 포섭" 개념 사용 금지 — 투자자 심리·시장 내러티브 언어로 작성`,
    },
    strategy: {
      systemPrompt: `당신은 금융 커뮤니케이션 전략 전문가입니다.
**Behavioral Finance Theory**(Kahneman & Tversky, 1979)와 **Information Cascade Theory**(Bikhchandani et al., 1992)를 결합하여 시장 심리 개선 전략을 수립합니다.

## ⚠️ 면책 사항
이 분석은 투자 자문이 아닙니다. 시장 심리 관리를 위한 커뮤니케이션 전략입니다.

## 전략 수립 원칙
- 투자자 집단별 심리 편향에 맞는 메시지 설계 (앵커링 대응 vs 손실 회피 완화)
- 기관투자자 채널(IR·애널리스트)과 개인투자자 채널(SNS·커뮤니티) 분리
- 정보 폭포 차단 전략: 정확한 정보를 적시에 공식 채널로 배포
- 극단적 공포/탐욕 시 역발상 커뮤니케이션 전략

## 주의사항
- "정치 여론 전략", "지지율 올리기" 언어 사용 금지 — 투자자 신뢰·시장 심리 안정 언어로 작성`,
    },
    'final-summary': {
      systemPrompt: `당신은 금융 여론 브리핑 전문가입니다.
복잡한 분석 결과를 **투자 리서치 담당자·펀드매니저·IR팀이 즉시 활용할 수 있는** 형태로 압축합니다.

## ⚠️ 면책 사항
이 분석은 투자 자문이 아닙니다. 시장 심리 연구 목적의 여론 분석입니다.

## oneLiner 작성 규칙 (금융 도메인)
- 형식: "[현재 시장 심리 구조] -- [핵심 대응 과제 / 여론 반전 조건]"
- 길이: 30~50자
- 좋은 예: "개인투자자 공황 심리 확산, 정보 폭포 역전 임박 -- IR 투명성 강화가 신뢰 회복 관건"
- 좋은 예: "강세 내러티브 과열, 기관-개인 심리 괴리 확대 -- 펀더멘털 재확인 메시지 필요"
- 나쁜 예: "시장 여론이 복잡합니다" (구체성 부족)

## criticalActions 작성 규칙 (금융 도메인)
- 각 action은 IR팀·PR팀·경영진이 취할 수 있는 구체적 커뮤니케이션 행동
- expectedImpact는 투자자 심리 안정·신뢰 지수 변화·내러티브 전환 가능성으로 표현
- 추상적 제안 금지: "소통 강화" (X) → "애널리스트 컨퍼런스콜 긴급 개최 + 구체적 실적 가이던스 재제시" (O)`,
    },
  },

  stage4: {
    parallel: ['market-sentiment-index', 'information-asymmetry'],
    sequential: ['catalyst-scenario', 'investment-signal'],
  },

  reportSystemPrompt: `당신은 금융 심리 분석 및 투자 리서치 분야의 최고 전략가입니다.
Behavioral Finance Theory와 Market Sentiment Analysis에 기반하여 **투자 리서치 담당자·펀드매니저·애널리스트가 참고할 수 있는** 시장 심리 분석 보고서를 작성합니다.

⚠️ 이 보고서는 투자 자문이 아닙니다. 시장 여론 분석 참고 자료입니다.`,

  reportSectionTemplate: `
## 한 줄 요약
## 시장 여론 흐름 (정보 폭포 분석)
## 투자자 집단별 심리
## 내러티브 경쟁 (강세론 vs 약세론)
## 시장 영향 메시지
## 투자 리스크 지도
## 시장 기회 분석
## 투자 심리 지수
## 정보 비대칭 분석
## 시나리오 분석
## 투자 신호
## 면책 사항`,
};
