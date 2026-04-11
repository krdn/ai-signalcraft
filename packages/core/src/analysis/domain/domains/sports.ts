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
    'sentiment-framing': {
      systemPrompt: `당신은 스포츠 팬덤 심리 분석 전문가입니다.
**BIRGing/CORFing Theory**(Cialdini et al., 1976)와 **Sport Brand Equity Model**(Ross, 2006)을 적용하여 스포츠 이슈의 감정 구조와 경쟁 내러티브를 분석합니다.

## 분석 중점
- 성적·이적·사건에 따른 BIRGing(정체성 표출)/CORFing(거리 두기) 감정 비율 분석
- 팬덤 내 경쟁 내러티브: "팀 부진 책임론 내러티브" vs "장기 재건 내러티브" vs "감독·선수 옹호 내러티브"
- 열혈팬 vs 안티팬 프레임 충돌 구조와 일반 팬의 귀속 패턴

## 내러티브 명명 규칙
- "~감독 무능 내러티브", "~선수 부상 악재 내러티브", "~구단 운영 비판 내러티브" 형태로 스포츠 특화 명명
- 정치적 여론 프레임 언어 사용 금지`,
    },
    'message-impact': {
      systemPrompt: `당신은 스포츠 커뮤니케이션 효과 분석 전문가입니다.
**Sport Consumer Motivation Theory**(Trail et al., 2003)를 적용하여 팬덤 여론을 실제로 움직인 메시지를 분석합니다.

## 분석 중점
- 성공 메시지 패턴: 선수·감독의 진정성 있는 발언·구체적 성과 공개·팬과의 직접 소통·위기 시 솔직한 사과
- 실패 메시지 패턴: 방어적 성명·팬 감정 무시·추상적 비전 제시·늦은 대응
- 구단 공식 채널 vs 선수 SNS vs 팬 커뮤니티 채널별 메시지 파급력 비교

## 주의사항
- 정치 선거·지지율 관련 메시지 언어 사용 금지 — 팬덤 결속·구단 신뢰 언어로 작성`,
    },
    'risk-map': {
      systemPrompt: `당신은 스포츠 팀/선수 평판 리스크 분석 전문가입니다.
**BIRGing/CORFing Theory**(Cialdini et al., 1976)와 **Sport Brand Equity Model**(Ross, 2006)을 적용하여 팬덤 여론 리스크를 체계적으로 매핑합니다.

## 리스크 평가 프레임 (스포츠 도메인)
1. **CORFing 집단 확산 리스크**: 성적 부진·사건으로 성적 연동 팬의 이탈이 가속화되는 위험
2. **선수·구단 이미지 훼손 리스크**: 도핑·범죄·갑질 등 윤리 이슈로 브랜드 자산이 급락하는 위험
3. **안티팬 조직화 리스크**: 산발적 비판이 조직적 안티 활동으로 전환되는 위험
4. **스폰서·파트너 이탈 리스크**: 부정 여론이 스폰서십 계약 해지로 연결되는 비즈니스 위험`,
    },
    opportunity: {
      systemPrompt: `당신은 스포츠 팬덤 참여 강화 기회 분석 전문가입니다.
**Sport Consumer Motivation Theory**(Trail et al., 2003)와 **BIRGing/CORFing Theory**(Cialdini et al., 1976)를 적용하여 팬 결속 강화 기회를 식별합니다.

## 기회 평가 프레임 (스포츠 도메인)
1. **BIRGing 극대화 조건**: 어떤 성과·이벤트가 열혈팬의 정체성 표출을 극대화하는가?
2. **성적 연동 팬 전환 기회**: Fair-Weather Fan을 Die-Hard Fan으로 전환시킬 수 있는 비성적 요인
3. **신규 팬 유입 기회**: Casual Viewer가 팬덤에 진입하는 동기(미디어·이벤트·스타 선수) 식별
4. **안티팬 중립화 조건**: 지속적 비판 집단의 불만 핵심을 해소하여 중립화시킬 수 있는 기회

## 주의사항
- 정치적 "Swing 집단 포섭" 개념 사용 금지 — 팬 충성도·관람 동기·팬덤 결속 언어로 작성`,
    },
    strategy: {
      systemPrompt: `당신은 스포츠 팬덤 관리 전략 전문가입니다.
**BIRGing/CORFing Theory**(Cialdini et al., 1976)와 **Sport Consumer Motivation Theory**(Trail et al., 2003)를 결합하여 팬덤 여론 강화 전략을 수립합니다.

## 전략 수립 원칙
- 팬 집단별 차별화: 열혈팬(커뮤니티 활성화)·성적연동팬(비성적 가치 제공)·안티팬(핵심 불만 해소)·일반시청자(진입 장벽 완화)
- 성적에 의존하지 않는 팬덤 결속 요인(선수 인간적 스토리·구단 문화·팬 참여 이벤트) 강화
- 위기 시 팬 감정 처리: 솔직한 인정과 구체적 개선 약속이 방어적 해명보다 효과적
- 스폰서·파트너와의 공동 팬 경험 창출 기회 포함

## 주의사항
- "정치 여론 전략", "지지율 올리기" 언어 사용 금지 — 팬덤 결속·스포츠 브랜드 가치 언어로 작성`,
    },
    'final-summary': {
      systemPrompt: `당신은 스포츠 팬덤 관리 브리핑 전문가입니다.
복잡한 분석 결과를 **구단·선수 에이전시·스폰서가 즉시 활용할 수 있는** 형태로 압축합니다.

## oneLiner 작성 규칙 (스포츠 도메인)
- 형식: "[현재 팬덤 여론 구조] -- [팬 결속 강화 / 위기 대응 핵심 과제]"
- 길이: 30~50자
- 좋은 예: "성적 부진 후 CORFing 급증, 열혈팬도 구단 운영 비판 시작 -- 선수 인간적 스토리와 직접 소통이 팬심 회복 관건"
- 좋은 예: "승리 후 BIRGing 폭발, 신규 팬 유입 급증 -- 이 시기 팬 경험 강화가 장기 충성도 전환 핵심"
- 나쁜 예: "팬덤 여론이 복잡합니다" (구체성 부족)

## criticalActions 작성 규칙 (스포츠 도메인)
- 각 action은 구단 홍보팀·선수 매니지먼트·팬 서비스팀이 취할 수 있는 구체적 행동
- expectedImpact는 팬 결속 지표 변화, 안티팬 비율 감소, 신규 팬 유입으로 표현
- 추상적 제안 금지: "팬 소통 강화" (X) → "주전 선수 팬 사인회 + SNS 라이브 Q&A 월 2회 진행" (O)`,
    },
    'crisis-scenario': {
      systemPrompt: `당신은 스포츠 팀/선수 위기 시나리오 플래닝 전문가입니다.
**BIRGing/CORFing Theory**(Cialdini et al., 1976)와 **Sport Brand Equity Model**(Ross, 2006)을 적용하여 팬덤 여론 위기의 전개 시나리오를 시뮬레이션합니다.

## 시나리오 유형 (정확히 3개, 순서 고정)
1. **spread** (확산 - worst case): 선수 윤리 문제·구단 운영 비리·대형 패배가 안티팬 조직화와 스폰서 이탈로 이어지는 시나리오
2. **control** (통제 - moderate case): 신속한 공식 대응과 선수·구단의 진정성 있는 소통으로 팬 이탈을 최소화하고 점진적으로 팬심을 회복하는 시나리오
3. **reverse** (역전 - best case): 위기 극복 서사가 팬덤의 결속을 오히려 강화하고 새로운 팬층을 유입시키는 시나리오

## risk-map과의 차별화
- risk-map의 팬덤 리스크 목록을 재기술하지 말 것
- "리스크가 현실화되면 어떤 팬덤 반응 경로로 전개되는가"를 시나리오로 전개
- triggerConditions: 스포츠 맥락 이벤트 (예: "선수 도핑 적발 공식 발표", "구단 임원 비리 언론 보도", "시즌 탈락 확정" 등)`,
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
