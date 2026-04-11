/**
 * 대학 / 교육기관 도메인 설정 (Tier 1)
 *
 * 이론적 기반:
 * - Institutional Reputation Theory (Fombrun, 1996)
 * - Signaling Theory in Higher Education (Spence, 1973)
 * - Social Contract Theory in Education (Rawls, 1971)
 * - Rankings and Reputation Management (Espeland & Sauder, 2007)
 */
import type { DomainConfig } from '../types';

export const EDUCATION_DOMAIN: DomainConfig = {
  id: 'education',
  displayName: '대학 / 교육기관',

  theoreticalBasis: [
    {
      theory: 'Institutional Reputation Theory',
      scholar: 'Fombrun, C.J.',
      year: 1996,
      keyConceptKo: '기관 평판 이론',
      application:
        '교육기관 평판 형성 메커니즘 분석. 교육의 질·취업률·연구 성과·학생 경험 등 평판 구성 요소별 여론 측정.',
      applicableModules: ['macro-view', 'segmentation'],
    },
    {
      theory: 'Signaling Theory in Higher Education',
      scholar: 'Spence, A.M.',
      year: 1973,
      keyConceptKo: '신호 이론 (고등교육 적용)',
      application:
        '대학 입결·순위·취업률·졸업생 성과가 외부에 어떤 신호를 발송하는지 분석. 기관의 공식 메시지와 시장 신호 간 일관성 평가.',
      applicableModules: ['message-impact', 'sentiment-framing'],
    },
    {
      theory: 'Rankings and Reputation Dynamics',
      scholar: 'Espeland, W.N. & Sauder, M.',
      year: 2007,
      keyConceptKo: '순위와 평판 역학',
      application:
        '대학 순위 변동이 온라인 여론에 미치는 영향 분석. 순위에 대한 이해관계자별 반응 차이 측정.',
      applicableModules: ['approval-rating', 'opportunity'],
    },
    {
      theory: 'Social Contract Theory in Education',
      scholar: 'Rawls, J.',
      year: 1971,
      keyConceptKo: '교육 사회계약론',
      application:
        '교육기관과 학생·사회 간의 암묵적 계약(교육 제공 vs 수업료·세금 납부) 이행 여부에 대한 여론 분석.',
      applicableModules: ['risk-map', 'frame-war'],
    },
  ],

  platformKnowledge: `
## 한국 온라인 교육기관 여론 플랫폼 특성

| 플랫폼 | 주 사용층 | 특성 | 분석 시 유의점 |
|--------|----------|------|--------------|
| 네이버 뉴스 | 40~60대 | 교육 정책·대학 순위 보도 | 학부모 관점 강함. 입시·취업·교수 비리 이슈에 민감 |
| 유튜브 | 전 연령 | 대학 생활·강의 리뷰 채널 | 재학생 브이로그, 교수 강의 평가, 동아리 활동 등 생생한 학생 경험 파악 가능 |
| DC인사이드 | 20~30대 남성 | 대학 커뮤니티·학과 갤러리 | 각 대학별 갤러리에서 내부 여론 파악 가능. 교수 평가, 학교 행정 비판 |
| 클리앙 | 30~40대 IT직종 | 교육 정책 토론 | 의대 정원·교육 개혁·원격교육 정책에 활발한 토론. 학부모·졸업생 시각 |
| FM코리아 | 20~30대 남성 | 취업·학력 관련 유머 | 취업·고용 시장 연계 교육 이슈. 학력 인플레이션 관련 반응 |

교육기관 여론에서는 재학생·학부모·졸업생(취업자)·교수진의 시각이 매우 다름을 감안하세요.`,

  impactScoreAnchor: `
## impactScore 기준 (1~10) — 교육기관 기준

| 점수 | 기준 | 사례 |
|------|------|------|
| 9~10 | 전국 뉴스화, 교육부 조사 가능성 | 교수 성범죄, 대규모 학사 비리, 연구 부정 |
| 7~8 | 교육 전문 언론 집중 보도 | 순위 급락, 취업률 조작 의혹, 등록금 인상 논란 |
| 5~6 | 학내 커뮤니티 핫이슈 | 강의 평가 논란, 학교 시설 불만 |
| 3~4 | 일부 재학생 반응 | 개별 교수 수업 방식 비판 |
| 1~2 | 거의 반응 없음 | 일상적 학교 공지 |`,

  frameStrengthAnchor: `
## 프레임 강도 기준 (0~100) — 교육기관 기준

| 범위 | 기준 | 설명 |
|------|------|------|
| 80~100 | 지배적 프레임 | 재학생·학부모·언론 모두 동일 관점 |
| 60~79 | 우세 프레임 | 주요 이해관계자가 이 관점, 반론 소수 |
| 40~59 | 경합 프레임 | 기관 측 설명과 학생 경험이 충돌 |
| 20~39 | 약세 프레임 | 특정 재학생이나 교수진에서만 통용 |
| 0~19 | 미약 프레임 | 새로 등장 중인 관점 |`,

  probabilityAnchor: `
## 확률 기준

| 범위 | 의미 | 판단 근거 |
|------|------|----------|
| 80~100% | 거의 확실 | 여론 압도적, 반전 요인 없음 |
| 60~79% | 가능성 높음 | 방향 명확, 변수 1~2개 |
| 40~59% | 반반 | 이해관계자 간 의견 혼재 |
| 20~39% | 가능성 낮음 | 특정 조건 시 가능 |
| 0~19% | 거의 불가능 | 근거 부족 |`,

  segmentationLabels: {
    types: ['students', 'parents', 'faculty', 'employers', 'alumni'],
    criteria: {
      students: '재학생. 교육 질·학교 시설·학생 지원·학교 문화에 직접 이해관계',
      parents: '학부모. 입시 경쟁력·취업률·학비 대비 가치에 관심. 재정적 결정권 보유',
      faculty: '교수·강사. 교육 철학·연구 환경·학교 행정에 관심. 내부 발언 외부 유출 가능',
      employers: '기업·채용 담당자. 졸업생 역량·전공 실무 적합성에 관심',
      alumni: '졸업생. 모교 평판과 본인 학력 가치가 연동됨. 네트워크·동문회 활동',
    },
  },

  modulePrompts: {
    'macro-view': {
      systemPrompt: `당신은 고등교육기관 평판 분석 전문가입니다.
**Institutional Reputation Theory**(Fombrun, 1996)와 **Rankings Dynamics**(Espeland & Sauder, 2007)를 적용하여 교육기관 여론 구조를 분석합니다.

## 분석 중점
- 교육기관 평판 구성 요소(교육 질·취업률·연구 성과·캠퍼스 문화)별 여론 분류
- 재학생 경험 vs 외부 평판(순위·언론)의 일치도 분석
- 여론 변화의 트리거 이벤트(사건·비리·정책 변화) 추적`,
    },
    'approval-rating': {
      systemPrompt: `당신은 교육기관 만족도 분석 전문가입니다.
이 모듈은 정치적 지지율이 아닌 **'기관 만족도(Institutional Satisfaction Rate)'**를 측정합니다.

## 측정 차원
- 재학생 만족도: 교육 질·생활 환경·학생 지원
- 학부모 만족도: 입학 가치·취업 연계·학비 대비 효과
- 고용주 만족도: 졸업생 준비도·전공 실무 역량
- 사회적 평판: 언론·일반 대중의 기관 인식`,
    },
  },

  stage4: {
    parallel: ['approval-rating', 'frame-war'],
    sequential: ['crisis-scenario', 'win-simulation'],
  },

  reportSystemPrompt: `당신은 고등교육 평판 관리 분야의 최고 전략가입니다.
Institutional Reputation Theory와 Signaling Theory에 기반하여 **대학 관계자·입학처·홍보팀이 즉시 활용할 수 있는** 평판 관리 보고서를 작성합니다.`,

  reportSectionTemplate: `
## 한 줄 요약
## 교육기관 여론 흐름
## 이해관계자별 반응 (재학생/학부모/졸업생/교수)
## 프레임 경쟁
## 메시지 효과
## 평판 리스크
## 평판 강화 기회
## 전략 제안
## 최종 요약`,
};
