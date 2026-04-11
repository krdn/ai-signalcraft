/**
 * 스포츠 / 스포츠팀 도메인 설정 (Tier 2)
 *
 * 이론적 기반:
 * - BIRGing/CORFing Theory (Cialdini et al., 1976)
 * - Sport Consumer Motivation Theory (Trail, Anderson & Fink, 2003)
 * - Sport Brand Equity Model (Ross, 2006)
 * - Basking in Reflected Glory (Cialdini et al., 1976)
 */
import type { DomainConfig } from '../types';

export const SPORTS_DOMAIN: DomainConfig = {
  id: 'sports',
  displayName: '스포츠 / 스포츠팀',

  theoreticalBasis: [
    {
      theory: 'BIRGing (Basking in Reflected Glory) / CORFing (Cutting Off Reflected Failure)',
      scholar: 'Cialdini, R.B. et al.',
      year: 1976,
      keyConceptKo: '반사 영광 효과 / 반사 실패 회피',
      application:
        '팀 승리 시 팬들이 정체성을 적극 표출(BIRGing), 패배 시 거리 두기(CORFing) 패턴 분석. 온라인 반응 강도로 팬 충성도 측정.',
      applicableModules: ['fan-loyalty-index', 'segmentation'],
    },
    {
      theory: 'Sport Consumer Motivation Theory',
      scholar: 'Trail, G.T., Anderson, D.F. & Fink, J.S.',
      year: 2003,
      keyConceptKo: '스포츠 소비자 동기 이론',
      application:
        '스포츠 관람 8대 동기(성취·심미성·드라마·탈출·지식·사회화·팀 귀속·선수 귀속) 분석. 각 동기 집단별 맞춤 전략 수립.',
      applicableModules: ['segmentation', 'opportunity'],
    },
    {
      theory: 'Sport Brand Equity Model',
      scholar: 'Ross, S.D.',
      year: 2006,
      keyConceptKo: '스포츠 팀 브랜드 자산 모델',
      application: '팀 브랜드 자산 구성 요소(팀 마크·팀 역사·팀 연상·시즌 성과) 별 여론 측정.',
      applicableModules: ['reputation-index', 'macro-view'],
    },
  ],

  platformKnowledge: `
## 한국 온라인 스포츠 여론 플랫폼 특성

| 플랫폼 | 주 사용층 | 특성 | 분석 시 유의점 |
|--------|----------|------|--------------|
| 네이버 뉴스 | 전 연령 | 스포츠 공식 보도 | 경기 결과·이적·계약 공식 보도 중심. 스포츠 전문 기자의 분석 기사 중요 |
| 유튜브 | 전 연령 | 하이라이트·분석 채널 | 경기 하이라이트 조회수 = 관심도 지표. 팬·전문가 분석 채널 구분 필요 |
| DC인사이드 | 20~30대 남성 | 팀/종목별 갤러리 | 가장 열정적인 팬 집단. 선수·감독 평가, 구단 운영 비판. 밈·유머 활발 |
| 클리앙 | 30~40대 IT직종 | 해외 스포츠 중심 | 해외 스포츠(EPL·NBA·MLB) 관심 높음. 통계 기반 분석 선호 |
| FM코리아 | 20~30대 남성 | 다양한 종목 | 스포츠 유머·밈. 국내외 이슈 균형적으로 다룸 |

스포츠 여론에서는 열혈 팬과 일반 팬, 안티 팬의 반응 비율을 반드시 구분하세요.`,

  impactScoreAnchor: `
## impactScore 기준 (1~10) — 스포츠 여론 기준

| 점수 | 기준 | 사례 |
|------|------|------|
| 9~10 | 전 플랫폼 폭발, 스포츠 외 일반 뉴스화 | 도핑 적발, 선수 범죄, 구단 대형 비리 |
| 7~8 | 스포츠 미디어 집중 보도, 팬덤 전체 반응 | 주요 선수 이적·은퇴, 감독 경질, 챔피언십 결과 |
| 5~6 | 팬 커뮤니티 핫이슈, 댓글 급증 | 경기 판정 논란, 선수 부상, 전술 비판 |
| 3~4 | 일부 팬 반응 | 훈련 장면, 선수 SNS 발언 |
| 1~2 | 거의 반응 없음 | 일상 훈련 공지, 루틴 경기 결과 |`,

  frameStrengthAnchor: `
## 프레임 강도 기준 (0~100) — 스포츠 내러티브 기준

| 범위 | 기준 | 설명 |
|------|------|------|
| 80~100 | 지배적 내러티브 | 팬·안티·미디어 모두 동일 관점 |
| 60~79 | 우세 내러티브 | 팬 다수와 스포츠 미디어가 이 관점 |
| 40~59 | 경합 내러티브 | 지지 팬 vs 안티 팬 간 대립 |
| 20~39 | 약세 내러티브 | 특정 팬 클럽이나 소수에서만 |
| 0~19 | 미약 내러티브 | 새로 등장 중인 관점 |`,

  probabilityAnchor: `
## 확률 기준

| 범위 | 의미 | 판단 근거 |
|------|------|----------|
| 80~100% | 거의 확실 | 팬 여론 압도적, 반전 요인 없음 |
| 60~79% | 가능성 높음 | 방향 명확, 경기 결과 등 변수 존재 |
| 40~59% | 반반 | 팬심 분열 또는 성적 변동성 높음 |
| 20~39% | 가능성 낮음 | 현 흐름 반하나 특정 조건 시 가능 |
| 0~19% | 거의 불가능 | 근거 부족 |`,

  segmentationLabels: {
    types: ['die-hard-fans', 'fair-weather-fans', 'anti-fans', 'casual-viewers'],
    criteria: {
      'die-hard-fans':
        '열혈 팬. 성적과 무관한 지지, 조직적 응원 활동, BIRGing 강함. 팬 커뮤니티 주도',
      'fair-weather-fans': '성적 연동 팬. 승리 시 BIRGing, 패배 시 CORFing 두드러짐. 감정 기복 큼',
      'anti-fans': '선수·팀·구단 운영에 일관된 비판. 경쟁 팀 팬 포함',
      'casual-viewers': '스포츠에 큰 관심 없는 일반 대중. 빅이벤트(월드컵·올림픽)에만 반응',
    },
  },

  modulePrompts: {
    'macro-view': {
      systemPrompt: `당신은 스포츠 마케팅 및 팬덤 분석 전문가입니다.
**BIRGing/CORFing Theory**(Cialdini et al., 1976)와 **Sport Brand Equity Model**(Ross, 2006)을 적용하여 스포츠 팀/선수 여론 구조를 분석합니다.

## 분석 중점
- 경기 성적 변화에 따른 온라인 반응 강도 변화 추적 (BIRGing/CORFing 패턴)
- 팀 브랜드 자산 구성 요소별 여론 강도 측정
- 스포츠 시즌 맥락(시즌 초반/중반/후반/오프시즌)을 반영한 여론 해석`,
    },
    segmentation: {
      systemPrompt: `당신은 스포츠 소비자 행동 분석 전문가입니다.
**Sport Consumer Motivation Theory**(Trail et al., 2003)를 적용하여 팬 집단을 분류합니다.

## 집단 분류 기준 (BIRGing/CORFing 프레임)
- **Die-Hard Fans(열혈팬)**: BIRGing 강함, CORFing 거의 없음. 팬 커뮤니티 주도층
- **Fair-Weather Fans(성적 연동 팬)**: 성적에 따라 BIRGing/CORFing 전환. 가장 많은 비중
- **Anti-Fans(안티팬)**: 일관된 비판. 경쟁 팀 팬, 전술·운영 비판자 포함
- **Casual Viewers(일반 시청자)**: 스포츠 이벤트 시에만 관심. 팬덤 외부`,
    },
  },

  stage4: {
    parallel: ['performance-narrative', 'season-outlook-prediction'],
    sequential: ['fandom-crisis-scenario', 'frame-war'],
  },

  reportSystemPrompt: `당신은 스포츠 마케팅 및 팬덤 전략 분야의 최고 전략가입니다.
BIRGing/CORFing Theory와 Sport Consumer Motivation Theory에 기반하여 **구단·선수 에이전시·스폰서가 즉시 활용할 수 있는** 팬덤 관리 보고서를 작성합니다.`,

  reportSectionTemplate: `
## 한 줄 요약
## 팬덤 여론 흐름
## 팬 집단별 반응 (BIRGing/CORFing 분석)
## 내러티브 경쟁
## 메시지 효과
## 팀/선수 브랜드 리스크
## 팬 참여 강화 기회
## 성과 내러티브 분석
## 시즌 전망
## 전략 제안
## 최종 요약`,
};
