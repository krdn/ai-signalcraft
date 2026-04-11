/**
 * 법률 / 로펌 도메인 설정 (Tier 1)
 *
 * 이론적 기반:
 * - Legal Reputation Theory (Heinz et al., 2005)
 * - Crisis Communication in Legal Context (Coombs, 2007 적용)
 * - Framing Theory in Legal Discourse (Entman, 1993)
 * - Social Proof Theory (Cialdini, 1984)
 */
import type { DomainConfig } from '../types';

export const LEGAL_DOMAIN: DomainConfig = {
  id: 'legal',
  displayName: '법률 / 로펌',

  theoreticalBasis: [
    {
      theory: 'Legal Reputation and Social Capital Theory',
      scholar: 'Heinz, J.P. et al.',
      year: 2005,
      keyConceptKo: '법률 평판 및 사회적 자본 이론',
      application:
        '법률 서비스 신뢰도 구성 요소(전문성·윤리성·접근성·승소율) 분석. 법률가·로펌 평판 결정 요인 측정.',
      applicableModules: ['reputation-index', 'segmentation'],
    },
    {
      theory: 'Framing Theory in Legal Discourse',
      scholar: 'Entman, R.M.',
      year: 1993,
      keyConceptKo: '법률 담론 프레이밍 이론',
      application:
        '법률 이슈를 다루는 미디어 프레임 분석. 법적 논쟁의 공론화 방식과 여론 형성 과정.',
      applicableModules: ['sentiment-framing', 'frame-war'],
    },
    {
      theory: 'Social Proof Theory',
      scholar: 'Cialdini, R.B.',
      year: 1984,
      keyConceptKo: '사회적 증거 이론',
      application:
        '판례·승소 사례·의뢰인 후기 등 사회적 증거가 법률 서비스 선택에 미치는 영향. 온라인 리뷰 신뢰성 분석.',
      applicableModules: ['message-impact', 'opportunity'],
    },
    {
      theory: 'Situational Crisis Communication Theory (SCCT)',
      scholar: 'Coombs, W.T.',
      year: 2007,
      keyConceptKo: '상황적 위기 커뮤니케이션 이론 (법률 적용)',
      application: '법률가·로펌의 윤리 위반, 사건 패소 논란 등 위기 상황에서의 대응 전략 분기.',
      applicableModules: ['crisis-scenario', 'crisis-type-classifier'],
    },
  ],

  platformKnowledge: `
## 한국 온라인 법률/로펌 여론 플랫폼 특성

| 플랫폼 | 주 사용층 | 특성 | 분석 시 유의점 |
|--------|----------|------|--------------|
| 네이버 뉴스 | 40~60대 | 법조계 보도 | 법원 판결·검찰 수사·변호사 비리 보도 중심. 댓글이 사법 불신·불만 반영 |
| 유튜브 | 전 연령 | 법률 정보·판결 해설 채널 | 법률 유튜버의 사건 해설 조회수 = 이슈 관심도. 의뢰인 피해 고발 영상 주의 |
| DC인사이드 | 20~30대 남성 | 사건·판결 비평 | 특정 판결·변호사 비판 조직화 가능. 감정적 반응 많음 |
| 클리앙 | 30~40대 IT직종 | 법률 정보 공유 | IT·저작권·노동법 관련 분쟁 정보 공유 활발. 팩트 기반 논의 |
| FM코리아 | 20~30대 남성 | 법률 유머·사건 논평 | 유명 재판·판결 유머화. 사법 불신 정서 반영 |

법률 이슈는 당사자(의뢰인·상대방)·법조인·일반 대중의 시각이 크게 다름에 유의하세요.`,

  impactScoreAnchor: `
## impactScore 기준 (1~10) — 법률/로펌 기준

| 점수 | 기준 | 사례 |
|------|------|------|
| 9~10 | 전국 뉴스화, 사법 불신 촉발 | 재판 비리, 변호사 대규모 의뢰비 편취, 무고 사건 |
| 7~8 | 법조 전문 미디어 집중 보도 | 승소율 허위 광고, 의뢰인 정보 유출, 사건 방치 |
| 5~6 | 온라인 법률 커뮤니티 핫이슈 | 특정 로펌 서비스 불만 집중 |
| 3~4 | 일부 의뢰인 불만 | 개별 사건 처리 불만 |
| 1~2 | 거의 반응 없음 | 일상 법률 서비스 피드백 |`,

  frameStrengthAnchor: `
## 프레임 강도 기준 (0~100) — 법률 담론 기준

| 범위 | 기준 | 설명 |
|------|------|------|
| 80~100 | 지배적 담론 | 법조계·언론·대중 모두 동일 관점 |
| 60~79 | 우세 담론 | 주류 법조 미디어가 이 관점 |
| 40~59 | 경합 담론 | 법적 해석 논쟁 또는 의뢰인 vs 로펌 입장 대립 |
| 20~39 | 약세 담론 | 특정 집단에서만 통용 |
| 0~19 | 미약 담론 | 새로 등장 중인 관점 |`,

  probabilityAnchor: `
## 확률 기준

| 범위 | 의미 | 판단 근거 |
|------|------|----------|
| 80~100% | 거의 확실 | 여론 압도적, 반전 요인 없음 |
| 60~79% | 가능성 높음 | 방향 명확, 법적 변수 존재 |
| 40~59% | 반반 | 법적 결과 불확실, 여론 양분 |
| 20~39% | 가능성 낮음 | 특정 조건 시 가능 |
| 0~19% | 거의 불가능 | 근거 부족 |`,

  segmentationLabels: {
    types: ['clients', 'opponents', 'judges-media', 'public'],
    criteria: {
      clients: '의뢰인·잠재 의뢰인. 서비스 품질·신뢰성·비용에 관심. 온라인 후기가 주요 정보 원천',
      opponents: '상대방·경쟁 로펌. 법적 논쟁의 반대 당사자. 부정적 프레임 형성에 영향',
      'judges-media':
        '법조계·법률 미디어. 전문가 시각으로 로펌 역량 평가. 판결문·언론 보도 분석 필요',
      public: '일반 대중. 사법 불신·공정성 이슈에 반응. 사회적 영향력 큰 사건에 관여',
    },
  },

  modulePrompts: {
    'macro-view': {
      systemPrompt: `당신은 법률 서비스 평판 분석 전문가입니다.
**Legal Reputation Theory**(Heinz et al., 2005)와 **Framing Theory**(Entman, 1993)를 적용하여 법률/로펌 여론 구조를 분석합니다.

## 분석 중점
- 법률 이슈의 공론화 경로: 의뢰인 불만 → 온라인 커뮤니티 → 법조 미디어 → 주류 언론
- 전문성·윤리성·접근성 차원별 여론 강도 측정
- 법적 맥락에서의 소통 제약(재판 진행 중 발언 제한 등)을 감안한 분석`,
    },
    segmentation: {
      systemPrompt: `당신은 법률 서비스 이해관계자 분석 전문가입니다.

## 집단 분류 기준
- **Clients(의뢰인)**: 직접 법률 서비스 경험자. 승소율·서비스 품질·비용 대비 가치 평가
- **Opponents(상대방)**: 법적 분쟁 반대 당사자. 부정적 프레임 형성 주체
- **Judges-Media(법조계·미디어)**: 전문 기관과 법률 미디어. 공신력 있는 평가자
- **Public(일반 대중)**: 사법 공정성 이슈에 반응하는 일반 여론`,
    },
  },

  stage4: {
    parallel: ['reputation-index', 'frame-war'],
    sequential: ['crisis-scenario', 'win-simulation'],
  },

  reportSystemPrompt: `당신은 법률 서비스 평판 관리 분야의 최고 전략가입니다.
Legal Reputation Theory와 Framing Theory에 기반하여 **법률 서비스 제공자가 즉시 활용할 수 있는** 평판 관리 보고서를 작성합니다.`,

  reportSectionTemplate: `
## 한 줄 요약
## 법률 서비스 여론 흐름
## 이해관계자별 반응
## 담론/프레임 경쟁
## 메시지 효과
## 평판 리스크
## 신뢰 강화 기회
## 전략 제안
## 최종 요약`,
};
