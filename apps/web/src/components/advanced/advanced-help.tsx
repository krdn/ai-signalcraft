'use client';

import { useState } from 'react';
import { HelpCircle, ChevronDown, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ─── 카드별 도움말 팝오버 ───

interface AdvancedCardHelpProps {
  title: string;
  description: string;
  details: readonly string[];
  howToRead: readonly string[];
  tips: readonly string[];
  limitations: readonly string[];
  /** 기술적 구현 원리 — 입력 데이터, 선행 의존성, 분석 알고리즘 등 */
  technicalDetails?: readonly string[];
  source: string;
}

export function AdvancedCardHelp({
  title,
  description,
  details,
  howToRead,
  tips,
  limitations,
  technicalDetails,
  source,
}: AdvancedCardHelpProps) {
  const [activeSection, setActiveSection] = useState<'info' | 'read' | 'tips' | 'tech'>('info');
  const hasTechDetails = technicalDetails && technicalDetails.length > 0;

  return (
    <Popover>
      <PopoverTrigger
        className="rounded-full p-0.5 hover:bg-accent transition-colors"
        aria-label={`${title} 도움말`}
      >
        <Info className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-96 text-sm p-0" side="top" align="end">
        <div className="p-3 pb-2">
          <h4 className="font-semibold text-sm">{title}</h4>
          <p className="text-muted-foreground text-xs leading-relaxed mt-1">{description}</p>
        </div>

        <div className="flex border-b px-3">
          <button
            type="button"
            onClick={() => setActiveSection('info')}
            className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeSection === 'info'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            설명
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('read')}
            className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeSection === 'read'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            읽는 법
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('tips')}
            className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeSection === 'tips'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            활용 팁
          </button>
          {hasTechDetails && (
            <button
              type="button"
              onClick={() => setActiveSection('tech')}
              className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                activeSection === 'tech'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              기술 정보
            </button>
          )}
        </div>

        <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
          {activeSection === 'info' && (
            <>
              <ul className="space-y-1">
                {details.map((detail, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-muted-foreground/60 shrink-0">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
              {limitations.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">유의사항</p>
                    <ul className="space-y-0.5">
                      {limitations.map((item, i) => (
                        <li key={i} className="text-[10px] text-muted-foreground/80 flex gap-1.5">
                          <span className="text-amber-500 shrink-0">!</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </>
          )}

          {activeSection === 'read' && (
            <ul className="space-y-1.5">
              {howToRead.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <Badge
                    variant="outline"
                    className="shrink-0 h-4 w-4 justify-center p-0 text-[9px]"
                  >
                    {i + 1}
                  </Badge>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          {activeSection === 'tips' && (
            <ul className="space-y-1.5">
              {tips.map((tip, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-primary shrink-0">→</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}

          {activeSection === 'tech' && hasTechDetails && (
            <ul className="space-y-1.5">
              {technicalDetails.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-muted-foreground/60 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t px-3 py-2">
          <p className="text-[10px] text-muted-foreground/60">분석 모듈: {source}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── 각 카드별 도움말 데이터 ───

export const ADVANCED_HELP = {
  // ─── 정치 도메인 (Stage 4) ───

  approvalRating: {
    title: 'AI 지지율 추정',
    description:
      '수집된 온라인 여론 데이터에서 감정 비율과 플랫폼 편향을 보정하여 지지율 범위를 추정합니다. 실제 여론조사와는 방법론이 다르며, 참고 자료로 활용해야 합니다.',
    details: [
      '추정 범위: 최소~최대 %로 지지율 구간을 표시',
      '신뢰도 Badge: 데이터 양과 일관성에 따라 높음/보통/낮음',
      '감정 비율 도넛 차트: 분석 대상에 대한 긍정/중립/부정 비율',
      '플랫폼 편향 보정: 각 플랫폼의 정치적 편향(진보/보수/중립)을 보정계수로 적용',
      '추론 과정: AI가 지지율을 추정한 논리적 근거 (접이식으로 확인 가능)',
      '면책 문구: 분석 결과의 한계와 주의사항',
    ],
    howToRead: [
      '추정 범위(min~max%)의 중간값이 대략적 지지율 추정치입니다',
      '범위가 넓을수록(예: 35~55%) 데이터의 불확실성이 큽니다',
      '신뢰도가 "낮음"이면 수집 데이터가 부족하거나 일관성이 없는 경우입니다',
      '편향 보정표에서 보정계수가 1.0에서 멀수록 해당 플랫폼의 편향이 큽니다',
      '"추론 과정"을 펼치면 AI가 어떤 논리로 추정했는지 확인 가능',
    ],
    tips: [
      '실제 여론조사 결과와 병행하여 교차 검증하세요',
      '시간 경과에 따른 추정 범위 변화를 추적하면 여론 방향성 파악 가능',
      '특정 이벤트 전후 비교로 이벤트가 지지율에 미친 영향 추정',
      '편향 보정 테이블은 소스 선택 시 참고 자료로 활용',
    ],
    limitations: [
      '온라인 여론은 전체 국민 여론의 일부만 반영 — 실제 여론조사를 대체할 수 없음',
      '특정 연령대/지역이 과대 또는 과소 대표될 수 있음',
      '풍자, 반어법 등 문맥 해석 오류 가능',
      '수집 한도로 인해 표본 크기가 제한적',
    ],
    technicalDetails: [
      '입력: 기사 상위 20건(제목) + 댓글 상위 30건(100자 절단) + 플랫폼별 댓글 수 분포',
      '선행 의존: sentiment-framing(감정 비율·키워드), segmentation(플랫폼·집단), macro-view(여론 추이)',
      '분석 알고리즘: 4단계 — 플랫폼별 원시 감정 산출 → 편향 보정(보정계수 곱) → 가중 통합 → 신뢰도별 범위 산출',
      '편향 보정: 네이버=보수 보정 0.7~0.85x, 클리앙=진보 보정 0.8~0.9x 등 플랫폼별 정량 계수 적용',
      '신뢰도별 범위 폭: high=±3%p, medium=±5%p, low=±8%p',
      '출력 스키마: estimatedRange(min/max), confidence, methodology(sentimentRatio, platformBiasCorrection[], spreadFactor), disclaimer, reasoning',
      'Context Distillation: 선행 결과에서 감정·키워드·집단·추이 데이터만 추출하여 프롬프트에 주입 (토큰 절약)',
    ],
    source: 'approval-rating 모듈 (Claude Sonnet 4.6)',
  },
  frameWar: {
    title: '프레임 전쟁',
    description:
      '여론 내에서 경쟁하는 프레이밍 전략을 분석합니다. 지배적 프레임, 위협 프레임, 반전 가능 프레임을 식별하여 커뮤니케이션 전략 수립에 활용합니다.',
    details: [
      '전장 요약: 현재 프레임 경쟁 상황의 전체 그림',
      '지배적 프레임 TOP 5: 현재 여론을 지배하는 프레임들의 강도를 막대 차트로 표시',
      '위협 프레임: 상대측이 사용하는 위협적 프레임과 위협도(Critical~Low)',
      '반전 가능 프레임: 현재는 불리하지만 전략적으로 반전시킬 수 있는 프레임',
      '각 프레임에 근거 자료(supportingEvidence)와 대응 전략이 포함됨',
    ],
    howToRead: [
      '막대 차트에서 가장 높은 강도의 프레임이 현재 여론을 지배하는 관점입니다',
      '빨간 테두리의 위협 프레임이 Critical/High이면 즉시 대응 필요',
      '파란 테두리의 반전 가능 프레임은 전략적 기회 — "필요 행동"을 실행하면 여론 반전 가능',
      '지배적 프레임 중 자신에게 유리한 것은 강화하고, 불리한 것은 리프레이밍 필요',
    ],
    tips: [
      '지배적 프레임의 키워드를 자신의 메시지에 활용하면 여론 흐름에 올라탈 수 있음',
      '위협 프레임의 "대응" 전략을 즉시 실행 계획으로 전환하세요',
      '반전 가능 프레임은 선제적 커뮤니케이션으로 여론 방향을 전환하는 핵심 기회',
      'AI 리포트의 "전략 도출" 섹션과 함께 읽으면 종합적 전략 수립 가능',
      '시간 경과에 따라 지배 프레임이 바뀌므로 반복 분석으로 추적',
    ],
    limitations: [
      '프레임 분류는 AI 해석 기반이므로 주관적 요소가 포함될 수 있음',
      '오프라인 미디어(TV, 라디오)의 프레이밍은 반영되지 않음',
      '프레임 강도는 온라인 데이터 빈도 기반 추정치',
    ],
    technicalDetails: [
      '입력: 기사 상위 20건(제목) + 댓글 상위 30건(100자 절단)',
      '선행 의존: sentiment-framing(프레임·키워드·충돌), macro-view(변곡점), message-impact(성패 메시지)',
      '분석 알고리즘: 5단계 — 프레임 세력 지도 → 세력 역학 → 위협 프레임 → 반전 기회 → 전장 종합',
      '프레임 강도 기준표(FRAME_STRENGTH_ANCHOR): 0~100 점수 체계 (80+=지배적, 50~79=유의미, <50=약함)',
      'sentiment-framing과의 차별화: 프레임 목록 반복 금지, "세력 역학·시간 추이·플랫폼 격차·반전 가능성"에 집중',
      '출력 스키마: dominantFrames[](name, strength 0~100, supportingEvidence), threateningFrames[](threatLevel, counterStrategy), reversibleFrames[](requiredAction), battlefieldSummary',
    ],
    source: 'frame-war 모듈 (Claude Sonnet 4.6)',
  },
  crisisScenario: {
    title: '위기 시나리오',
    description:
      '리스크 분석과 여론 데이터를 결합하여 3가지 시나리오(확산/통제/역전)를 시뮬레이션합니다. 각 시나리오별 발생 확률, 트리거 조건, 대응 전략, 예상 결과를 제시합니다.',
    details: [
      '현재 리스크 레벨: Critical/High/Medium/Low로 전체 위기 수준 표시',
      '확산 시나리오 (빨강): 위기가 확대되는 최악의 경우',
      '통제 시나리오 (주황): 위기를 현 수준에서 관리하는 경우',
      '역전 시나리오 (초록): 위기를 기회로 전환하는 최선의 경우',
      '각 시나리오: 발생 확률, 트리거 조건, 대응 전략, 예상 결과, 소요 기간',
      '권고 행동: AI가 제안하는 현재 시점의 최우선 행동',
    ],
    howToRead: [
      '3개 시나리오의 발생 확률 합이 100%가 아닐 수 있음 — 각각 독립적 추정',
      '확산 시나리오의 확률이 높으면(40% 이상) 즉시 위기 대응 모드 필요',
      '트리거 조건을 모니터링하여 시나리오 전환 신호를 사전 감지',
      '역전 시나리오의 "필요 행동"이 가장 적극적인 전략 옵션',
      '권고 행동은 현재 리스크 레벨에 맞춘 즉시 실행 사항',
    ],
    tips: [
      '팀 위기 대응 회의에서 3개 시나리오를 기반으로 시뮬레이션 연습',
      '각 시나리오의 트리거 조건에 대한 모니터링 알림 체계를 구축',
      '역전 시나리오가 현실적이라면 선제적으로 "필요 행동"을 실행하여 여론 주도권 확보',
      '소요 기간을 참고하여 단기/중기 대응 전략을 구분',
      '리스크 레벨이 High 이상이면 팀 전체에 즉시 공유',
    ],
    limitations: [
      '시나리오는 현재 데이터 기반 추정이며, 예측이 아닙니다',
      '외부 변수(경쟁자 행동, 글로벌 이벤트)는 반영되지 않음',
      '발생 확률은 AI 추정치이므로 실제와 차이가 있을 수 있음',
    ],
    technicalDetails: [
      '입력: 기사 상위 15건(제목) + 댓글 상위 20건(100자 절단)',
      '선행 의존: risk-map(topRisks, overallRiskLevel, riskTrend), approval-rating(estimatedRange, confidence), macro-view(변곡점), sentiment-framing(부정 프레임)',
      '분석 알고리즘: 5단계 — 위기 수준 진단(잠복기/발화기/확산기/수습기) → Spread → Control → Reverse → 권장 조치',
      '확률 기준표(PROBABILITY_ANCHOR): 70%+=거의 확실, 50~69%=가능성 높음, 30~49%=가능, 10~29%=낮음, <10%=극히 낮음',
      'risk-map과의 차별화: 리스크 목록 재기술 금지, "리스크가 현실화되면 어떻게 전개되는가"를 시나리오로 전개',
      '출력 스키마: scenarios[](type=spread/control/reverse, probability 0~100, triggerConditions[], responseStrategy[], timeframe), currentRiskLevel, recommendedAction',
    ],
    source: 'crisis-scenario 모듈 (Claude Sonnet 4.6)',
  },
  winSimulation: {
    title: '승리 시뮬레이션',
    description:
      '모든 분석 데이터를 종합하여 목표 달성(승리) 확률을 시뮬레이션합니다. 승리 조건 체크리스트, 패배 리스크, 핵심 전략을 우선순위별로 제시합니다.',
    details: [
      '승리 확률: 반원형 차트로 현재 승리 가능성을 시각화',
      '신뢰도 Badge: 시뮬레이션 결과의 신뢰 수준',
      '승리 조건: 체크리스트 형태 — 충족(초록)/부분(주황)/미충족(빨강)',
      '패배 리스크: 현재 위험도별 패배 요인과 완화 방안',
      '핵심 전략: 우선순위별 실행 전략과 예상 효과',
      '시뮬레이션 요약: 전체 시뮬레이션 결과의 텍스트 요약',
    ],
    howToRead: [
      '승리 확률이 50% 이상이면 현재 유리한 상황, 50% 미만이면 전략 전환 필요',
      '승리 조건 중 "미충족" 항목이 가장 시급한 개선 대상',
      '"부분 충족" 항목은 추가 노력으로 완전 충족 가능한 영역',
      '패배 리스크 중 "high"인 항목의 "완화" 방안을 최우선 실행',
      '핵심 전략의 우선순위 1번이 가장 큰 영향력을 가진 행동',
    ],
    tips: [
      '승리 조건 체크리스트를 팀 KPI로 활용하여 진척도 관리',
      '패배 리스크의 완화 방안을 즉시 실행 가능한 태스크로 분해',
      '핵심 전략의 "예상 효과"를 기반으로 리소스 투입 우선순위 결정',
      '반복 분석으로 승리 확률의 변화 추이를 추적 — 전략 효과 측정',
      '위기 시나리오의 "역전" 시나리오와 함께 읽으면 최적 전략 파악',
    ],
    limitations: [
      '승리/패배는 상대적 개념이며, 명확한 기준은 분석 맥락에 따라 다름',
      '경쟁자의 전략 변화는 실시간으로 반영되지 않음',
      '확률은 현재 데이터 기반 추정이며, 향후 상황 변화에 따라 달라짐',
    ],
    technicalDetails: [
      '입력: 기사 상위 15건(제목) + 댓글 상위 20건(100자 절단)',
      '선행 의존: 모든 선행 결과 종합 (approval-rating, risk-map, opportunity, strategy, frame-war, crisis-scenario, sentiment-framing, segmentation)',
      '분석 알고리즘: 6단계 — 기반선 설정 → 승리 조건(3~7개, met/partial/unmet) → 패배 조건(2~5개) → 확률 산출 → 핵심 전략(3~5개) → 종합 요약',
      '확률 산출 근거: approval-rating 기반선 + risk-map 감점 + opportunity 가점 + frame-war 우세/열세 + crisis-scenario 확산 확률',
      'strategy 모듈과의 차별화: 선행 전략을 반복하지 않고 시뮬레이션 결과에 기반한 새로운 우선순위 재배치',
      '출력 스키마: winProbability(0~100), confidenceLevel, winConditions[](met/partial/unmet), loseConditions[](high/medium/low, mitigation), keyStrategies[](priority, expectedImpact)',
    ],
    source: 'win-simulation 모듈 (Claude Sonnet 4.6)',
  },
  frameWarGraph: {
    title: '프레임 전쟁 네트워크',
    description:
      '프레임 전쟁 분석 결과를 네트워크 그래프로 시각화합니다. 지배/위협/반전 프레임 간의 관계와 충돌 구조를 한눈에 파악할 수 있습니다.',
    details: [
      '파란색 노드: 현재 여론을 지배하는 프레임 (크기 = 강도)',
      '빨간색 노드: 위협 프레임 (크기 = 위협 수준)',
      '노란색 노드: 반전 가능 프레임',
      '초록/주황 노드: 긍정/부정 프레임 (감정 분석 결과)',
      '보라 노드: 충돌 중인 프레임 쌍',
      '엣지: 프레임 간 위협(threatens), 충돌(conflicts), 대립(conflict) 관계',
    ],
    howToRead: [
      '노드가 클수록 해당 프레임의 영향력이 큽니다',
      '빨간 실선(위협): 지배 프레임이 위협받는 관계',
      '주황 실선(충돌): 지배 프레임과 부정 프레임의 충돌',
      '보라 실선(대립): 양측 핵심 프레임 간 직접 대립',
      '그래프를 드래그하여 노드 위치를 조정할 수 있습니다',
      '마우스 휠로 확대/축소, 배경 드래그로 이동 가능',
    ],
    tips: [
      '지배 프레임 주변의 위협 엣지가 많으면 여론이 불안정한 상태',
      '고립된 노드는 독립적인 프레임으로 전략적 기회일 수 있음',
      '여러 위협 프레임이 하나의 지배 프레임을 공격하면 해당 영역 집중 대응 필요',
    ],
    limitations: [
      '그래프는 정성적 관계를 시각화한 것이며, 인과관계를 나타내지 않음',
      '노드 수가 많을 경우 겹침이 발생할 수 있음 — 드래그로 조정',
      '실시간 업데이트가 아닌 분석 시점 기준',
    ],
    technicalDetails: [
      '데이터 소스: frame-war(dominantFrames, threateningFrames, reversibleFrames, frameConflict) + sentiment-framing(positiveFrames, negativeFrames)',
      '노드 매핑: dominant→파란(크기=strength/15), threatening→빨간(크기=threatLevel 가중치), reversible→노란, positive→초록, negative→주황, conflict pairs→보라',
      '엣지 구성: dominant→threatening "threatens", negative→dominant "conflicts", frameConflict dominant↔challenging "conflict"',
      '시각화: D3 force-directed graph (클라이언트에서 buildFrameWarGraph()로 JSON 생성 → FrameWarGraph 컴포넌트 렌더링)',
    ],
    source: 'frame-war + sentiment-framing 모듈 (클라이언트 그래프 빌더)',
  },
  riskChainGraph: {
    title: '리스크 연쇄 다이어그램',
    description:
      '리스크 맵 분석 결과에서 리스크 간 연관 관계를 네트워크로 시각화합니다. 공통 트리거 조건을 공유하는 리스크들이 연쇄적으로 발생할 가능성을 보여줍니다.',
    details: [
      '빨간 노드: Critical 영향도 리스크',
      '주황 노드: High 영향도 리스크',
      '노란 노드: Medium 영향도 리스크',
      '초록 노드: Low 영향도 리스크',
      '노드 크기: 확산 확률에 비례',
      '실선 엣지: 공통 트리거 키워드를 공유하는 연관 리스크',
      '점선 엣지: Critical 리스크와의 잠재적 연관',
    ],
    howToRead: [
      '노드가 클수록 확산 확률이 높은 리스크입니다',
      '엣지로 연결된 리스크들은 공통 트리거를 공유 — 하나 발생 시 연쇄 가능',
      'Critical(빨강) 노드가 여러 엣지와 연결되면 시스템적 리스크',
      '연결이 없는 고립 노드는 독립적 리스크로 개별 대응 가능',
      '점선 엣지는 직접적 연관보다 잠재적 영향 관계',
    ],
    tips: [
      '엣지가 밀집된 클러스터는 연쇄 위험 구간 — 우선 모니터링',
      'Critical 노드의 트리거 조건을 모니터링하여 선제 대응',
      '고립된 High 노드도 개별적으로 심각할 수 있으니 간과 금물',
    ],
    limitations: [
      '연관 관계는 트리거 조건의 키워드 유사도 기반 — 의미적 인과관계와 다를 수 있음',
      '새로운 리스크가 발견되면 그래프 구조가 달라질 수 있음',
      '실시간 업데이트가 아닌 분석 시점 기준',
    ],
    technicalDetails: [
      '데이터 소스: risk-map(topRisks[])',
      '노드 매핑: 각 리스크 → 노드 (크기=spreadProbability*40, 색상=impactLevel)',
      '엣지 탐지 알고리즘: triggerConditions[] 간 공통 키워드 탐지 (앞 4글자 기준 매칭) → "related" 엣지',
      '잠재적 연관: Critical 리스크는 모든 다른 리스크와 "potential" 약한 연결(점선) 생성',
      '시각화: buildRiskChainGraph()에서 JSON 생성 → FrameWarGraph 컴포넌트 재사용',
    ],
    source: 'risk-map 모듈 (클라이언트 그래프 빌더)',
  },

  // ─── 금융 도메인 (Stage 4) ───

  marketSentimentIndex: {
    title: '투자 심리 지수',
    description:
      'Baker & Wurgler(2006) Investor Sentiment Index와 Kahneman & Tversky(1979) 행동 재무학을 적용하여 온라인 여론에서 공포/탐욕 스펙트럼과 투자자 심리 편향을 정량 측정합니다. ⚠️ 이 분석은 투자 자문이 아닙니다.',
    details: [
      'sentimentIndex(0~100): 0=극단적 공포, 50=중립, 100=극단적 탐욕',
      'sentimentLabel: extreme-fear / fear / neutral / greed / extreme-greed',
      'trend: improving / stable / deteriorating — 심리 방향성',
      'investorSegmentSentiment: 투자자 집단(개인/기관/외국인)별 bullish/bearish/neutral 심리',
      'behavioralBiases: 손실 회피·앵커링·군집 행동·확증 편향·과신 편향 식별',
      'sentimentSignals: 역발상 신호(contraindicators) vs 추세 추종 신호(momentumIndicators)',
    ],
    howToRead: [
      'sentimentIndex 80 이상이면 극단적 탐욕 — 역발상 매도 경고 신호 가능 (자문 아님)',
      'sentimentIndex 20 이하이면 극단적 공포 — 역발상 매수 고려 구간 가능 (자문 아님)',
      'behavioralBiases에서 herding(군집 행동)이 강하면 개인투자자 쏠림 위험',
      'trend가 deteriorating이면 심리가 낙관에서 비관으로 전환 중',
      'contraindicators가 많을수록 현재 심리가 극단적이라는 역발상 신호',
    ],
    tips: [
      '극단적 탐욕(80+) 구간에서는 리스크 관리를 강화하는 것이 일반적 전략',
      '집단별 심리(investorSegmentSentiment)에서 기관과 개인의 방향이 반대이면 정보 비대칭 가능성',
      '반드시 공식 금융 데이터 및 전문 투자 자문과 병행하여 활용하세요',
    ],
    limitations: [
      '온라인 여론 기반 추정 — 실제 시장 데이터(거래량, 가격)와 다를 수 있음',
      '투자 자문이 아닙니다 — 실제 투자 결정은 공식 재무 분석 기반으로 하세요',
      '개인투자자 발화가 많은 플랫폼(DC갤러리, FM코리아) 특성에 따른 편향 가능',
      '단기 심리만 측정 — 펀더멘털 가치와 다를 수 있음',
    ],
    technicalDetails: [
      '입력: 기사 상위 20건(제목) + 댓글 상위 50건(120자 절단)',
      '선행 의존: macro-view(여론 추이), segmentation(투자자 집단), sentiment-framing(감정·프레임)',
      '분석 알고리즘: 공포/탐욕 지수 0~100 산출 → 집단별 심리 분리 → 행동 재무학 편향 패턴 식별 → 역발상/모멘텀 신호 도출',
      '출력 스키마: sentimentIndex(0~100), sentimentLabel, trend, investorSegmentSentiment[], behavioralBiases[], sentimentSignals(contraindicators[], momentumIndicators[]), disclaimer, summary',
    ],
    source: 'market-sentiment-index 모듈 (Claude Sonnet 4.6)',
  },
  informationAsymmetry: {
    title: '정보 비대칭 분석',
    description:
      'Bikhchandani, Hirshleifer & Welch(1992) Information Cascade Theory를 적용하여 온라인 여론에서 정보 폭포 현상, 기관-개인 간 정보 격차, 선행 지표, 루머 위험 영역을 식별합니다. ⚠️ 투자 자문 아님.',
    details: [
      'asymmetryLevel: high / medium / low — 기관 vs 개인 정보 격차 수준',
      'informationCascades: 정보 폭포 현상 — 발화 플랫폼, 확산 경로, 강도',
      'leadingIndicators: 주류 미디어 반영 전 커뮤니티에서 나타난 선행 신호',
      'informationVacuums: 정보 공백 영역 — 루머가 채우는 영역과 루머 위험도',
      'smartMoneySignals: 기관 투자자의 역방향 포지션 행동 신호',
    ],
    howToRead: [
      'asymmetryLevel high이면 기관과 개인 간 정보 격차가 크다는 의미 — 개인 불리',
      'leadingIndicators에서 lagTime이 짧을수록 더 즉각적인 선행 지표',
      'informationVacuums에서 rumorRisk high이면 해당 영역 공식 정보 공개 시급',
      'smartMoneySignals가 개인 심리와 반대 방향이면 기관이 역방향 포지션 가능성',
      'informationCascades의 origin 플랫폼이 커뮤니티면 바텀업 신호, 뉴스면 탑다운 신호',
    ],
    tips: [
      'leadingIndicators를 추적하면 뉴스 보도 전 선행 대응 가능',
      'informationVacuums의 fillRecommendation을 IR 커뮤니케이션에 활용하세요',
      '반드시 공식 금융 데이터와 병행하여 해석하세요',
    ],
    limitations: [
      '정보 폭포의 원인(내부 정보 유출 vs 루머)을 여론 데이터로 구분하기 어려움',
      '투자 자문이 아닙니다',
      '수집 소스 제약으로 폐쇄 커뮤니티(카카오톡, 텔레그램)의 정보는 미반영',
    ],
    technicalDetails: [
      '입력: 기사 상위 20건(제목) + 댓글 상위 40건(100자 절단)',
      '선행 의존: macro-view(여론 추이·변곡점), segmentation(투자자 집단), market-sentiment-index(심리 지수)',
      '분석 알고리즘: 정보 폭포 패턴 탐지 → 선행 지표 추출 → 정보 공백 영역 매핑 → 스마트머니 신호 식별',
      '출력 스키마: asymmetryLevel, informationCascades[](cascade, origin, spreadPath, magnitude), leadingIndicators[](indicator, platform, significance, lagTime), informationVacuums[](vacuum, rumorRisk, fillRecommendation), smartMoneySignals[], disclaimer, summary',
    ],
    source: 'information-asymmetry 모듈 (Claude Sonnet 4.6)',
  },
  catalystScenario: {
    title: '시장 시나리오',
    description:
      'Noise Trader Theory(De Long et al., 1990)를 적용하여 현재 시장 여론을 바탕으로 강세(Bull) / 기본(Base) / 약세(Bear) 3개 시나리오와 각 시나리오를 촉발할 이벤트를 분석합니다. ⚠️ 투자 자문 아님.',
    details: [
      'scenarios[]: bull / base / bear 3개 시나리오 (probability, catalysts, sentimentImpact, marketNarrative, keyWatchPoints, timeframe)',
      'mostLikelyScenario: 현재 여론 기반 가장 가능성 높은 시나리오',
      'sentimentMomentum: accelerating-bull / decelerating-bull / stable / decelerating-bear / accelerating-bear',
      'noiseVsSignal: 현재 여론 움직임이 단기 과잉반응(Noise) vs 구조적 변화(Signal) 판단',
    ],
    howToRead: [
      'mostLikelyScenario가 bull이면 강세론이 우세, bear면 약세론이 우세',
      'sentimentMomentum이 accelerating-bull이면 낙관 심리가 가속 중',
      'noiseVsSignal.isCurrentMoveNoise가 true이면 단기 과잉반응 — 역방향 포지션 가능',
      'catalysts 목록에서 실제로 발생 여부를 모니터링하면 시나리오 진행 확인 가능',
      'probability 합계는 1.0 — 각 시나리오의 상대적 가능성 비교',
    ],
    tips: [
      'keyWatchPoints를 모니터링 지표로 활용하세요',
      'timeframe이 짧은 시나리오일수록 즉각적 대응 필요',
      '반드시 공식 재무 데이터 및 전문 투자 자문과 병행하세요',
    ],
    limitations: [
      '시나리오 확률은 여론 기반 추정 — 실제 시장 예측이 아님',
      '투자 자문이 아닙니다',
      '매크로 이벤트(미국 금리, 지정학 리스크)는 수집 소스 제약으로 미반영',
    ],
    technicalDetails: [
      '입력: 기사 상위 20건(제목) + 댓글 상위 40건(100자 절단)',
      '선행 의존: market-sentiment-index(심리 지수), information-asymmetry(정보 폭포), risk-map(리스크 목록), opportunity(기회 목록)',
      '분석 알고리즘: 여론 모멘텀 방향 측정 → 3시나리오 조건 설정 → 확률 배분 → 촉발 이벤트 식별 → 노이즈/시그널 판단',
      '출력 스키마: scenarios[3](type, probability, catalysts[], sentimentImpact, marketNarrative, keyWatchPoints[], timeframe), mostLikelyScenario, sentimentMomentum, noiseVsSignal(isCurrentMoveNoise, reasoning), disclaimer, summary',
    ],
    source: 'catalyst-scenario 모듈 (Claude Sonnet 4.6)',
  },
  investmentSignal: {
    title: '투자 신호 종합',
    description:
      '앞선 금융 Stage 4 분석을 종합하여 여론 기반 단기(1~2주) / 중기(1~3개월) 투자 심리 신호를 도출합니다. ⚠️ 이 신호는 여론 참고 자료이며 투자 자문이 아닙니다.',
    details: [
      'overallSignal: strong-buy / buy / hold / sell / strong-sell (여론 기반 — 투자 자문 아님)',
      'signalStrength: 0~100 — 신호의 강도 (높을수록 확신도 높음)',
      'signalComponents: 신호를 구성하는 요소와 각 가중치',
      'timeHorizon: 단기(shortTerm) / 중기(mediumTerm) 신호 구분',
      'keyRisks / keyOpportunities: 현재 신호의 주요 리스크와 기회',
      'sentimentExtremeWarning: 극단적 심리 경고 및 역발상 신호',
    ],
    howToRead: [
      'overallSignal은 여론 기반 — 실제 투자 결정에 직접 사용하면 안 됨',
      'signalStrength가 70 이상이면 현재 여론의 방향이 강하게 일관된 상태',
      'sentimentExtremeWarning.isExtreme이 true이면 역발상 신호 — 극단적 탐욕은 매도, 극단적 공포는 매수 시사 (자문 아님)',
      '단기 신호와 중기 신호가 다르면 단기 과잉반응이 있는 상태',
      'keyRisks가 많을수록 현재 신호의 신뢰도에 제약이 있음',
    ],
    tips: [
      '공식 증권사 보고서, 재무제표와 병행하여 교차 검증하세요',
      '극단적 경고(sentimentExtremeWarning) 발생 시 포지션 재검토 신호로 활용',
      '이 신호만으로 투자 결정을 하지 마세요 — 항상 전문 투자 자문을 받으세요',
    ],
    limitations: [
      '여론 데이터 기반 — 내부 정보, 기술적 분석, 펀더멘털은 미반영',
      '투자 자문이 아닙니다 — 실제 투자 손실에 대한 책임을 지지 않음',
      '단기 여론 변동에 민감하여 노이즈가 포함될 수 있음',
    ],
    technicalDetails: [
      '입력: 기사 상위 20건(제목) + 댓글 상위 30건(100자 절단)',
      '선행 의존: market-sentiment-index(심리 지수), information-asymmetry(정보 폭포), catalyst-scenario(시나리오), risk-map(리스크), opportunity(기회)',
      '분석 알고리즘: 선행 Stage 4 결과 통합 → 신호 구성 요소 가중 합산 → 시간 지평 분리 → 극단 경고 발동',
      '출력 스키마: overallSignal, signalStrength(0~100), signalComponents[], timeHorizon(shortTerm, mediumTerm), keyRisks[], keyOpportunities[], sentimentExtremeWarning(isExtreme, direction, contraindicatorSignal), disclaimer, summary',
    ],
    source: 'investment-signal 모듈 (Claude Sonnet 4.6)',
  },

  // ─── 팬덤 도메인 (Stage 4) ───

  fanLoyaltyIndex: {
    title: '팬덤 충성도 지수',
    description:
      '팬덤의 참여도·감정·옹호 활동을 3차원으로 분석하여 충성도 점수와 이탈 징후를 진단합니다. 일반 대중 감정과 팬덤 내부 감정을 분리 분석합니다.',
    details: [
      '충성도 점수: 참여도(engagement) + 감정(sentiment) + 옹호(advocacy) 각 0~100점',
      '이탈 징후: 탈덕, 실망, 무관심 등의 신호와 심각도',
      '팬덤 세분화: devoted(헌신)/active(적극)/passive(수동)/dormant(휴면)/at-risk(이탈 위험) 5단계',
      '자발적 옹호 분석: 팬덤이 자발적으로 방어·홍보하는 패턴',
      '권고: 충성도 유지·강화를 위한 실행 권고',
    ],
    howToRead: [
      'overall 점수가 70 이상이면 건강한 팬덤, 50 미만이면 이탈 위험 관리 필요',
      'engagement < sentiment면 팬들은 호감은 있지만 활동이 수동적',
      '이탈 징후의 severity가 high/critical이면 즉시 대응 전략 수립',
      'at-risk 세그먼트 비율이 높으면 팬덤 유지 전략보다 회복 전략이 우선',
      'viralAdvocacy.activeDefenders가 높으면 자발적 팬덤 마케팅 활용 가능',
    ],
    tips: [
      '충성도 3차원 중 가장 낮은 영역을 집중 보완 — 균형 잡힌 팬덤이 지속 가능',
      '이탈 징후의 evidence를 모니터링하여 선제 대응',
      'at-risk 세그먼트의 characteristics를 참고하여 맞춤형 소통 전략 수립',
      'defensePatterns를 브랜드 메시지에 자연스럽게 통합하면 팬덤의 자발적 확산 유도',
    ],
    limitations: [
      '팬덤 규모 추정은 정성적 — 정확한 팬덤 인구 통계는 별도 조사 필요',
      '팬덤 내부 계층(공식팬·일반팬·안티팬)의 구분이 제한적',
      '국제 팬덤과 국내 팬덤의 분리 분석은 소스 제약으로 제한적',
    ],
    technicalDetails: [
      '입력: 플랫폼별 댓글 수 분포 + 댓글 상위 50건(120자 절단, 다른 모듈보다 많음)',
      '선행 의존: sentiment-framing(감정·키워드), segmentation(플랫폼·집단), macro-view(추이)',
      '분석 알고리즘: 5단계 — 팬덤 감정 베이스라인 → 충성도 점수 산출(engagement/sentiment/advocacy) → 이탈 징후 스캔 → 팬덤 세분화(5단계) → 자발적 옹호 분석',
      '출력 스키마: loyaltyScore(overall, engagement, sentiment, advocacy 각 0~100), churnIndicators[](severity, evidence, affectedSegment), loyaltySegments[](segment, estimatedSize, churnRisk), viralAdvocacy(activeDefenders, defensePatterns[], organicPromotion[])',
      '일반 대중 vs 팬덤 분리: approval-rating의 정치 도메인 대체. 감정 분석 시 팬덤 내부 발언과 일반 대중 발언을 분리 해석',
    ],
    source: 'fan-loyalty-index 모듈 (Claude Sonnet 4.6)',
  },
  fandomNarrativeWar: {
    title: '팬덤 내러티브 경쟁',
    description:
      '팬덤 생태계 내에서 경쟁하는 내러티브를 분석합니다. 팬/안티팬/미디어/일반대중/기획사 간의 내러티브 경쟁 구도와 팬덤 간 경쟁 축을 파악합니다.',
    details: [
      '지배적 내러티브: 현재 팬덤 생태계를 지배하는 스토리텔링과 출처(fans/anti-fans/media/general-public/company)',
      '대응 내러티브: 반대 세력이 밀고 있는 대응 스토리와 위협도',
      '팬덤 간 경쟁: 음원/조회수/예능/수상 등 경쟁 축에서의 승패 현황',
      '전장 종합: 전체 내러티브 경쟁 상황 요약',
    ],
    howToRead: [
      '지배적 내러티브의 source가 anti-fans이면 팬덤이 방어적 위치',
      'fanbaseRivalry.isActive가 false면 현재 경쟁 팬덤과 직접 충돌이 없는 상태',
      'battlefronts에서 currentStanding이 losing인 축이 가장 시급한 대응 영역',
      'counterNarratives의 threatLevel이 high이면 즉시 대응 메시지 준비 필요',
    ],
    tips: [
      '지배적 내러티브 중 fans 출처의 strength가 높으면 팬덤 주도권이 강한 상태 — 유지 전략',
      '미디어 출처 내러티브의 spreadPattern을 파악하면 언론 대응 방향 수립 가능',
      'battlefronts에서 winning인 축의 전략을 losing인 축에 적용하는 크로스 전략 활용',
      'company 출처 내러티브가 약하면 기획사 소통 강화 필요',
    ],
    limitations: [
      '내러티브 출처 분류는 AI 추정 — 실제 발화자 의도와 다를 수 있음',
      '팬덤 간 경쟁은 공개 플랫폼 데이터 기반 — 폐쇄 커뮤니티(카페, 단톡방)는 미반영',
      '국제 팬덤의 내러티브는 수집 소스 제약으로 제한적',
    ],
    technicalDetails: [
      '입력: 기사 상위 20건(제목) + 댓글 상위 30건(100자 절단)',
      '선행 의존: sentiment-framing(프레임·키워드), macro-view(변곡점), message-impact(성패 메시지)',
      '분석 알고리즘: 4단계 — 지배적 내러티브 → 대응 내러티브 → 팬덤 간 경쟁 구도 → 전장 종합',
      '내러티브 출처 5분류: fans / anti-fans / media / general-public / company',
      '출력 스키마: dominantNarratives[](narrative, strength 0~100, source, spreadPattern), counterNarratives[](threatLevel, originPlatform), fanbaseRivalry(isActive, rivalTargets[], battlefronts[](platform, issue, currentStanding: winning/contested/losing))',
      'frame-war과의 차이: 프레임 대신 "내러티브" 개념, 출처 분류와 팬덤 간 경쟁 battlefronts가 추가됨',
    ],
    source: 'fandom-narrative-war 모듈 (Claude Sonnet 4.6)',
  },
  fandomCrisisScenario: {
    title: '팬덤 위기 시나리오',
    description:
      '팬덤 특유의 위기 유형을 바탕으로 3가지 시나리오(확산/통제/역전)를 시뮬레이션합니다. 열애·스캔들, 표절, 기획사 갈등 등 팬덤 특화 위기에 대응합니다.',
    details: [
      '현재 리스크 레벨: Critical/High/Medium/Low로 팬덤 위기 수준 표시',
      '확산 시나리오 (빨강): 위기가 팬덤→일반 커뮤니티→언론→국제 팬덤으로 확산',
      '통제 시나리오 (주황): 팬덤 내부에서 위기를 관리하는 경우',
      '역전 시나리오 (초록): 위기를 팬덤 결속·지지 강화 기회로 전환',
      '각 시나리오: 대응 주체(기획사/멤버/팬덤)별 역할 명시',
      '권고 행동: AI가 제안하는 현재 시점의 최우선 행동',
    ],
    howToRead: [
      '확산 경로가 "팬덤→언론→국제 팬덤"으로 이어지면 대중화 위험 — 즉시 대응',
      '대응 전략에서 "기획사" 역할이 무거우면 공식 대응이 시급한 상황',
      '역전 시나리오의 responseStrategy에 "팬덤" 역할이 포함되면 팬덤 자체적 대응이 가능',
      'timeframe이 짧을수록(1~3일) 긴급 대응, 길면(1~2주) 전략적 대응 여유',
    ],
    tips: [
      '팬덤 특유 위기 6가지(열애·스캔들, 표절·저작권, 기획사 갈등, SNS·과거 논란, 경쟁 팬덤 공격, 콘서트·행사 사고)별 대응 매뉴얼을 미리 준비',
      '확산 경로의 각 단계별 차단 전략을 수립',
      '팬덤 리더(공식팬 커뮤니티 운영진)와의 소통 채널을 평소에 확보',
      '역전 시나리오를 "위기가 오히려 팬덤 결속력을 높인 사례"로 활용',
    ],
    limitations: [
      '팬덤 위기의 감정적 요소(충격, 배신감)는 AI가 완전히 반영하기 어려움',
      '폐쇄 커뮤니티 내부 반응은 수집 소스 제약으로 제한적',
      '국제 팬덤 반응은 실시간 반영이 어려울 수 있음',
    ],
    technicalDetails: [
      '입력: 기사 상위 15건(제목) + 댓글 상위 20건(100자 절단)',
      '선행 의존: risk-map, approval-rating, macro-view, sentiment-framing (정치 도메인과 동일한 distillForCrisisScenario 재사용)',
      '팬덤 특화 위기 유형 6가지: 열애/스캔들, 표절/저작권, 기획사 갈등, SNS/과거 논란, 경쟁 팬덤 공격, 콘서트/행사 사고',
      '확산 경로 모델: 팬덤 → 일반 커뮤니티 → 언론 → 국제 팬덤 (4단계)',
      '대응 주체 세분화: 기획사/멤버/팬덤 — 각 시나리오별 역할 명시',
      '출력 스키마: scenarios[](type=spread/control/reverse, probability 0~100, expectedOutcome 정량, responseStrategy[], timeframe), currentRiskLevel, recommendedAction',
    ],
    source: 'fandom-crisis-scenario 모듈 (Claude Sonnet 4.6)',
  },
  releaseReceptionPrediction: {
    title: '컴백/신곡 반응 예측',
    description:
      '모든 분석 데이터를 종합하여 컴백·신곡·신작에 대한 반응을 예측합니다. 성공 요인, 리스크 요인, 플랫폼별 전망을 종합적으로 분석합니다.',
    details: [
      '예상 반응: explosive/positive/mixed/negative/controversial 5단계',
      '반응 점수: 0~100점으로 정량화된 예상 반응도',
      '성공 요인: 팬덤 열기/음악 품질/타이밍/프로모션/글로벌 각 요인의 현재 상태',
      '리스크 요인: 부정적 변수와 완화 방안',
      '플랫폼별 전망: 음원사이트/유튜브/SNS/커뮤니티 각각의 예상 반응',
      '실행 계획: 우선순위별 실행 항목과 타이밍',
    ],
    howToRead: [
      'receptionScore가 70 이상이면 긍정적 반응 예상, 40 미만이면 부정적 반응 위험',
      '성공 요인 중 "weak"인 항목이 반응 점수를 낮추는 주요 원인',
      'crossPlatformOutlook에서 SNS와 커뮤니티의 expectedSentiment가 다르면 플랫폼별 전략 필요',
      'actionPlan의 timing이 "immediate"인 항목을 최우선 실행',
      'confidenceLevel이 low이면 예측의 불확실성이 크므로 보수적으로 해석',
    ],
    tips: [
      '성공 요인 중 "strong"인 항목을 프로모션 핵심 메시지로 활용',
      '리스크 요인의 mitigation을 사전에 실행하여 반응 점수 상승 가능',
      '플랫폼별 전망을 참고하여 각 플랫폼에 맞는 콘텐츠 전략 수립',
      '반복 분석으로 컴백 일정에 따른 반응 점수 변화 추적',
    ],
    limitations: [
      '예측은 현재 여론 데이터 기반 — 실제 음악 품질/콘셉트 미공개 시 제한적',
      '경쟁 아티스트의 동시기 컴백은 변수로 완전 반영하기 어려움',
      '글로벌 시장 반응은 국내 데이터 기반 추정으로 정확도 제한',
    ],
    technicalDetails: [
      '입력: 기사 상위 15건(제목) + 댓글 상위 20건(100자 절단)',
      '선행 의존: 모든 선행 결과 종합 (distillForWinSimulation 재사용 — approval-rating, risk-map, opportunity, strategy, frame-war, crisis-scenario, sentiment-framing, segmentation)',
      '분석 알고리즘: 5단계 — 팬덤 상태 진단 → 성공 요인(3~7개, strong/moderate/weak/unknown) → 리스크 요인(2~5개) → 플랫폼별 전망 → 실행 계획 + 요약',
      'predictedReception 5단계: explosive / positive / mixed / negative / controversial',
      '성공 요인 5가지: 팬덤 열기 / 음악 품질 / 타이밍 / 프로모션 / 글로벌',
      '출력 스키마: predictedReception, confidenceLevel, receptionScore(0~100), successFactors[](currentStatus, importance), riskFactors[](riskLevel, mitigation), crossPlatformOutlook[](platform, expectedSentiment, keyMetric), actionPlan[](priority, timing)',
      'win-simulation과의 차이: 승리 확률 대신 "반응 점수" 도출, 플랫폼별 전망(음원사이트/유튜브/SNS/커뮤니티) 추가',
    ],
    source: 'release-reception-prediction 모듈 (Claude Sonnet 4.6)',
  },

  // ─── 기업 평판 도메인 (Stage 4) ───

  stakeholderMap: {
    title: '이해관계자 영향력 지도',
    description:
      'Stakeholder Salience Model(Mitchell, Agle & Wood, 1997)을 적용하여 기업에 영향을 미치는 이해관계자를 권력·합법성·긴급성 3축으로 분류하고 대응 우선순위를 결정합니다.',
    details: [
      '이해관계자 목록: 유형(투자자/소비자/임직원/규제기관/미디어)과 현출성 점수',
      'Salience Score (0~10): 권력·합법성·긴급성 3가지 속성 종합 점수',
      'engagementPriority: critical/high/medium/low 대응 우선순위',
      'criticalStakeholder: 가장 긴급하게 관리해야 할 이해관계자와 즉시 행동 지침',
      '권력 역학 관계: 이해관계자 간 연합 가능성 및 권력 구도 분석',
      '2×2 매트릭스: 고권력-고관심(Manage Closely) 등 4분면 분류',
    ],
    howToRead: [
      'Salience Score가 7 이상이면 Definitive 이해관계자 — 즉각 전략적 대응 필요',
      'engagementPriority가 critical인 이해관계자부터 우선 대응하세요',
      'powerDynamics에서 이해관계자 연합 가능성을 파악하면 선제 대응 가능',
      'currentSentiment가 "opposed"이면서 powerLevel이 "high"인 경우 위기 신호',
    ],
    tips: [
      'criticalStakeholder의 immediateAction을 즉시 실행하여 골든타임을 확보하세요',
      '투자자와 미디어가 동시에 "opposed" 상태이면 위기 대응 수준을 최고로 높이세요',
      '임직원(employees)의 불만이 외부 확산 전에 내부 소통으로 선제 차단하세요',
    ],
    limitations: [
      '온라인 데이터 기반이므로 오프라인 이해관계자 관계는 반영되지 않을 수 있음',
      '규제기관의 실제 의도는 공개 발언보다 내부 검토 과정에서 형성되므로 간접 추론임',
    ],
    technicalDetails: [
      '입력: 기사 15건(제목) + 댓글 30건(120자 절단)',
      '선행 의존: segmentation(audienceGroups), risk-map(topRisks)',
      '알고리즘: Mitchell et al.(1997) 3속성 × 3등급 조합으로 7가지 이해관계자 유형 결정',
      '출력: stakeholders[], powerDynamics, criticalStakeholder, stakeholderMatrix',
    ],
    source: 'stakeholder-map 모듈 (Gemini 2.5 Flash)',
  },

  esgSentiment: {
    title: 'ESG 여론 분석',
    description:
      '온라인 여론에서 E(환경)·S(사회)·G(지배구조) 3가지 차원의 기업 평판을 분리 측정하고 규제 리스크와 개선 기회를 식별합니다.',
    details: [
      'E·S·G 차원별 여론 점수 (0~100): 80+ 긍정, 60~79 양호, 40~59 보통, 20~39 취약, 0~19 위기',
      '차원별 긍정 요인 / 부정 요인 목록',
      'esgRisks: 차원(E/S/G), 심각도(critical~low), 영향 이해관계자',
      'esgOpportunities: 개선 기회와 예상 효과',
      'regulatoryRisk: 규제기관 개입 가능성 (high/medium/low)',
      'greenwashing 논란 감지 — isGreenwashing 플래그',
    ],
    howToRead: [
      'G(지배구조) 점수가 40 미만이면 투자자 이탈 위험 신호 — 즉각 개선 필요',
      'regulatoryRisk가 "high"이면 규제기관 조사 전에 선제 대응해야 합니다',
      'esgRisks에서 severity "critical"은 72시간 내 공식 입장 발표 필요 수준',
    ],
    tips: [
      'E·S·G 중 가장 낮은 차원부터 집중 개선하면 전체 평판 점수가 빠르게 향상됩니다',
      'esgOpportunities에서 S(사회) 영역 개선은 임직원 만족도와 소비자 신뢰를 동시에 개선',
    ],
    limitations: [
      'ESG 관련 언급이 적은 경우 점수 신뢰도가 낮아집니다 (데이터 부족 명시)',
      '공식 ESG 공시 데이터가 아닌 온라인 여론 기반 추정치입니다',
    ],
    technicalDetails: [
      '입력: 기사 25건(제목) + 댓글 30건(120자 절단)',
      '선행 의존: sentiment-framing(topKeywords)',
      '언급 없는 차원: score=50(중립), "데이터 부족" 명시',
      '출력: dimensions{E,S,G}, esgRisks[], esgOpportunities[], regulatoryRisk',
    ],
    source: 'esg-sentiment 모듈 (Gemini 2.5 Flash)',
  },

  reputationIndex: {
    title: '평판 지수 측정 (RepTrak)',
    description:
      'RepTrak 7차원 모델(Fombrun & van Riel, 2004)로 온라인 여론에서 기업의 종합 평판 점수를 측정하고 취약 차원과 개선 방향을 제시합니다.',
    details: [
      '종합 평판 점수 (0~100) + 추세 (improving/stable/declining)',
      'RepTrak 7차원별 점수: 제품·혁신·직장·거버넌스·시민의식·리더십·재무',
      '이해관계자별 평판 인식: 투자자/소비자/임직원별 주요 우려 vs 강점',
      'reputationGaps: 취약 지점, 심각도, 개선 권고사항',
      'benchmarkContext: 업계 평균 또는 이전 기간 대비 위치',
    ],
    howToRead: [
      '종합 점수 60 미만이면 평판 개선이 시급합니다',
      'dimensions 중 가장 낮은 차원이 전체 평판을 끌어내리는 핵심 취약점',
      '이해관계자별 인식 차이가 크면 타겟별 맞춤 커뮤니케이션 전략이 필요합니다',
    ],
    tips: [
      'reputationGaps의 severity "critical" 항목을 우선 해결하면 점수가 빠르게 회복됩니다',
      '리더십 점수 개선은 CEO 발언과 의사결정 투명성 강화로 효과적입니다',
    ],
    limitations: [
      '온라인 여론 기반이므로 오프라인 평판(B2B, 내부 관계)은 반영 한계',
      '업계 평균 비교는 경쟁사 데이터 없이 추정치입니다',
    ],
    technicalDetails: [
      '입력: 기사 20건 + 댓글 30건(120자 절단)',
      '선행 의존: sentiment-framing(sentimentRatio, frames), segmentation(platformSegments)',
      '알고리즘: RepTrak 7차원 매핑 + 이해관계자별 인식 분리',
      '출력: overallScore, trend, dimensions[], stakeholderPerceptions[], reputationGaps[]',
    ],
    source: 'reputation-index 모듈 (Claude Sonnet 4.6)',
  },

  crisisTypeClassifier: {
    title: 'SCCT 위기 유형 분류',
    description:
      'Situational Crisis Communication Theory(Coombs, 2007)로 위기 유형을 분류하고 Image Repair Theory(Benoit, 1997) 기반 최적 대응 전략과 골든타임을 평가합니다.',
    details: [
      'SCCT 위기 유형: victim(희생자형)/accidental(사고형)/preventable(예방가능형)',
      '귀속 책임 수준: low/medium/high — 대응 전략 선택의 핵심 기준',
      'Image Repair 전략: denial/evasion/reduction/corrective-action/mortification 우선순위',
      '골든타임 평가: 잔여 시간(시간 단위) + 긴급도 (critical/high/medium/low)',
      '과거 유사 위기 이력 및 영향',
    ],
    howToRead: [
      'crisisType이 "preventable"이면 책임 인정(mortification)이 필수 — 부정하면 역효과',
      'goldenTimeWindow urgencyLevel이 "critical"이면 24시간 내 공식 입장 발표 필수',
      'recommendedStrategies에서 priority 1번 전략부터 즉시 실행하세요',
    ],
    tips: [
      '"victim" 유형에서 mortification 전략을 쓰면 오히려 신뢰 손상 — 유형에 맞는 전략 선택 중요',
      'corrective-action 전략은 항상 가장 높은 공신력 — 가능하면 구체적 개선 약속과 함께 제시',
    ],
    limitations: [
      '위기 유형 판단은 공개된 정보 기반으로, 내부 경위 정보가 없으면 오류 가능',
      '골든타임은 여론 확산 속도 추정이며 실제 미디어 대응 타이밍은 다를 수 있음',
    ],
    technicalDetails: [
      '입력: 기사 20건 + 댓글 30건(120자 절단)',
      '선행 의존: risk-map(topRisks), macro-view(summary, overallDirection)',
      '알고리즘: SCCT 3유형 분류 → 귀속 책임 수준 판단 → Image Repair 전략 매핑',
      '출력: crisisType, responsibilityLevel, recommendedStrategies[], goldenTimeWindow',
    ],
    source: 'crisis-type-classifier 모듈 (Claude Sonnet 4.6)',
  },

  mediaFramingDominance: {
    title: '미디어 프레임 의제 설정력',
    description:
      'Media Framing Theory(Entman, 1993)와 Agenda-Setting Theory(McCombs & Shaw, 1972)를 결합하여 언론 기사 프레임과 댓글 여론 프레임의 간극을 측정하고, 기업 공식 메시지의 의제 설정력을 평가합니다.',
    details: [
      'dominantMediaFrame: 현재 가장 지배적인 언론 프레임과 강도(0~100)',
      'mediaFrames: 언론사별 프레임 목록 + 감정(positive/negative/neutral/mixed)',
      'commentFrames: 온라인 댓글의 실제 여론 프레임 (언론 프레임과의 괴리 확인)',
      'frameMismatch: 언론 프레임 vs 댓글 여론 괴리 항목 + 심각도',
      'companyMessageReflection: 기업 공식 발언이 언론에 반영된 정도(0~100)',
      'agendaLeadership: company-led/media-led/public-led/contested',
    ],
    howToRead: [
      'frameMismatch severity "critical"은 언론 보도와 실제 여론이 정반대 — PR 전략 재검토 필요',
      'companyMessageReflection이 30 미만이면 기업 메시지가 언론에 거의 반영 안 됨',
      'agendaLeadership이 "public-led"이면 온라인 여론이 의제를 선점 — 기업이 따라가는 상황',
    ],
    tips: [
      'media-led 상황에서는 언론사 접촉보다 SNS 직접 소통으로 의제 전환 시도',
      '프레임 괴리가 크면 투명한 팩트 공개로 신뢰 회복이 우선',
    ],
    limitations: [
      '기업 공식 발언 원문이 수집 데이터에 포함된 경우에만 반영도 측정 가능',
      '언론사 정치 성향에 따른 프레임 편차가 분석에 영향을 줄 수 있음',
    ],
    technicalDetails: [
      '입력: 기사 15건(제목) + 댓글 25건(150자 절단)',
      '선행 의존: sentiment-framing(프레임 목록), macro-view(뉴스 흐름)',
      '알고리즘: 언론 기사 프레임 추출 → 댓글 여론 프레임 추출 → 두 집합 간 유사도/괴리 측정',
      '출력: dominantMediaFrame, mediaFrames[], commentFrames[], frameMismatch[], companyMessageReflection, agendaLeadership',
    ],
    source: 'media-framing-dominance 모듈 (Gemini 2.5 Flash)',
  },

  csrCommunicationGap: {
    title: 'CSR 공약 진정성 간극',
    description:
      'Organizational Hypocrisy Theory(Brunsson, 1989)를 적용하여 기업이 주장하는 ESG/CSR 공약과 온라인 여론 평가의 진정성 간극을 측정하고 그린워싱 위험을 진단합니다.',
    details: [
      'csrClaims: E·S·G 차원별 기업 공약 + 신뢰도 점수(0~100) + 그린워싱 여부',
      'communicationGaps: 기업 내러티브 vs 온라인 여론 내러티브 + 간극 심각도',
      'csrInitiativeEffectiveness: CSR 활동별 평판 ROI (-100~100)',
      'overallCsrCredibility: 전반적 CSR 신뢰도 점수(0~100)',
      'greenwashingRisk: high/medium/low/none',
    ],
    howToRead: [
      'greenwashingRisk "high"이면 즉시 구체적 실행 증거 공시 필요',
      'overallCsrCredibility 40 미만이면 CSR 활동이 오히려 역효과를 내는 상황',
      'csrInitiativeEffectiveness가 음수인 활동은 중단하거나 소통 방식을 바꿔야 합니다',
    ],
    tips: [
      '공약보다 실적을 먼저 공개하면 그린워싱 의심을 예방할 수 있습니다',
      '제3자 인증(ESG 평가기관)을 언급하면 신뢰도가 빠르게 상승합니다',
    ],
    limitations: [
      '기업 공식 CSR 보고서나 공시가 데이터 수집에 포함된 경우에만 정확한 분석 가능',
      '그린워싱 판단은 온라인 여론 기반이며 실제 환경 성과와는 다를 수 있음',
    ],
    technicalDetails: [
      '입력: 기사 20건 + 댓글 25건(120자 절단)',
      '선행 의존: esg-sentiment(E/S/G 여론 점수), sentiment-framing(핵심 프레임)',
      '알고리즘: 기업 발언에서 CSR 공약 추출 → 온라인 여론 신뢰도 비교 → 간극 계산',
      '출력: csrClaims[], communicationGaps[], csrInitiativeEffectiveness[], overallCsrCredibility, greenwashingRisk',
    ],
    source: 'csr-communication-gap 모듈 (Claude Sonnet 4.6)',
  },

  reputationRecoverySimulation: {
    title: '평판 회복 시뮬레이션',
    description:
      'RepTrak Recovery(Fombrun, 2004)·SCCT(Coombs, 2007)·Social License to Operate(Thomson, 2000) 이론을 종합하여 평판 회복 목표 달성 확률과 최적 전략 우선순위를 도출합니다.',
    details: [
      'recoveryProbability: 평판 회복 목표 달성 확률 (0~100%)',
      'targetRecoveryScore: 목표 RepTrak 점수',
      'recoveryConditions: 회복 조건별 현재 충족 상태(met/partial/unmet) + 중요도',
      'obstacleConditions: 회복 장애 요인 + 이해관계자별 완화 방안',
      'recoveryStrategies: 우선순위별 전략 + 기대 효과 + 실행 시기(immediate/short-term/long-term)',
      'sloRecoveryStatus: 사회적 운영 허가권 회복 상태 (at-risk/partial/recovering/stable)',
    ],
    howToRead: [
      'recoveryProbability 40% 미만이면 현재 전략으로는 회복이 어려운 상황 — 근본적 변화 필요',
      'recoveryConditions에서 importance "critical"이 unmet이면 즉시 해결해야 회복 경로 열림',
      'sloRecoveryStatus "at-risk"이면 사업 영속성 위협 수준 — 경영진 직접 대응 필요',
    ],
    tips: [
      'recoveryStrategies에서 immediate 항목을 48시간 내 실행하면 회복 확률이 5~15%p 상승 가능',
      '핵심 이해관계자(Definitive) 신뢰 회복이 선결 조건 — stakeholder-map과 연계해 우선순위 확정',
    ],
    limitations: [
      '회복 확률은 현재 데이터 기반 추정치이며 새로운 위기 발생 시 재산출 필요',
      '전략 실행 실제 효과는 외부 변수(경쟁사 이슈, 거시 환경)에 따라 달라질 수 있음',
    ],
    technicalDetails: [
      '입력: Stage 1~3 전체 결과 + Stage 4 병렬 6개 모듈 결과 + crisis-scenario 결과',
      '선행 의존: reputation-index(overallScore, dimensions), crisis-type-classifier(crisisType, responsibilityLevel), stakeholder-map(criticalStakeholder), esg-sentiment(regulatoryRisk), crisis-scenario(scenarios)',
      '알고리즘: distillForReputationRecovery()로 핵심 컨텍스트 추출 → 회복 조건/장애 도출 → 확률 산출',
      '출력: recoveryProbability, confidenceLevel, recoveryConditions[], obstacleConditions[], recoveryStrategies[], sloRecoveryStatus',
    ],
    source: 'reputation-recovery-simulation 모듈 (Claude Sonnet 4.6)',
  },

  // ─── 헬스케어 도메인 (Stage 4) ───

  healthRiskPerception: {
    title: '건강 위험 인식 분석',
    description:
      'Risk Perception Theory(Slovic, 1987)를 적용하여 건강 위험에 대한 대중의 인식 편향을 분석합니다. 전문가(의학적) 평가와 대중 인식 간 간극을 측정하고 오정보 확산 패턴을 식별합니다.',
    details: [
      'perceivedRiskLevel: 대중 위험 인식 수준 (overestimated/accurate/underestimated)',
      'expertRiskVsPublicPerception: 전문가 평가 vs 대중 인식 비교 + 간극 크기(large/moderate/small)',
      'perceptionBiases: dread-factor(공포요소)·unknown-risk(미지성)·normalcy-bias(정상화편향)·availability-heuristic(가용성휴리스틱) 유형별 편향',
      'misinformationPatterns: 확산 중인 오정보/과장 주장 목록 + 확산 수준 + 정정 우선순위',
      'communicationRecommendations: 위험 인식 격차 해소 커뮤니케이션 권고 (대상·채널 포함)',
    ],
    howToRead: [
      'perceivedRiskLevel "overestimated"이면 공포 기반 과대 인식 — 팩트 기반 정정 커뮤니케이션 필요',
      'perceivedRiskLevel "underestimated"이면 정상화 편향 또는 무관심 — 위험 가시화 메시지 필요',
      'gapMagnitude "large"이면 전문가와 대중 간 인식 괴리가 심각 — 의료 불신 위험 상승',
      'misinformationPatterns에서 correctionPriority "urgent"인 항목은 즉시 공식 대응 필요',
      'dread-factor 편향이 강하면 통제 가능성을 강조하는 메시지가 효과적',
    ],
    tips: [
      '오정보 정정 시 공포 자극 회피 — 구체적 수치와 행동 방안을 함께 제시하세요',
      '미지성 편향이 강한 경우 전문가 설명 영상·인포그래픽이 텍스트보다 효과적',
      'communicationRecommendations의 channel을 확인하여 집단별 최적 채널 선택',
    ],
    limitations: [
      '전문가 위험 평가는 수집된 뉴스 기사 기반으로, 최신 의학 가이드라인과 차이가 있을 수 있음',
      '오정보 판별은 여론 데이터 패턴 기반으로, 사실 확인(fact-check)을 반드시 병행하세요',
      '위험 인식 편향 강도는 수집 기간과 이벤트 발생 여부에 크게 의존함',
    ],
    technicalDetails: [
      '입력: 기사 상위 20건(제목) + 댓글 상위 30건(120자 절단)',
      '선행 의존: sentiment-framing(negativeFrames), macro-view(overallDirection)',
      '알고리즘: Risk Perception Theory 4편향 유형별 데이터 패턴 매핑 → 전문가-대중 간극 측정',
      '출력 스키마: perceivedRiskLevel, expertRiskVsPublicPerception, perceptionBiases[], misinformationPatterns[], communicationRecommendations[], summary',
    ],
    source: 'health-risk-perception 모듈 (Claude Sonnet 4.6)',
  },

  compliancePredictor: {
    title: '의료 순응도 예측',
    description:
      'Health Belief Model(Rosenstock, 1966)의 6요인(취약성·심각성·이익·장벽·행동유발계기·자기효능감)과 Theory of Planned Behavior(Ajzen, 1991)를 적용하여 집단별 의료 순응 예측 확률과 장벽을 도출합니다.',
    details: [
      'overallComplianceProbability: 전체 의료 순응 예측 확률 (0~100%)',
      'hbmFactors: HBM 6요인(취약성/심각성/이익/장벽/행동유발계기/자기효능감) 각 수준 + 여론 근거',
      'segmentCompliance: 집단별(환자/보호자/의료진/일반대중) 순응 예측 확률 + 핵심 장벽 + 동기 요인',
      'interventionRecommendations: 순응도 향상 개입 권고 + 타겟 HBM 요인 + 기대 효과 + 우선순위',
    ],
    howToRead: [
      'overallComplianceProbability 70% 이상이면 대체로 순응 의도가 형성된 상태',
      'overallComplianceProbability 40% 미만이면 장벽이 이익을 압도 — 장벽 해소 전략 우선',
      'perceivedBarriers severity "high" 항목이 가장 먼저 해소해야 할 개입 대상',
      'segmentCompliance에서 집단별 확률 차이가 크면 맞춤형 메시지 전략 필요',
      'cuesToAction이 비어있으면 행동 유발 계기가 없음 — 캠페인·의료진 권고 강화 필요',
    ],
    tips: [
      'interventionRecommendations priority "high" 항목부터 자원을 집중하세요',
      '자기효능감(selfEfficacy)이 낮은 경우 "나도 할 수 있다"는 성공 사례 공유가 효과적',
      'HBM 장벽 중 비용 장벽은 지원 제도 안내, 접근성 장벽은 원격/방문 서비스로 해소',
    ],
    limitations: [
      '순응도 예측은 여론 데이터 기반으로 실제 행동과 의도 간 간극이 존재할 수 있음',
      '집단 분류는 segmentation 모듈 선행 결과에 의존하므로 세분화 정확도에 영향 받음',
      '개입 전략의 효과는 지역·문화·의료 시스템 맥락에 따라 달라질 수 있음',
    ],
    technicalDetails: [
      '입력: 기사 상위 20건(제목) + 댓글 상위 30건(120자 절단)',
      '선행 의존: health-risk-perception(perceivedRiskLevel), segmentation(audienceGroups)',
      '알고리즘: HBM 6요인 여론 신호 추출 → 집단별 순응 확률 도출 → 개입 전략 우선순위 산출',
      '출력 스키마: overallComplianceProbability, hbmFactors, segmentCompliance[], interventionRecommendations[], summary',
    ],
    source: 'compliance-predictor 모듈 (Claude Sonnet 4.6)',
  },

  // ─── 스포츠 도메인 (Stage 4-SP) ───

  performanceNarrative: {
    title: '성과 내러티브 분석',
    description:
      'BIRGing/CORFing Theory(Cialdini et al., 1976)와 Sport Brand Equity Model(Ross, 2006)을 적용하여 팀/선수 성적 변화에 따른 팬덤 여론 온도 상관관계와 지배적 서사 호를 분석합니다.',
    details: [
      '성적-여론 상관관계: 성적 변화 후 여론 반응까지의 시간 지연 및 강도',
      '서사 호(Arc) 유형: 부활/몰락/영웅/악역/라이벌리 — 지배적·부상·약화 상태',
      'BIRGing/CORFing 패턴: 팬 반응이 정체성 표출(BIRGing)인지 거리 두기(CORFing)인지 분류',
      '미디어 vs 팬 커뮤니티 프레임 차이: 언론과 팬덤이 채택한 성과 프레임 비교',
      '모멘텀 안정성 지수(0~100): 팬덤 여론의 변동성과 방향성 종합 평가',
    ],
    howToRead: [
      '서사 호 중 dominant(지배적)으로 표시된 것이 현재 팬덤을 지배하는 이야기',
      'BIRGing: 팬들이 팀과 강하게 동일시하는 긍정 신호 / CORFing: 이탈 징후',
      '미디어-팬 프레임 차이가 크면 공식 커뮤니케이션과 팬 인식 사이에 간극 존재',
      '안정성 지수가 낮으면(0~40) 단기 성적에 따라 여론이 급변할 수 있음',
    ],
    tips: [
      '부활 서사가 emerging(부상 중)이면 그 스토리를 공식 콘텐츠로 강화하여 BIRGing 극대화',
      '악역 프레임(구단 운영 비판)이 dominant이면 투명한 소통으로 프레임 전환 필요',
      '성적 부진 시 CORFing 급증 전에 선제적 팬 소통 이벤트로 이탈 방어',
    ],
    limitations: [
      '성적 관련 객관 데이터(경기 결과)가 없으면 BIRGing/CORFing 판별 정확도 낮아짐',
      '단기 이슈가 전체 서사를 왜곡할 수 있음 — 충분한 수집 기간 권장',
      '다종목·다팀 혼재 키워드는 서사 혼선 발생 가능',
    ],
    technicalDetails: [
      '입력: 기사 최근 20건(제목) + 댓글 30건(120자 절단)',
      '선행 의존: macro-view(이벤트 타임라인), sentiment-framing(긍정·부정 프레임)',
      '알고리즘: BIRGing/CORFing 신호어 패턴 인식 → 서사 호 분류 → 미디어/커뮤니티 프레임 비교 → 모멘텀 산출',
      '출력 스키마: performanceSentimentCorrelation, narrativeArcs[], keyPerformanceDrivers[], mediaFraming, momentumAssessment, summary',
    ],
    source: 'performance-narrative 모듈 (Claude Sonnet 4.6)',
  },

  seasonOutlookPrediction: {
    title: '시즌 전망 예측',
    description:
      'Sport Consumer Motivation Theory(Trail et al., 2003)와 BIRGing/CORFing Theory 기반으로 팬 기대치 지수(0~100), 팬 참여도 예측, 주요 관전 포인트와 리스크·기회 요인을 종합합니다. ⚠️ 여론 데이터 기반 예측이며 실제 성적에 따라 달라질 수 있습니다.',
    details: [
      '종합 전망: very-positive~very-negative 5단계 평가',
      '팬 기대치 지수(0~100): 성적 기대·스타 선수·라이벌전 등 복합 요인 종합',
      '팬 참여도 예측: 증가/유지/감소 추세와 신뢰도 및 근거',
      '주요 관전 포인트: 팬덤 주목도와 내러티브 잠재력 목록',
      '리스크 요인: 확률(0~1)·영향도·완화 방안',
      '기회 요인: 팬 유입·여론 호전 기회와 활용 방안',
    ],
    howToRead: [
      '기대치 지수 70+ → BIRGing 극대화 가능 시즌. 팬 경험 강화 투자 시점',
      '기대치 지수 40 미만 → CORFing 위험 증가. 비성적 가치(선수 스토리·커뮤니티)로 팬심 유지 필요',
      '참여도 예측 decreasing + 리스크 확률 0.6+ → 선제적 위기 대응 계획 수립',
      '기회 요인의 활용 방안은 마케팅·팬 서비스 팀 실행 계획으로 직접 전환 가능',
    ],
    tips: [
      '기대치가 높은 시즌 초반에 팬 멤버십·굿즈 캠페인을 집중 배치',
      '리스크 요인의 완화 방안을 시즌 전 위기관리 매뉴얼에 반영',
      '경쟁 팀 대비 여론 포지션을 확인하여 스폰서십·마케팅 포지셔닝에 활용',
    ],
    limitations: [
      '성적 결과는 예측 불가 — 기대치 지수는 여론 기반이므로 실제 성적과 괴리 가능',
      '시즌 개막 전 데이터가 부족하면 예측 신뢰도가 낮아짐',
      '주요 선수 부상·이적 등 돌발 변수는 예측 범위 밖',
    ],
    technicalDetails: [
      '입력: 기사 최근 20건(제목) + 댓글 30건(120자 절단)',
      '선행 의존: performance-narrative(모멘텀 방향), fan-loyalty-index(충성도 지수), opportunity(미개발 기회 영역)',
      '알고리즘: 팬 기대치 지수 산출 → 참여도 추세 예측 → 관전 포인트·리스크·기회 식별 → 종합 전망',
      '출력 스키마: overallOutlook, fanExpectationLevel, fanEngagementForecast, keyWatchPoints[], riskFactors[], opportunityFactors[], competitorComparison, disclaimer, summary',
    ],
    source: 'season-outlook-prediction 모듈 (Claude Sonnet 4.6)',
  },
} as const;

// ─── 전체 가이드 버튼 ───

export function AdvancedHelp() {
  const [helpTab, setHelpTab] = useState('overview');

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
        <HelpCircle className="h-4 w-4" />
        고급 분석 가이드
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" side="bottom" align="end">
        <Tabs value={helpTab} onValueChange={setHelpTab}>
          <div className="border-b px-3 pt-3">
            <h4 className="font-semibold text-sm mb-2">고급 분석 사용 가이드</h4>
            <TabsList className="w-full h-auto flex-wrap gap-1">
              <TabsTrigger value="overview" className="text-xs">
                개요
              </TabsTrigger>
              <TabsTrigger value="cards" className="text-xs">
                카드별 안내
              </TabsTrigger>
              <TabsTrigger value="howto" className="text-xs">
                활용 방법
              </TabsTrigger>
              <TabsTrigger value="caution" className="text-xs">
                유의사항
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* 개요 탭 */}
            <TabsContent value="overview" className="p-4 space-y-3 mt-0">
              <p className="text-xs text-muted-foreground leading-relaxed">
                고급 분석은 Stage 1~3 결과를 기반으로{' '}
                <span className="text-foreground font-medium">Claude Sonnet 4.6</span>이 수행하는
                전략 시뮬레이션 모듈입니다. 분석 키워드에 따라 정치/팬덤 도메인이 자동 감지되어 해당
                도메인의 4개 모듈이 실행됩니다.
              </p>

              <Separator />

              <div>
                <p className="font-medium text-foreground text-xs mb-2">실행 조건</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li className="flex gap-1.5">
                    <span className="text-muted-foreground/60 shrink-0">•</span>
                    <span>
                      Stage 1~3 (기초+심층+종합) 분석이{' '}
                      <span className="text-foreground">먼저 완료</span>되어야 합니다
                    </span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-muted-foreground/60 shrink-0">•</span>
                    <span>
                      Stage 4는 선행 결과를 참조하여{' '}
                      <span className="text-foreground">자동 실행</span>됩니다
                    </span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-muted-foreground/60 shrink-0">•</span>
                    <span>
                      완료 시 AI 리포트도 <span className="text-foreground">자동으로 재생성</span>
                      됩니다 (고급 분석 포함)
                    </span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-muted-foreground/60 shrink-0">•</span>
                    <span>
                      도메인은 <span className="text-foreground">자동 감지</span> (정치/팬덤 키워드
                      기반)
                    </span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div>
                <p className="font-medium text-foreground text-xs mb-2">정치 도메인 모듈 (4개)</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'AI 지지율 추정', desc: '감정 비율 + 편향 보정으로 지지율 범위 추정' },
                    { name: '프레임 전쟁', desc: '경쟁 프레임 분석 — 지배/위협/반전 가능' },
                    { name: '위기 시나리오', desc: '3가지 시나리오 (확산/통제/역전) 시뮬레이션' },
                    { name: '승리 시뮬레이션', desc: '승리 확률, 조건 체크리스트, 핵심 전략' },
                  ].map((mod) => (
                    <div key={mod.name} className="rounded-lg border p-2">
                      <p className="text-xs font-medium text-foreground">{mod.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{mod.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-medium text-foreground text-xs mb-2">팬덤 도메인 모듈 (4개)</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: '팬덤 충성도 지수', desc: '참여도·감정·옹호 3차원 충성도 분석' },
                    { name: '내러티브 경쟁', desc: '팬/안티/미디어 간 내러티브 경쟁 구도' },
                    {
                      name: '팬덤 위기 시나리오',
                      desc: '팬덤 특화 위기 확산/통제/역전 시뮬레이션',
                    },
                    { name: '컴백 반응 예측', desc: '신곡/신작 반응 점수와 플랫폼별 전망' },
                  ].map((mod) => (
                    <div key={mod.name} className="rounded-lg border p-2">
                      <p className="text-xs font-medium text-foreground">{mod.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{mod.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-[10px] text-muted-foreground">
                  Stage 1은 <span className="text-foreground">Gemini 2.5 Flash</span>(속도/비용
                  우선), Stage 2~4는 <span className="text-foreground">Claude Sonnet 4.6</span>(복합
                  추론/품질 우선)을 사용합니다. 각 모듈은 선행 결과의 핵심 필드만 주입(Context
                  Distillation)하여 토큰을 절약합니다. 각 카드의 <Info className="h-3 w-3 inline" />{' '}
                  아이콘을 클릭하면 해당 카드의 상세 가이드를 확인할 수 있습니다.
                </p>
              </div>
            </TabsContent>

            {/* 카드별 안내 탭 */}
            <TabsContent value="cards" className="p-4 space-y-2 mt-0">
              <p className="text-xs text-muted-foreground mb-2">
                각 카드의 구성 요소와 데이터를 읽는 방법을 안내합니다.
              </p>

              {[
                {
                  group: '정치 도메인',
                  cards: [
                    {
                      name: 'AI 지지율 추정',
                      badge: '추정',
                      elements: [
                        '큰 숫자: 추정 범위 (min~max%)',
                        '신뢰도 Badge: 높음(초록)/보통(주황)/낮음(빨강)',
                        '도넛 차트: 감정 비율 (긍정/중립/부정)',
                        '편향 보정 테이블: 플랫폼별 편향 방향과 보정계수',
                        '"추론 과정" 접이식: AI의 추론 논리',
                        '하단 면책 문구',
                      ],
                    },
                    {
                      name: '프레임 전쟁',
                      badge: '전략',
                      elements: [
                        '전장 요약: 현재 프레임 경쟁 상황 텍스트',
                        '막대 차트: 지배적 프레임 TOP 5 강도',
                        '빨간 카드: 위협 프레임 (위협도 Badge + 대응 전략)',
                        '파란 카드: 반전 가능 프레임 (현재→반전 + 필요 행동)',
                      ],
                    },
                    {
                      name: '위기 시나리오',
                      badge: '시나리오',
                      elements: [
                        '리스크 레벨 Badge: 전체 위기 수준',
                        '3개 시나리오 카드: 확산(빨강)/통제(주황)/역전(초록)',
                        '각 카드: 발생 확률 바, 트리거 조건, 대응 전략, 예상 결과',
                        '하단: 권고 행동',
                      ],
                    },
                    {
                      name: '승리 시뮬레이션',
                      badge: '시뮬레이션',
                      elements: [
                        '반원형 차트: 승리 확률 (%)',
                        '신뢰도 Badge: 높음/보통/낮음',
                        '체크리스트: 승리 조건 (충족/부분/미충족)',
                        '경고 카드: 패배 리스크 (high/medium/low + 완화 방안)',
                        '순서 리스트: 핵심 전략 (우선순위별)',
                      ],
                    },
                  ],
                },
                {
                  group: '팬덤 도메인',
                  cards: [
                    {
                      name: '팬덤 충성도 지수',
                      badge: '충성도',
                      elements: [
                        '3차원 점수: engagement / sentiment / advocacy (각 0~100)',
                        '이탈 징후 카드: signal, severity, evidence',
                        '팬덤 세분화: devoted/active/passive/dormant/at-risk',
                        '자발적 옹호: activeDefenders 수, defensePatterns',
                        '하단: 권고 메시지',
                      ],
                    },
                    {
                      name: '내러티브 경쟁',
                      badge: '내러티브',
                      elements: [
                        '지배적 내러티브: strength 막대 차트 + 출처(fans/anti-fans/media 등)',
                        '대응 내러티브: 위협도 Badge + originPlatform',
                        '팬덤 간 경쟁: rivalTargets, battlefronts (승/접전/패)',
                        '전장 종합 텍스트',
                      ],
                    },
                    {
                      name: '팬덤 위기 시나리오',
                      badge: '시나리오',
                      elements: [
                        '리스크 레벨 Badge: 팬덤 위기 수준',
                        '3개 시나리오: 확산(팬덤→언론→국제) / 통제 / 역전',
                        '대응 주체: 기획사/멤버/팬덤별 역할 명시',
                        '하단: 권고 행동',
                      ],
                    },
                    {
                      name: '컴백 반응 예측',
                      badge: '예측',
                      elements: [
                        '반응 점수: 0~100 + 예상 반응 5단계',
                        '성공 요인: 팬덤 열기/음악 품질/타이밍/프로모션/글로벌',
                        '리스크 요인: riskLevel + 완화 방안',
                        '플랫폼별 전망: 음원사이트/유튜브/SNS/커뮤니티',
                        '실행 계획: 우선순위 + timing',
                      ],
                    },
                  ],
                },
              ].map((group) => (
                <div key={group.group}>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">
                    {group.group}
                  </p>
                  {group.cards.map((card) => (
                    <Collapsible key={card.name}>
                      <CollapsibleTrigger className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors text-left group">
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                          {card.badge}
                        </Badge>
                        <span className="text-xs font-medium text-foreground flex-1">
                          {card.name}
                        </span>
                        <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ul className="ml-6 pl-2 border-l py-2 space-y-1">
                          {card.elements.map((el, i) => (
                            <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                              <span className="text-muted-foreground/60 shrink-0">•</span>
                              <span>{el}</span>
                            </li>
                          ))}
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              ))}
            </TabsContent>

            {/* 활용 방법 탭 */}
            <TabsContent value="howto" className="p-4 space-y-3 mt-0">
              <div>
                <p className="font-medium text-foreground text-xs mb-2">
                  정치 도메인 — 추천 읽기 순서
                </p>
                <ol className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]"
                    >
                      1
                    </Badge>
                    <span>
                      <span className="text-foreground">위기 시나리오</span>로 현재 위기 수준과
                      가능한 경로 파악
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]"
                    >
                      2
                    </Badge>
                    <span>
                      <span className="text-foreground">프레임 전쟁</span>으로 여론 전장의 구도와
                      기회 확인
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]"
                    >
                      3
                    </Badge>
                    <span>
                      <span className="text-foreground">승리 시뮬레이션</span>으로 실행 전략과
                      우선순위 결정
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]"
                    >
                      4
                    </Badge>
                    <span>
                      <span className="text-foreground">AI 지지율</span>로 정량적 현재 위치 참고
                    </span>
                  </li>
                </ol>
              </div>

              <div>
                <p className="font-medium text-foreground text-xs mb-2">
                  팬덤 도메인 — 추천 읽기 순서
                </p>
                <ol className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]"
                    >
                      1
                    </Badge>
                    <span>
                      <span className="text-foreground">팬덤 충성도</span>로 현재 팬덤 건강도와 이탈
                      징후 파악
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]"
                    >
                      2
                    </Badge>
                    <span>
                      <span className="text-foreground">내러티브 경쟁</span>으로 팬덤 간 세력 구도와
                      위협 확인
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]"
                    >
                      3
                    </Badge>
                    <span>
                      <span className="text-foreground">팬덤 위기 시나리오</span>로 위기 확산 경로와
                      대응 방안 수립
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]"
                    >
                      4
                    </Badge>
                    <span>
                      <span className="text-foreground">컴백 반응 예측</span>으로 플랫폼별 전망과
                      실행 계획 수립
                    </span>
                  </li>
                </ol>
              </div>

              <Separator />

              <div>
                <p className="font-medium text-foreground text-xs mb-2">실무 시나리오별 활용</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span>
                      <span className="text-foreground">위기 대응 회의:</span> 위기 시나리오 3개를
                      시나리오별 역할 분담 기반으로 논의
                    </span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span>
                      <span className="text-foreground">메시지 전략 수립:</span> 프레임 전쟁의
                      지배/반전 프레임을 핵심 메시지에 반영
                    </span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span>
                      <span className="text-foreground">컴백 기획:</span> 반응 예측의 성공 요인을
                      프로모션 타임라인에 반영
                    </span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span>
                      <span className="text-foreground">주간 브리핑:</span> 승리 확률/충성도 추이 +
                      지지율/반응 점수 변화를 시각적으로 보고
                    </span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span>
                      <span className="text-foreground">전략 효과 측정:</span> 전략 실행 전/후 반복
                      분석으로 승리 조건/충성도 변화 추적
                    </span>
                  </li>
                </ul>
              </div>
            </TabsContent>

            {/* 유의사항 탭 */}
            <TabsContent value="caution" className="p-4 space-y-3 mt-0">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex gap-1.5">
                  <span className="text-amber-500 shrink-0">!</span>
                  <div>
                    <span className="text-foreground font-medium">AI 시뮬레이션 한계</span>
                    <p className="mt-0.5">
                      고급 분석은 수집된 온라인 데이터 기반의 AI 추정입니다. 예측이 아닌
                      &quot;가능성 탐색&quot;으로 활용해야 합니다.
                    </p>
                  </div>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-amber-500 shrink-0">!</span>
                  <div>
                    <span className="text-foreground font-medium">지지율·충성도 추정 면책</span>
                    <p className="mt-0.5">
                      AI 지지율 추정은 실제 여론조사와, 충성도 지수는 실제 팬덤 조사와 방법론이
                      다릅니다. 공개 데이터로 인용하거나 대외 보고에 사용하면 안 됩니다.
                    </p>
                  </div>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-amber-500 shrink-0">!</span>
                  <div>
                    <span className="text-foreground font-medium">확률의 의미</span>
                    <p className="mt-0.5">
                      승리 확률, 시나리오 발생 확률, 반응 점수 등은 AI의 주관적 추정입니다.
                      통계적으로 검증된 수치가 아닙니다.
                    </p>
                  </div>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-amber-500 shrink-0">!</span>
                  <div>
                    <span className="text-foreground font-medium">선행 분석 의존</span>
                    <p className="mt-0.5">
                      고급 분석의 품질은 Stage 1~3 분석 결과에 의존합니다. 기초 분석의 수집 데이터가
                      부족하면 고급 분석도 제한적입니다. 각 모듈은 선행 결과에서 핵심 필드만
                      추출(Context Distillation)하여 입력으로 사용합니다.
                    </p>
                  </div>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-amber-500 shrink-0">!</span>
                  <div>
                    <span className="text-foreground font-medium">비용</span>
                    <p className="mt-0.5">
                      Stage 1은 Gemini 2.5 Flash(저비용), Stage 2~4는 Claude Sonnet 4.6을
                      사용합니다. 고급 분석 4개 모듈 모두 Claude Sonnet이므로 Stage 1보다 API 비용이
                      높습니다. 토큰 최적화(경량/표준/강력/RAG) 설정으로 비용 조절 가능합니다.
                    </p>
                  </div>
                </li>
              </ul>
            </TabsContent>
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
