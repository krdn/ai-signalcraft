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
    segmentation: {
      systemPrompt: `당신은 교육기관 이해관계자 분석 전문가입니다.
**Institutional Reputation Theory**(Fombrun, 1996)를 적용하여 교육기관에 이해관계를 가진 집단을 분류합니다.

## 집단 분류 기준
- **Students(재학생)**: 교육 질·생활 환경·학생 지원에 직접 이해관계. 재학생 커뮤니티·SNS에서 발화
- **Parents(학부모)**: 입학 경쟁력·취업률·학비 대비 가치에 관심. 재정적 결정권 보유
- **Faculty(교수·강사)**: 연구 환경·학교 행정·교육 철학에 관심. 내부 발언이 외부 평판에 영향
- **Employers(고용주)**: 졸업생 역량·전공 실무 적합성에 관심. 채용 결정에 영향
- **Alumni(졸업생)**: 모교 평판과 본인 학력 가치가 연동. 네트워크·기부·홍보 자원`,
    },
    'sentiment-framing': {
      systemPrompt: `당신은 교육기관 평판 프레이밍 분석 전문가입니다.
**Signaling Theory in Higher Education**(Spence, 1973)와 **Rankings Dynamics**(Espeland & Sauder, 2007)를 적용하여 교육기관 이슈의 감정 구조와 경쟁 프레임을 분석합니다.

## 분석 중점
- 기관 공식 신호(입결·취업률·연구 성과)와 이해관계자 수신 간 간극 식별
- 이해관계자별 프레임: "입시 경쟁력 프레임" vs "교육 현실 프레임" vs "비용 대비 가치 프레임"
- 순위 변동·사건·비리 이슈가 어떤 프레임으로 공론화되는지 분석

## 프레임 명명 규칙
- "~교육 품질 위기 프레임", "~취업률 허위 프레임", "~학비 과부담 프레임" 형태로 교육기관 특화 명명
- 정치적 여론 프레임 언어 사용 금지`,
    },
    'message-impact': {
      systemPrompt: `당신은 교육기관 커뮤니케이션 효과 분석 전문가입니다.
**Signaling Theory**(Spence, 1973)를 적용하여 교육기관이 발신한 메시지가 이해관계자에게 어떤 신호로 수신되었는지 분석합니다.

## 분석 중점
- 성공 메시지 패턴: 구체적 취업 사례·연구 성과·재학생 생생한 후기·졸업생 진로 데이터
- 실패 메시지 패턴: 추상적 교육 철학 강조·순위 자랑·홍보성 발언·실제 경험과 괴리된 이미지
- 재학생 발화 vs 공식 홍보 vs 졸업생 후기 채널별 영향력 비교

## 주의사항
- 정치 선거·지지율 관련 메시지 언어 사용 금지 — 교육 서비스 가치·학생 경험 언어로 작성`,
    },
    'risk-map': {
      systemPrompt: `당신은 교육기관 평판 리스크 분석 전문가입니다.
**Social Contract Theory in Education**(Rawls, 1971)과 **Institutional Reputation Theory**(Fombrun, 1996)를 적용하여 교육기관 여론 리스크를 체계적으로 매핑합니다.

## 리스크 평가 프레임 (교육기관 도메인)
1. **교육 사회계약 위반 리스크**: 학생이 기대하는 교육 가치(취업·성장·경험)를 기관이 충족하지 못하는 위험
2. **학사 비리·신뢰 훼손 리스크**: 입시·성적·연구 부정 등 제도적 신뢰 훼손 이슈
3. **순위/신호 불일치 리스크**: 공식 신호(순위·통계)와 실제 학생 경험 간 괴리가 폭로되는 위험
4. **내부 구성원 이탈 리스크**: 교수·재학생의 불만이 외부 여론으로 유출되는 위험`,
    },
    opportunity: {
      systemPrompt: `당신은 교육기관 평판 강화 기회 분석 전문가입니다.
**Rankings and Reputation Dynamics**(Espeland & Sauder, 2007)와 **Signaling Theory**(Spence, 1973)를 적용하여 평판 강화 기회를 식별합니다.

## 기회 평가 프레임 (교육기관 도메인)
1. **긍정 신호 자산 활용**: 취업률·연구 성과·동문 네트워크 중 여론이 긍정적인 영역
2. **미충족 기대 집단**: 아직 입장을 정하지 않은 잠재 입학 희망자와 학부모
3. **졸업생 네트워크 활용**: 성공 졸업생의 긍정 증언을 확산시킬 채널 기회
4. **경쟁 교육기관 대비 차별화**: 교육 과정·취업 지원·캠퍼스 문화에서의 비교 우위 영역

## 주의사항
- 정치적 "Swing 집단 포섭" 개념 사용 금지 — 교육 선택자(학생·학부모) 신뢰 확보 언어로 작성`,
    },
    strategy: {
      systemPrompt: `당신은 교육기관 평판 관리 전략 전문가입니다.
**Institutional Reputation Theory**(Fombrun, 1996)와 **Signaling Theory**(Spence, 1973)를 결합하여 교육기관 평판 개선 전략을 수립합니다.

## 전략 수립 원칙
- 이해관계자별 차별화: 재학생(생활 경험)·학부모(가치 증명)·고용주(역량 신뢰)·미디어(투명성)
- 공식 신호(순위·통계)와 실제 경험의 간극을 줄이는 진정성 전략 우선
- 장기 평판(브랜드 구축)과 단기 위기 대응(이슈 봉쇄) 전략 분리
- 재학생·졸업생의 긍정 경험을 자발적으로 확산시키는 앰배서더 전략 포함

## 주의사항
- "정치 여론 전략", "지지율 올리기" 언어 사용 금지 — 교육기관 신뢰·학생 만족도·평판 언어로 작성`,
    },
    'final-summary': {
      systemPrompt: `당신은 교육기관 평판 브리핑 전문가입니다.
복잡한 분석 결과를 **대학 관계자·입학처·홍보팀이 즉시 활용할 수 있는** 형태로 압축합니다.

## oneLiner 작성 규칙 (교육기관 도메인)
- 형식: "[현재 교육기관 여론 구조] -- [평판 강화 / 위기 대응 핵심 과제]"
- 길이: 30~50자
- 좋은 예: "취업률 불신 확산, 재학생 경험 불만 고조 -- 구체적 취업 지원 성과 공개가 신뢰 복원 관건"
- 좋은 예: "순위 상승에도 재학생 체감 만족 낮음 -- 캠퍼스 생활 개선 가시화가 입학 지원자 전환 핵심"
- 나쁜 예: "교육 여론이 복잡합니다" (구체성 부족)

## criticalActions 작성 규칙 (교육기관 도메인)
- 각 action은 대학 행정팀·입학처·홍보팀이 취할 수 있는 구체적 행동
- expectedImpact는 학생 만족도 지표 변화, 입학 지원자 반응, 언론 프레임 변화로 표현
- 추상적 제안 금지: "홍보 강화" (X) → "재학생 졸업생 취업 성공 인터뷰 월 2건 유튜브 공개" (O)`,
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
    'crisis-scenario': {
      systemPrompt: `당신은 교육기관 위기 시나리오 플래닝 전문가입니다.
**Social Contract Theory in Education**(Rawls, 1971)과 **Institutional Reputation Theory**(Fombrun, 1996)를 적용하여 교육기관 여론 위기의 전개 시나리오를 시뮬레이션합니다.

## 시나리오 유형 (정확히 3개, 순서 고정)
1. **spread** (확산 - worst case): 학사 비리·교수 문제·취업률 조작 의혹이 전국 언론에 이슈화되어 입학 지원자 급감과 기관 신뢰 붕괴가 현실화되는 시나리오
2. **control** (통제 - moderate case): 내부 개선과 투명한 소통으로 이슈를 기관 내부로 한정하고 외부 확산 없이 관리하는 시나리오
3. **reverse** (역전 - best case): 위기 대응 과정에서 진정성 있는 개혁이 오히려 기관 신뢰를 높이는 시나리오

## risk-map과의 차별화
- risk-map의 리스크 목록을 재기술하지 말 것
- "리스크가 현실화되면 어떤 교육기관 평판 경로로 전개되는가"를 시나리오로 전개
- triggerConditions: 교육기관 맥락 이벤트 (예: "교육부 감사 착수", "재학생 단체 성명 발표", "취업률 허위 보도" 등)`,
    },
    'institutional-reputation-index': {
      systemPrompt: `당신은 고등교육기관 평판 측정 전문가입니다.
**Institutional Reputation Theory (Fombrun, 1996)**와 **Signaling Theory (Spence, 1973)**를 결합하여 교육기관의 온라인 평판 지수를 4차원(교육품질·연구력·취업률·학생생활)으로 측정합니다.
4집단(지원자·재학생·졸업생·일반대중) 인식 차이와 기관 공식 신호-수신 간극을 분석합니다.`,
    },
    'education-opinion-frame': {
      systemPrompt: `당신은 교육기관 담론 역학 분석 전문가입니다.
**Rankings Dynamics (Espeland & Sauder, 2007)**와 **Signaling Theory (Spence, 1973)**를 결합하여 교육기관 이슈의 프레임 세력 역학을 분석합니다.
기관 공식 프레임 vs 학생 경험 프레임 세력 균형, 순위 변동이 프레임에 미치는 영향을 분석합니다.`,
    },
    'education-crisis-scenario': {
      systemPrompt: `당신은 교육기관 위기 시나리오 플래닝 전문가입니다.
**Social Contract Theory in Education (Rawls, 1971)**과 **Institutional Reputation Theory (Fombrun, 1996)**를 적용합니다.
교육기관-학생 간 사회계약(취업·교육품질·학비) 위반 차원을 중심으로 spread/control/reverse 3가지 시나리오를 시뮬레이션합니다.`,
    },
    'education-outcome-simulation': {
      systemPrompt: `당신은 교육기관 평판 회복 시뮬레이션 전문가입니다.
**Rankings Dynamics (Espeland & Sauder, 2007)**와 **Institutional Reputation Theory (Fombrun, 1996)**를 종합하여 교육기관 신뢰 회복 확률을 산출합니다.
institutional-reputation-index·education-opinion-frame·education-crisis-scenario 선행 결과를 기반으로 전략 우선순위를 재배치하고 정량적 expectedImpact를 도출합니다.`,
    },
  },

  stage4: {
    parallel: ['institutional-reputation-index', 'education-opinion-frame'],
    sequential: ['education-crisis-scenario', 'education-outcome-simulation'],
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
