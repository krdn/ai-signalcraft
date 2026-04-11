/**
 * 의료 / 헬스케어 도메인 설정 (Tier 2)
 *
 * 이론적 기반:
 * - Health Belief Model (Rosenstock, 1966)
 * - Risk Perception Theory (Slovic, 1987)
 * - Diffusion of Innovation in Healthcare (Rogers, 2003)
 * - Theory of Planned Behavior (Ajzen, 1991)
 */
import type { DomainConfig } from '../types';

export const HEALTHCARE_DOMAIN: DomainConfig = {
  id: 'healthcare',
  displayName: '의료 / 헬스케어',

  theoreticalBasis: [
    {
      theory: 'Health Belief Model (HBM)',
      scholar: 'Rosenstock, I.M.',
      year: 1966,
      keyConceptKo: '건강 신념 모델',
      application:
        '건강 행동 결정 6요인(인지된 취약성·심각성·이익·장벽·행동 유발 계기·자기효능감) 분석. 의료 정보 수용과 거부 패턴 예측.',
      applicableModules: ['compliance-predictor', 'opportunity'],
    },
    {
      theory: 'Risk Perception Theory',
      scholar: 'Slovic, P.',
      year: 1987,
      keyConceptKo: '위험 인식 이론',
      application:
        '건강 위험에 대한 심리적 인식 왜곡 분석. 전문가 위험 평가와 대중 인식 간 격차 측정. 공포 확산 vs 과소평가 패턴 구분.',
      applicableModules: ['health-risk-perception', 'sentiment-framing'],
    },
    {
      theory: 'Diffusion of Innovation',
      scholar: 'Rogers, E.M.',
      year: 2003,
      keyConceptKo: '혁신 확산 이론',
      application:
        '신의료 기술·치료법·의약품의 사회적 수용 5단계(혁신자→얼리어댑터→전기다수→후기다수→지각수용자) 파악.',
      applicableModules: ['macro-view', 'opportunity'],
    },
    {
      theory: 'Theory of Planned Behavior (TPB)',
      scholar: 'Ajzen, I.',
      year: 1991,
      keyConceptKo: '계획된 행동 이론',
      application:
        '태도·주관적 규범·지각된 행동 통제 3요인으로 의료 순응 의도 예측. 백신 접종, 건강검진 수용도 분석에 적용.',
      applicableModules: ['compliance-predictor', 'segmentation'],
    },
  ],

  platformKnowledge: `
## 한국 온라인 헬스케어 여론 플랫폼 특성

| 플랫폼 | 주 사용층 | 특성 | 분석 시 유의점 |
|--------|----------|------|--------------|
| 네이버 뉴스 | 40~60대 | 의료 보도 중심 | 의학적 정확성 검증 없이 자극적 헤드라인이 여론 형성. 건강 관련 루머 확산 진원지 |
| 유튜브 | 전 연령 | 건강 정보·의학 채널 | 의사 채널 vs 건강 정보 채널 구분 필요. 조회수 높은 영상이 의학적 오정보일 가능성 주의 |
| DC인사이드 | 20~30대 남성 | 질환 경험 공유 | 환자 커뮤니티 성격. 치료 경험 공유와 의료기관 평가. 신뢰성 낮은 민간요법 공유 주의 |
| 클리앙 | 30~40대 IT직종 | 의료 정책 비판 | 의료 시스템·보험·의사 파업 등 정책 이슈에 활발. 논리적 팩트체크 활발 |
| FM코리아 | 20~30대 남성 | 건강 유머·경험 | 건강 이슈를 유머로 처리. 중증 질환보다 일상 건강 이슈 중심 |

의료 정보는 전문가(의사·연구자)·환자·일반 대중을 반드시 구분하세요. 오정보와 정확한 정보를 구별하는 것이 핵심입니다.`,

  impactScoreAnchor: `
## impactScore 기준 (1~10) — 헬스케어 여론 기준

| 점수 | 기준 | 사례 |
|------|------|------|
| 9~10 | 전국적 공중보건 위기, 전 플랫폼 확산 | 신규 감염병 확산, 의료 대란, 대규모 의료사고 |
| 7~8 | 주요 의료 이슈, 언론 집중 보도 | 의사 파업, 백신 부작용 논란, 신약 승인 거부 |
| 5~6 | 특정 질환/의료기관 이슈 | 특정 병원 의료사고, 의료기기 리콜 |
| 3~4 | 제한적 반응, 관련 집단 내부 | 전문학회 논쟁, 특정 치료법 논란 |
| 1~2 | 거의 반응 없음 | 의학 저널 수준 발표, 일상 건강 팁 |`,

  frameStrengthAnchor: `
## 프레임 강도 기준 (0~100) — 헬스케어 기준

| 범위 | 기준 | 설명 |
|------|------|------|
| 80~100 | 지배적 프레임 | 전문가·언론·일반 대중 모두 동일 관점 |
| 60~79 | 우세 프레임 | 주류 의학계와 미디어가 이 관점, 반론 소수 |
| 40~59 | 경합 프레임 | 의학적 근거 vs 환자 경험이 충돌 |
| 20~39 | 약세 프레임 | 특정 환자 집단이나 대체의학 지지자에서만 |
| 0~19 | 미약 프레임 | 새로 등장 중인 의학적 가설 또는 소수 주장 |`,

  probabilityAnchor: `
## 확률 기준

| 범위 | 의미 | 판단 근거 |
|------|------|----------|
| 80~100% | 거의 확실 | 의학적 근거 강하고 여론 일치 |
| 60~79% | 가능성 높음 | 주요 지표 일치, 일부 변수 존재 |
| 40~59% | 반반 | 의학 근거와 대중 인식 괴리 |
| 20~39% | 가능성 낮음 | 현 추세 반하나 특정 조건 시 가능 |
| 0~19% | 거의 불가능 | 의학적·여론적 근거 부족 |`,

  segmentationLabels: {
    types: ['patients', 'caregivers', 'clinicians', 'policymakers', 'public'],
    criteria: {
      patients: '질환 당사자. 치료 경험, 의료비, 접근성에 민감. 환자 커뮤니티에서 발화',
      caregivers: '환자 가족·간병인. 의료 시스템 접근성과 지원 체계에 관심',
      clinicians: '의사·간호사·의료 전문가. 의학적 근거와 임상 경험 기반 의견 제시',
      policymakers: '정부·건강보험 기관·규제기관. 정책 결정 및 의료 시스템 설계 주체',
      public: '일반 대중. 직접 의료 경험 없으나 공중보건 이슈에 반응. 미디어 정보 의존도 높음',
    },
  },

  modulePrompts: {
    'macro-view': {
      systemPrompt: `당신은 공중보건 커뮤니케이션 전문가입니다.
**Diffusion of Innovation Theory**(Rogers, 2003)를 적용하여 의료/건강 이슈의 사회적 확산 패턴을 분석합니다.

## 분석 중점
- 의료 정보·정책·이슈가 어떤 경로로 사회에 확산되는지 추적
- 전문가 커뮤니티 → 미디어 → 일반 대중으로의 정보 흐름 파악
- 의학적 사실과 대중적 인식 간의 격차 식별 (오정보 확산 경로 포함)`,
    },
    segmentation: {
      systemPrompt: `당신은 의료 이해관계자 분석 전문가입니다.
**Theory of Planned Behavior**(Ajzen, 1991)를 적용하여 각 집단의 의료 행동 의도와 장벽을 분석합니다.

## 집단 분류 기준
- **Patients(환자)**: 직접 의료 경험 보유. 치료 효과·부작용·의료비에 반응
- **Caregivers(보호자)**: 간접 경험자. 의료 정보 접근성과 지원 체계에 민감
- **Clinicians(의료진)**: 의학적 근거 기반 논의. 의료 정책·교육·수가에 관심
- **Policymakers(정책 입안자)**: 시스템 차원 접근. 비용·효율·공평성 중심
- **Public(일반 대중)**: 간접 정보 의존. 공중보건 위기 시 공포 및 낙인 반응 가능`,
    },
    'sentiment-framing': {
      systemPrompt: `당신은 헬스케어 리스크 커뮤니케이션 전문가입니다.
**Risk Perception Theory**(Slovic, 1987)를 적용하여 건강 위험에 대한 대중 인식의 편향을 분석합니다.

## Risk Perception 편향 유형
- **공포 요소(Dread Factor)**: 통제 불가능·치명적·불자발적 위험은 실제보다 크게 인식
- **미지성 요소(Unknown Risk)**: 새로운·이해하기 어려운 위험은 실제보다 과대 평가
- **정상화 편향**: 반복 노출된 위험은 실제보다 작게 인식

이 편향들이 데이터에서 어떻게 나타나는지 구체적으로 식별하세요.`,
    },
  },

  stage4: {
    parallel: ['health-risk-perception', 'compliance-predictor'],
    sequential: ['crisis-scenario', 'opportunity'],
  },

  reportSystemPrompt: `당신은 공중보건 및 헬스케어 커뮤니케이션 분야의 최고 전략가입니다.
Health Belief Model과 Risk Perception Theory에 기반하여 **의료기관·정책 입안자·제약사가 즉시 활용할 수 있는** 여론 분석 보고서를 작성합니다.`,

  reportSectionTemplate: `
## 한 줄 요약
## 헬스케어 여론 흐름
## 이해관계자별 반응
## 위험 인식 분석
## 메시지 효과
## 공중보건 리스크
## 순응도 및 수용 기회
## 전략 제안
## 최종 요약`,
};
