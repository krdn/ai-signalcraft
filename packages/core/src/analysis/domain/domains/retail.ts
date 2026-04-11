/**
 * 프랜차이즈 / 유통 도메인 설정 (Tier 1)
 *
 * 이론적 기반:
 * - Brand Equity Theory (Keller, 1993)
 * - Franchise System Dynamics (Combs & Ketchen, 1999)
 * - Consumer Sentiment Analysis (Baker & Wurgler, 2006 — 소비자 적용)
 * - Customer Complaint Behavior Theory (Singh, 1988)
 */
import type { DomainConfig } from '../types';

export const RETAIL_DOMAIN: DomainConfig = {
  id: 'retail',
  displayName: '프랜차이즈 / 유통',

  theoreticalBasis: [
    {
      theory: 'Customer-Based Brand Equity (CBBE) Model',
      scholar: 'Keller, K.L.',
      year: 1993,
      keyConceptKo: '고객 기반 브랜드 자산 모델',
      application:
        '브랜드 인지→브랜드 이미지→브랜드 반응→브랜드 공명 4단계로 소비자 브랜드 관계 분석. 각 단계별 온라인 여론 강도 측정.',
      applicableModules: ['esg-sentiment', 'macro-view'],
    },
    {
      theory: 'Franchise System Dynamics',
      scholar: 'Combs, J.G. & Ketchen, D.J.',
      year: 1999,
      keyConceptKo: '프랜차이즈 시스템 역학',
      application:
        '본사-가맹점 관계의 긴장 구조 분석. 가맹점주 불만과 소비자 여론 간 연계 패턴 측정.',
      applicableModules: ['stakeholder-map', 'segmentation'],
    },
    {
      theory: 'Customer Complaint Behavior Theory',
      scholar: 'Singh, J.',
      year: 1988,
      keyConceptKo: '소비자 불만 행동 이론',
      application:
        '불만족 소비자의 행동(성토·전환·무응답) 유형 분류. 온라인 불만 표출 패턴이 전체 불만의 어느 부분을 대표하는지 추정.',
      applicableModules: ['message-impact', 'risk-map'],
    },
    {
      theory: 'Consumer Sentiment and Retail Performance',
      scholar: 'Baker, M. & Wurgler, J.',
      year: 2006,
      keyConceptKo: '소비자 심리 지수 (유통 적용)',
      application:
        '소비자 감정 지수가 구매 의도와 매장 방문에 미치는 영향. 온라인 여론 온도 → 오프라인 소비 패턴 연결.',
      applicableModules: ['sentiment-framing', 'opportunity'],
    },
  ],

  platformKnowledge: `
## 한국 온라인 프랜차이즈/유통 여론 플랫폼 특성

| 플랫폼 | 주 사용층 | 특성 | 분석 시 유의점 |
|--------|----------|------|--------------|
| 네이버 뉴스 | 40~60대 | 유통업계 보도 | 대형 유통사·프랜차이즈 논란 보도 중심. 소비자 집단소송·불매운동 보도 중요 |
| 유튜브 | 전 연령 | 음식·쇼핑 리뷰 채널 | 가성비 리뷰·매장 방문 영상. 부정 리뷰 영상의 확산력 매우 강함 |
| DC인사이드 | 20~30대 남성 | 소비자 불만 집결 | 특정 브랜드·매장 불만 조직화 가능. 불매운동 진원지 될 수 있음 |
| 클리앙 | 30~40대 IT직종 | 쇼핑·전자제품 리뷰 | 온라인 쇼핑·가전제품 정보 공유 활발. AS·반품 정책에 민감 |
| FM코리아 | 20~30대 남성 | 소비 경험 공유 | 프랜차이즈 음식·편의점 제품 리뷰. 가성비 중심 평가 |

소비자 여론에서는 단순 불만(일회성) vs 조직적 불매운동(지속성)을 반드시 구분하세요.`,

  impactScoreAnchor: `
## impactScore 기준 (1~10) — 프랜차이즈/유통 기준

| 점수 | 기준 | 사례 |
|------|------|------|
| 9~10 | 전 플랫폼 확산, 불매운동 조직화, 언론 집중 보도 | 식품 안전 사고, 갑질 논란, 원산지 허위 표시 |
| 7~8 | 소비자 집단 반응, 경제 전문 언론 보도 | 가격 인상 논란, 가맹점주 집단 분쟁 |
| 5~6 | 온라인 커뮤니티 핫이슈 | 특정 매장 서비스 불만 집중, 신제품 실망 |
| 3~4 | 일부 소비자 반응 | 개별 불만 접수, 소규모 커뮤니티 논의 |
| 1~2 | 거의 반응 없음 | 일상적 제품 피드백 |`,

  frameStrengthAnchor: `
## 프레임 강도 기준 (0~100) — 유통/소비 기준

| 범위 | 기준 | 설명 |
|------|------|------|
| 80~100 | 지배적 프레임 | 소비자·언론·가맹점주 모두 동일 관점 |
| 60~79 | 우세 프레임 | 소비자 다수와 언론이 이 관점 |
| 40~59 | 경합 프레임 | 기업 측 설명과 소비자 불만이 팽팽 |
| 20~39 | 약세 프레임 | 특정 집단에서만 통용 |
| 0~19 | 미약 프레임 | 새로 등장 중인 관점 |`,

  probabilityAnchor: `
## 확률 기준

| 범위 | 의미 | 판단 근거 |
|------|------|----------|
| 80~100% | 거의 확실 | 소비자 여론 압도적, 불매운동 확산 |
| 60~79% | 가능성 높음 | 불만 증가 추세, 조직화 가능성 |
| 40~59% | 반반 | 소비자 반응 혼재 |
| 20~39% | 가능성 낮음 | 불만 제한적, 특정 조건 시 가능 |
| 0~19% | 거의 불가능 | 근거 부족 |`,

  segmentationLabels: {
    types: ['franchisees', 'consumers', 'competitors', 'regulators'],
    criteria: {
      franchisees:
        '가맹점주·유통 파트너. 본사 정책·수수료·지원에 직접 이해관계. 내부 불만이 외부 유출 가능',
      consumers: '소비자·고객. 제품 품질·가격·서비스에 반응. 불만 시 불매운동 조직화 가능',
      competitors: '경쟁 브랜드·사업자. 부정적 프레임 확산 유도 가능. 가격·품질 비교 언급',
      regulators: '공정거래위원회·식품당국. 갑질·원산지·표시 위반 모니터링. 규제 리스크 결정',
    },
  },

  modulePrompts: {
    'macro-view': {
      systemPrompt: `당신은 프랜차이즈/유통 브랜드 분석 전문가입니다.
**CBBE 모델**(Keller, 1993)과 **Consumer Complaint Behavior Theory**(Singh, 1988)를 적용하여 브랜드 여론 구조를 분석합니다.

## 분석 중점
- 브랜드 자산 4단계(인지→이미지→반응→공명) 중 현재 어느 단계의 여론이 이슈화되었는지 파악
- 소비자 불만 행동 유형(온라인 성토→집단행동 조직화) 단계 평가
- 가맹점주 내부 불만이 소비자 여론으로 전이되는 패턴 추적`,
    },
    segmentation: {
      systemPrompt: `당신은 유통 채널 이해관계자 분석 전문가입니다.
**Franchise System Dynamics**(Combs & Ketchen, 1999)를 적용하여 이해관계자 구조를 분석합니다.

## 집단 분류 기준
- **Franchisees(가맹점주)**: 본사 정책에 직접 영향. 내부 불만이 소비자 불신으로 연결 가능
- **Consumers(소비자)**: 최종 구매 결정자. 불만 시 불매운동·리뷰 폭탄 가능
- **Competitors(경쟁자)**: 대안 선택지 제공자. 비교 마케팅·부정 캠페인 가능
- **Regulators(규제기관)**: 갑질·표시 위반·식품 안전 모니터링. 규제 리스크 결정자`,
    },
  },

  stage4: {
    parallel: ['reputation-index', 'esg-sentiment'],
    sequential: ['crisis-scenario', 'win-simulation'],
  },

  reportSystemPrompt: `당신은 프랜차이즈/유통 브랜드 전략 분야의 최고 전략가입니다.
CBBE 모델과 Franchise System Dynamics에 기반하여 **본사·가맹본부·유통 담당자가 즉시 활용할 수 있는** 브랜드 관리 보고서를 작성합니다.`,

  reportSectionTemplate: `
## 한 줄 요약
## 브랜드 여론 흐름
## 이해관계자별 반응
## 소비자 감정/프레임 분석
## 메시지 효과
## 브랜드 리스크
## 소비자 충성도 강화 기회
## 전략 제안
## 최종 요약`,
};
