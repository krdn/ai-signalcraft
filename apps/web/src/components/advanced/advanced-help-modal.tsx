'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
