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
  source: string;
}

export function AdvancedCardHelp({
  title,
  description,
  details,
  howToRead,
  tips,
  limitations,
  source,
}: AdvancedCardHelpProps) {
  const [activeSection, setActiveSection] = useState<'info' | 'read' | 'tips'>('info');

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
        </div>

        <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
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
    source: '지지율 분석 모듈 (Claude Sonnet)',
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
    source: '프레임 전쟁 모듈 (Claude Sonnet)',
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
    source: '위기 시나리오 모듈 (Claude Sonnet)',
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
    source: '승리 시뮬레이션 모듈 (Claude Sonnet)',
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
                <span className="text-foreground font-medium">Claude Sonnet</span>이 수행하는 4개
                전략 시뮬레이션 모듈입니다. 일반 분석보다 더 높은 수준의 AI 모델을 사용하여 전략적
                인사이트를 제공합니다.
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
                </ul>
              </div>

              <Separator />

              <div>
                <p className="font-medium text-foreground text-xs mb-2">4개 분석 모듈</p>
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

              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-[10px] text-muted-foreground">
                  모든 고급 분석 모듈은 <span className="text-foreground">Claude Sonnet</span>을
                  사용하며, Stage 1~2의 기초/심층 분석 결과를 입력으로 받습니다. 각 카드의{' '}
                  <Info className="h-3 w-3 inline" /> 아이콘을 클릭하면 해당 카드의 상세 가이드를
                  확인할 수 있습니다.
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
              ].map((card) => (
                <Collapsible key={card.name}>
                  <CollapsibleTrigger className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors text-left group">
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                      {card.badge}
                    </Badge>
                    <span className="text-xs font-medium text-foreground flex-1">{card.name}</span>
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
            </TabsContent>

            {/* 활용 방법 탭 */}
            <TabsContent value="howto" className="p-4 space-y-3 mt-0">
              <div>
                <p className="font-medium text-foreground text-xs mb-2">추천 읽기 순서</p>
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
                      <span className="text-foreground">주간 브리핑:</span> 승리 확률 추이 + 지지율
                      추정 변화를 시각적으로 보고
                    </span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span>
                      <span className="text-foreground">전략 효과 측정:</span> 전략 실행 전/후 반복
                      분석으로 승리 조건 충족도 변화 추적
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
                      고급 분석은 수집된 온라인 데이터 기반의 AI 추정입니다. 예측이 아닌 "가능성
                      탐색"으로 활용해야 합니다.
                    </p>
                  </div>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-amber-500 shrink-0">!</span>
                  <div>
                    <span className="text-foreground font-medium">지지율 추정 면책</span>
                    <p className="mt-0.5">
                      AI 지지율 추정은 실제 여론조사와 방법론이 완전히 다릅니다. 공개 데이터로
                      인용하거나 대외 보고에 사용하면 안 됩니다.
                    </p>
                  </div>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-amber-500 shrink-0">!</span>
                  <div>
                    <span className="text-foreground font-medium">확률의 의미</span>
                    <p className="mt-0.5">
                      승리 확률, 시나리오 발생 확률 등은 AI의 주관적 추정입니다. 통계적으로 검증된
                      수치가 아닙니다.
                    </p>
                  </div>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-amber-500 shrink-0">!</span>
                  <div>
                    <span className="text-foreground font-medium">선행 분석 의존</span>
                    <p className="mt-0.5">
                      고급 분석의 품질은 Stage 1~3 분석 결과에 의존합니다. 기초 분석의 수집 데이터가
                      부족하면 고급 분석도 제한적입니다.
                    </p>
                  </div>
                </li>
                <li className="flex gap-1.5">
                  <span className="text-amber-500 shrink-0">!</span>
                  <div>
                    <span className="text-foreground font-medium">비용</span>
                    <p className="mt-0.5">
                      고급 분석 4개 모듈 모두 Claude Sonnet을 사용하므로, Stage 1(GPT-4o-mini)보다
                      API 비용이 높습니다.
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
