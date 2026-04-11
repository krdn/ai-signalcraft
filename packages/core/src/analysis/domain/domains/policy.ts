/**
 * 정책 연구 / 싱크탱크 도메인 설정 (Tier 1 — 프롬프트 오버라이드)
 *
 * 이론적 기반:
 * - Advocacy Coalition Framework (Sabatier & Jenkins-Smith, 1993)
 * - Punctuated Equilibrium Theory (True, Jones & Baumgartner, 2007)
 * - Framing Theory in Policy (Entman, 1993)
 * - Policy Diffusion Theory (Berry & Berry, 1990)
 */
import type { DomainConfig } from '../types';

export const POLICY_DOMAIN: DomainConfig = {
  id: 'policy',
  displayName: '정책 연구 / 싱크탱크',

  theoreticalBasis: [
    {
      theory: 'Advocacy Coalition Framework (ACF)',
      scholar: 'Sabatier, P.A. & Jenkins-Smith, H.C.',
      year: 1993,
      keyConceptKo: '옹호 연합 프레임워크',
      application:
        '정책을 둘러싼 연합 집단(지지 연합 vs 반대 연합) 식별. 각 연합의 핵심 신념 체계와 정책 변화 저항 요인 분석.',
      applicableModules: ['segmentation', 'frame-war'],
    },
    {
      theory: 'Punctuated Equilibrium Theory',
      scholar: 'True, J.L., Jones, B.D. & Baumgartner, F.R.',
      year: 2007,
      keyConceptKo: '단절적 균형 이론',
      application:
        '정책 여론의 안정기와 급격한 변화 시점(변곡점) 식별. 소규모 이슈가 특정 조건에서 정책 대변환을 촉발하는 메커니즘 분석.',
      applicableModules: ['macro-view', 'crisis-scenario'],
    },
    {
      theory: 'Framing Theory',
      scholar: 'Entman, R.M.',
      year: 1993,
      keyConceptKo: '프레이밍 이론',
      application:
        '동일 정책 이슈를 서로 다른 관점으로 해석하는 경쟁 프레임 식별 및 우세 프레임 분석.',
      applicableModules: ['sentiment-framing', 'frame-war'],
    },
    {
      theory: 'Policy Diffusion Theory',
      scholar: 'Berry, F.S. & Berry, W.D.',
      year: 1990,
      keyConceptKo: '정책 확산 이론',
      application: '성공 정책이 타 지역/분야로 확산되는 경로 분석. 정책 수용 가능성 예측.',
      applicableModules: ['opportunity', 'strategy'],
    },
  ],

  platformKnowledge: `
## 한국 온라인 정책 여론 플랫폼 특성

| 플랫폼 | 주 사용층 | 특성 | 분석 시 유의점 |
|--------|----------|------|--------------|
| 네이버 뉴스 | 40~60대 | 주류 정책 보도 | 정부 발표·공식 입장 보도 비중 높음. 전문가 인용 빈도 파악 중요 |
| 유튜브 | 전 연령 | 정책 해설·비판 채널 | 전문가 해설 채널 vs 비판적 유튜버 채널 구분 필요. 조회수가 정책 관심도 지표 |
| DC인사이드 | 20~30대 남성 | 정책 풍자 | 정책 비판을 풍자로 표현. 직접 발언보다 밈·비유로 정책 불만 표출 |
| 클리앙 | 30~40대 IT직종 | 전문적 정책 토론 | IT·교육·경제 정책에 전문성. 논리적 근거 중심 토론. 의견 수렴이 활발 |
| FM코리아 | 20~30대 남성 | 일상 체감 정책 반응 | 정책이 실생활에 미치는 영향 위주로 반응. 추상적 정책 효과보다 구체적 체감 사례 중심 |

정책 여론에서는 전문가 집단(학계·연구원·시민단체)과 일반 대중의 의견을 반드시 구분하세요.`,

  impactScoreAnchor: `
## impactScore 기준 (1~10) — 정책 여론 기준

| 점수 | 기준 | 사례 |
|------|------|------|
| 9~10 | 국가 의제 수준, 전 부처 관련, 입법 논쟁 촉발 | 국민연금 개혁, 의대 정원 확대, 부동산 종합대책 |
| 7~8 | 주요 정책 이슈, 전문가·시민단체 반응 | 세제 개편, 특정 부처 정책 변화 |
| 5~6 | 단일 분야 이슈, 이해관계자 반응 | 하위 시행령 변경, 지자체 조례 |
| 3~4 | 관련 집단 내부 논의 수준 | 전문가 학술 토론, 업계 단체 성명 |
| 1~2 | 거의 반응 없음 | 행정 고시 수준 변경 |`,

  frameStrengthAnchor: `
## 프레임 강도 기준 (0~100) — 정책 담론 기준

| 범위 | 기준 | 설명 |
|------|------|------|
| 80~100 | 지배적 담론 | 전문가·언론·대중 모두 이 관점으로 정책 논의 |
| 60~79 | 우세 담론 | 주류 언론과 전문가가 이 관점, 반론 연합은 소수 |
| 40~59 | 경합 담론 | 찬반 연합이 비등하거나 복수의 프레임이 경쟁 |
| 20~39 | 약세 담론 | 소수 전문가나 특정 시민단체에서만 통용 |
| 0~19 | 미약 담론 | 거의 언급되지 않거나 새로 등장 중인 관점 |`,

  probabilityAnchor: `
## 확률 기준

| 범위 | 의미 | 판단 근거 |
|------|------|----------|
| 80~100% | 거의 확실 | 정책 추진 동력 강하고 반론 약함 |
| 60~79% | 가능성 높음 | 추진 방향 명확하나 정치적 변수 존재 |
| 40~59% | 반반 | 찬반 연합 균형 상태, 핵심 변수 미결정 |
| 20~39% | 가능성 낮음 | 추진 동력 약하나 특정 조건 시 가능 |
| 0~19% | 거의 불가능 | 반대 연합이 압도적으로 강함 |`,

  segmentationLabels: {
    types: ['supporters', 'skeptics', 'neutrals', 'experts'],
    criteria: {
      supporters: '정책을 일관되게 지지하는 집단. 수혜 집단, 집권당 지지층, 정책 설계 참여자',
      skeptics: '정책에 일관되게 반대하는 집단. 피해 집단, 야당·반대 연합, 이해충돌 집단',
      neutrals: '중립적 시각. 정책 효과에 따라 입장 변동 가능. 일반 대중·미결정 유권자',
      experts:
        '학계·연구원·전문가 집단. 정책 내용의 질적 분석 주체. 여론 형성보다 의제 설정에 영향',
    },
  },

  modulePrompts: {
    'macro-view': {
      systemPrompt: `당신은 정책 여론 분석 전문가입니다.
**Punctuated Equilibrium Theory**(True et al., 2007)를 적용하여 정책 여론의 안정-변화 패턴을 분석합니다.

## 분석 중점
- 정책 여론이 안정적 균형을 유지하고 있는지, 아니면 급격한 변화(정책 창 window)에 있는지 판단
- 정책 의제 설정 주체: 정부 발표 → 전문가 해석 → 미디어 프레임 → 일반 여론 확산 경로 추적
- 정책 지지 연합 vs 반대 연합의 세력 균형과 변화 추세 파악`,
    },
    segmentation: {
      systemPrompt: `당신은 정책 이해관계자 분석 전문가입니다.
**Advocacy Coalition Framework**(Sabatier & Jenkins-Smith, 1993)를 적용하여 정책 연합 구조를 분석합니다.

## 집단 분류 기준 (ACF 프레임)
- **Supporters(지지 연합)**: 동일한 핵심 신념을 공유하고 정책을 지지하는 행위자들의 연합
- **Skeptics(반대 연합)**: 정책의 핵심 가정에 반대하는 연합. 각 반대 집단의 주요 논거 파악 중요
- **Neutrals(중립)**: 핵심 신념 없이 이슈별 입장 변동. ACF에서 '정책 브로커' 역할 가능
- **Experts(전문가)**: 정책 내용·효과에 대한 기술적 논쟁 주도. 연합 형성에 영향력 행사`,
    },
    'approval-rating': {
      systemPrompt: `당신은 정책 수용도 분석 전문가입니다.
온라인 여론 데이터를 기반으로 **정책 지지율(정책 수용도)**를 추정합니다.

## 중요 구분
- 이 모듈은 '정치인 지지율'이 아닌 **'정책 수용도(Policy Acceptance Rate)'**를 측정합니다
- 특정 정책에 대한 찬성/반대 비율을 다양한 집단별로 추정하세요
- 온라인 여론 편향(연령층·플랫폼 특성)을 반드시 보정하세요

## confidence 기준
- **high**: 전문가+일반 대중 모두 명확한 입장, 3개 이상 플랫폼 데이터
- **medium**: 한쪽 집단에서만 명확한 입장, 2개 플랫폼 데이터
- **low**: 단일 플랫폼, 전문가/대중 간 의견 극단적 불일치`,
    },
    strategy: {
      systemPrompt: `당신은 정책 커뮤니케이션 전략 전문가입니다.
**Policy Diffusion Theory**(Berry & Berry, 1990)와 프레이밍 이론을 결합하여 정책 수용도 향상 전략을 수립합니다.

## 전략 수립 원칙
- 정책 수용도 제고를 위해 어떤 연합 집단을 먼저 설득해야 하는지 우선순위 결정
- 전문가(기술적 논거)와 일반 대중(체감 효과) 채널을 분리하여 메시지 설계
- 반대 연합의 핵심 논거를 정면 반박할 근거와 타협점 동시에 제시`,
    },
  },

  stage4: {
    parallel: ['approval-rating', 'frame-war'],
    sequential: ['crisis-scenario', 'win-simulation'],
  },

  reportSystemPrompt: `당신은 정책 연구 및 싱크탱크 분야의 최고 수준 분석가입니다.
Advocacy Coalition Framework와 Punctuated Equilibrium Theory에 기반하여 **정책 결정자가 즉시 활용할 수 있는** 정책 여론 분석 보고서를 작성합니다.`,

  reportSectionTemplate: `
## 한 줄 요약
## 정책 여론 구조 (안정/변화 국면)
## 지지/반대 연합 분석
## 프레임 경쟁
## 메시지 효과
## 정책 리스크
## 수용도 향상 기회
## 전략 제안
## 최종 요약`,
};
