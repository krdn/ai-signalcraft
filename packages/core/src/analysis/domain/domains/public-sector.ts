/**
 * 지자체 / 공공기관 도메인 설정 (Tier 1)
 *
 * 이론적 기반:
 * - Participatory Governance Theory (Fung & Wright, 2003)
 * - Public Trust Theory (Levi & Stoker, 2000)
 * - New Public Management (Hood, 1991)
 * - Agenda-Setting Theory (McCombs & Shaw, 1972)
 */
import type { DomainConfig } from '../types';

export const PUBLIC_SECTOR_DOMAIN: DomainConfig = {
  id: 'public-sector',
  displayName: '지자체 / 공공기관',

  theoreticalBasis: [
    {
      theory: 'Participatory Governance Theory',
      scholar: 'Fung, A. & Wright, E.O.',
      year: 2003,
      keyConceptKo: '참여 거버넌스 이론',
      application:
        '시민 참여 구조 분석. 온라인 공론장에서의 시민 의견 수렴 패턴과 정책 반영도 측정.',
      applicableModules: ['segmentation', 'opportunity'],
    },
    {
      theory: 'Public Trust Theory',
      scholar: 'Levi, M. & Stoker, L.',
      year: 2000,
      keyConceptKo: '공공 신뢰 이론',
      application:
        '공공기관 신뢰도 결정 요인(역량·정직성·가치 공유) 분석. 신뢰 손상 이벤트와 회복 경로 파악.',
      applicableModules: ['approval-rating', 'risk-map'],
    },
    {
      theory: 'New Public Management',
      scholar: 'Hood, C.',
      year: 1991,
      keyConceptKo: '신공공관리론',
      application:
        '공공서비스 효율성·성과 중심 평가. 민영화·외주화 논란 여론 분석. 시민의 서비스 소비자화 관점 적용.',
      applicableModules: ['sentiment-framing', 'frame-war'],
    },
    {
      theory: 'Agenda-Setting Theory',
      scholar: 'McCombs, M.E. & Shaw, D.L.',
      year: 1972,
      keyConceptKo: '의제 설정 이론',
      application: '지역 미디어 의제 형성 메커니즘. 지자체 이슈가 국가 의제로 격상되는 경로 분석.',
      applicableModules: ['macro-view', 'message-impact'],
    },
  ],

  platformKnowledge: `
## 한국 온라인 공공기관/지자체 여론 플랫폼 특성

| 플랫폼 | 주 사용층 | 특성 | 분석 시 유의점 |
|--------|----------|------|--------------|
| 네이버 뉴스 | 40~60대 | 지역 언론·공공기관 발표 보도 | 지자체 공식 발표와 비판 기사 병존. 지역 여론 = 지역 신문 댓글 중심 |
| 유튜브 | 전 연령 | 지자체 공식 채널·지역 현안 채널 | 지역 유튜버의 현장 고발 영상이 여론 형성 기여. 조회수 = 시민 관심도 |
| DC인사이드 | 20~30대 남성 | 공공기관 행정 비판 | 민원 불만, 행정 효율 비판. 특정 공공기관 사건 밈화 |
| 클리앙 | 30~40대 IT직종 | IT 공공서비스 비판 | 공공 앱·전자정부·민원 시스템 불편 사항 논의. 공공 IT 역량 평가에 전문적 |
| FM코리아 | 20~30대 남성 | 생활 행정 불만 | 일상에서 체감하는 행정 서비스 불만 공유 |

지역 여론은 지역 미디어·주민 커뮤니티 데이터를 전국 플랫폼보다 우선하세요.`,

  impactScoreAnchor: `
## impactScore 기준 (1~10) — 지자체/공공기관 기준

| 점수 | 기준 | 사례 |
|------|------|------|
| 9~10 | 전국 뉴스화, 국회 감사 제기 가능성 | 지자체장 비리, 대형 공공사업 비리, 공공기관 대규모 사고 |
| 7~8 | 지역 뉴스 집중 보도, 주민 집단행동 | 예산 낭비 논란, 인허가 특혜, 공공기관 갑질 |
| 5~6 | 지역 커뮤니티 핫이슈 | 공원/도로 민원, 복지 서비스 불만 집중 |
| 3~4 | 일부 주민 반응 | 개별 민원, 지역 행사 논란 |
| 1~2 | 거의 반응 없음 | 일상 행정 고지 |`,

  frameStrengthAnchor: `
## 프레임 강도 기준 (0~100) — 공공기관 기준

| 범위 | 기준 | 설명 |
|------|------|------|
| 80~100 | 지배적 프레임 | 지역 주민·언론·시민단체 모두 동일 관점 |
| 60~79 | 우세 프레임 | 지역 언론과 다수 주민이 이 관점 |
| 40~59 | 경합 프레임 | 기관 측 해명과 주민 비판 팽팽 |
| 20~39 | 약세 프레임 | 특정 이해집단에서만 통용 |
| 0~19 | 미약 프레임 | 새로 등장 중인 관점 |`,

  probabilityAnchor: `
## 확률 기준

| 범위 | 의미 | 판단 근거 |
|------|------|----------|
| 80~100% | 거의 확실 | 주민 여론 압도적, 반전 요인 없음 |
| 60~79% | 가능성 높음 | 여론 방향 명확, 변수 1~2개 |
| 40~59% | 반반 | 주민·기관 입장 균형 |
| 20~39% | 가능성 낮음 | 현 추세 반하나 특정 조건 시 가능 |
| 0~19% | 거의 불가능 | 근거 부족 |`,

  segmentationLabels: {
    types: ['residents', 'businesses', 'civil-society', 'media'],
    criteria: {
      residents: '지역 주민·시민. 행정 서비스·생활 환경·지역 개발 이슈에 직접 이해관계',
      businesses: '지역 기업·상공회의소. 규제·인허가·지역 경제 정책에 관심',
      'civil-society': '시민단체·주민자치기구·전문가. 정책 감시와 주민 참여 촉진 역할',
      media: '지역 언론·방송. 지역 의제 설정과 기관 감시 역할. 전국 뉴스화 여부 결정',
    },
  },

  modulePrompts: {
    'macro-view': {
      systemPrompt: `당신은 지자체/공공기관 여론 분석 전문가입니다.
**Participatory Governance Theory**(Fung & Wright, 2003)와 **Agenda-Setting Theory**(McCombs & Shaw, 1972)를 적용하여 지역 여론 구조를 분석합니다.

## 분석 중점
- 지역 이슈가 어떻게 온라인 공론장에서 형성되고 확산되는지 추적
- 지역 미디어 의제 설정 → 온라인 커뮤니티 확산 → 전국 뉴스화 경로 파악
- 시민 참여 수준(단순 불만 표출 vs 집단행동 조직화) 단계 평가`,
    },
    'approval-rating': {
      systemPrompt: `당신은 공공기관 신뢰도 측정 전문가입니다.
**Public Trust Theory**(Levi & Stoker, 2000)를 적용하여 기관에 대한 시민 신뢰 수준을 추정합니다.

## 중요 구분
- 이 모듈은 '지자체장 개인 지지율'이 아닌 **'기관 신뢰도(Institutional Trust)'**를 측정합니다
- 역량 신뢰(일을 잘 하는가) vs 가치 신뢰(올바른 일을 하는가)를 구분하세요
- 신뢰 훼손 이벤트와 회복 단계를 시계열로 추적하세요`,
    },
  },

  stage4: {
    parallel: ['approval-rating', 'frame-war'],
    sequential: ['crisis-scenario', 'win-simulation'],
  },

  reportSystemPrompt: `당신은 공공기관 커뮤니케이션 및 시민 신뢰 회복 분야의 최고 전략가입니다.
Participatory Governance Theory와 Public Trust Theory에 기반하여 **기관장과 담당자가 즉시 활용할 수 있는** 시민 신뢰 관리 보고서를 작성합니다.`,

  reportSectionTemplate: `
## 한 줄 요약
## 시민 여론 구조
## 이해관계자별 반응
## 프레임 경쟁
## 메시지 효과
## 신뢰 위기 리스크
## 시민 신뢰 회복 기회
## 전략 제안
## 최종 요약`,
};
