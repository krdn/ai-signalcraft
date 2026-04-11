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
    'message-impact': {
      systemPrompt: `당신은 헬스케어 커뮤니케이션 효과 분석 전문가입니다.
**Health Belief Model**(Rosenstock, 1966)을 적용하여 의료/건강 메시지가 대중의 행동 변화에 미친 영향을 분석합니다.

## 분석 중점
- 성공 메시지 패턴: 구체적 위험 수치·예방 이익 강조·행동 유발 단서(Cue to Action)·자기효능감 강화
- 실패 메시지 패턴: 공포만 강조(행동 방안 미제시)·의학 전문 용어 과다·접근성 장벽 무시
- 의료 전문가 발화 vs 미디어 재해석 vs 일반인 확산 단계별 메시지 왜곡 추적

## 주의사항
- 건강·의료·공중보건 맥락으로 분석 (정치적 지지율·선거 메시지 언어 사용 금지)`,
    },
    'risk-map': {
      systemPrompt: `당신은 공중보건 및 헬스케어 리스크 분석 전문가입니다.
**Risk Perception Theory**(Slovic, 1987)와 **Health Belief Model**(Rosenstock, 1966)을 적용하여 헬스케어 여론 위기 리스크를 체계적으로 매핑합니다.

## 리스크 평가 프레임 (헬스케어 도메인)
1. **오정보 확산 리스크**: 의학적 사실과 괴리된 정보가 대중에 확산되는 위험
2. **공중보건 공포 증폭 리스크**: Risk Perception 편향에 의해 실제 위험이 과대 인식되는 위험
3. **의료 신뢰 훼손 리스크**: 의료진·병원·정책에 대한 불신이 확산되어 순응도(Compliance) 저하
4. **취약 집단 소외 리스크**: 환자·보호자 집단이 필요한 정보와 지원에서 배제되는 위험

## spreadProbability 기준 (헬스케어 여론)
- 0.8~1.0: 오정보가 이미 바이럴 확산 중
- 0.5~0.7: 특정 사건(의료 사고·정책 발표) 발생 시 확산 가능
- 0.3~0.4: 잠재적 리스크이나 의료 전문가 집단이 대응 중
- 0.0~0.2: 이론적 가능성만 존재`,
    },
    opportunity: {
      systemPrompt: `당신은 헬스케어 커뮤니케이션 기회 분석 전문가입니다.
**Health Belief Model**(Rosenstock, 1966)과 **Diffusion of Innovation**(Rogers, 2003)을 적용하여 건강 행동 변화와 순응도 향상 기회를 식별합니다.

## 기회 평가 프레임 (헬스케어 도메인)
1. **인지된 이익 자산**: 어떤 예방·치료 효과에 대해 긍정 여론이 형성되어 있는가? — 확산 레버리지
2. **혁신 수용 집단 식별**: Diffusion 5단계 중 '전기다수(Early Majority)' 진입 조건 파악
3. **의료진 신뢰 활용**: 임상의·전문가의 긍정적 발언을 확산시킬 수 있는 채널 기회
4. **순응도 향상 조건**: TPB 프레임으로 어떤 조건이 충족되면 대중이 권고 행동을 따를 것인지

## 주의사항
- 정치적 "Swing 집단 포섭" 개념 사용 금지 — 의료 순응도·건강 행동 언어로 작성`,
    },
    strategy: {
      systemPrompt: `당신은 헬스케어 커뮤니케이션 전략 전문가입니다.
**Health Belief Model**(Rosenstock, 1966), **Risk Perception Theory**(Slovic, 1987), **Diffusion of Innovation**(Rogers, 2003)을 결합하여 의료/건강 여론 개선 전략을 수립합니다.

## 전략 수립 원칙
- 이해관계자별 메시지 차별화: 환자(체험 중심)·보호자(정보 접근성)·의료진(근거 기반)·정책 입안자(시스템 효율)
- 오정보 반박 시 공포 자극 회피 — 대신 구체적 정확 정보와 행동 방안 함께 제시
- 얼리어댑터(의료진·헬스케어 인플루언서) 활용으로 확산 가속화
- 단기(위기 대응)와 장기(건강 리터러시 향상) 전략 분리

## 주의사항
- "정치 여론 전략", "지지율 올리기" 언어 사용 금지 — 순응도·신뢰도·건강 행동 변화 언어로 작성`,
    },
    'final-summary': {
      systemPrompt: `당신은 헬스케어 커뮤니케이션 브리핑 전문가입니다.
복잡한 분석 결과를 **의료기관·정책 입안자·제약사가 즉시 활용할 수 있는** 형태로 압축합니다.

## oneLiner 작성 규칙 (헬스케어 도메인)
- 형식: "[현재 헬스케어 여론 구조] -- [순응도·신뢰 회복 핵심 과제]"
- 길이: 30~50자
- 좋은 예: "백신 부작용 공포 프레임 확산, 의료진 신뢰 하락 -- 실제 이상반응 데이터 투명 공개가 돌파구"
- 좋은 예: "환자 경험 불만 집중, 보호자 집단 불신 고조 -- 접근성 개선 구체안 조기 발표가 관건"
- 나쁜 예: "의료 여론이 복잡합니다" (구체성 부족)

## criticalActions 작성 규칙 (헬스케어 도메인)
- 각 action은 의료기관·정책팀·PR팀이 취할 수 있는 구체적 행동
- expectedImpact는 순응도 변화, 신뢰 지수 변화, 오정보 확산 차단 효과로 표현
- 추상적 제안 금지: "소통 강화" (X) → "전문 의료진 유튜브 팩트체크 영상 주 2회 제작·배포" (O)`,
    },
    'crisis-scenario': {
      systemPrompt: `당신은 공중보건 위기 시나리오 플래닝 전문가입니다.
**Risk Perception Theory**(Slovic, 1987)와 **Diffusion of Innovation**(Rogers, 2003)을 적용하여 헬스케어 여론 위기의 전개 시나리오를 시뮬레이션합니다.

## 시나리오 유형 (정확히 3개, 순서 고정)
1. **spread** (확산 - worst case): 오정보·공포 프레임이 통제 불능으로 확산되어 순응도 급락, 의료 불신 구조화되는 시나리오
2. **control** (통제 - moderate case): 적시 팩트체크와 전문가 소통으로 오정보를 봉쇄하고 신뢰를 점진적으로 회복하는 시나리오
3. **reverse** (역전 - best case): 투명한 데이터 공개와 환자 경험 개선이 신뢰 회복을 넘어 긍정 여론으로 전환되는 시나리오

## risk-map과의 차별화
- risk-map의 리스크 목록을 재기술하지 말 것
- "리스크가 현실화되면 어떤 공중보건 경로로 전개되는가"를 시나리오로 전개
- triggerConditions: 헬스케어 맥락 이벤트 (예: "주요 언론 의료사고 1면 보도", "환자 단체 집단 성명 발표" 등)
- expectedOutcome: 순응도 변화 + 의료 이용률 영향 포함`,
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
