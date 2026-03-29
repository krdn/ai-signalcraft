'use client';

import { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * AI 리포트 도움말 컴포넌트
 * - 리포트 구조, 섹션별 읽는 법, 활용 팁, 한계/유의사항 제공
 */
export function ReportHelp() {
  const [helpTab, setHelpTab] = useState('overview');

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
        <HelpCircle className="h-4 w-4" />
        리포트 가이드
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" side="bottom" align="end">
        <Tabs value={helpTab} onValueChange={setHelpTab}>
          <div className="border-b px-3 pt-3">
            <h4 className="font-semibold text-sm mb-2">AI 리포트 사용 가이드</h4>
            <TabsList className="w-full h-auto flex-wrap gap-1">
              <TabsTrigger value="overview" className="text-xs">개요</TabsTrigger>
              <TabsTrigger value="sections" className="text-xs">섹션별 안내</TabsTrigger>
              <TabsTrigger value="howto" className="text-xs">활용 방법</TabsTrigger>
              <TabsTrigger value="caution" className="text-xs">유의사항</TabsTrigger>
            </TabsList>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* 개요 탭 */}
            <TabsContent value="overview" className="p-4 space-y-3 mt-0">
              <div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  AI 리포트는 12개 분석 모듈의 결과를 AI(Claude Sonnet)가 종합하여 생성한
                  <span className="text-foreground font-medium"> 전략 중심의 마크다운 문서</span>입니다.
                  단순 데이터 요약이 아닌, 실제 의사결정에 활용 가능한 수준의 분석과 전략을 제공합니다.
                </p>
              </div>

              <Separator />

              <div>
                <p className="font-medium text-foreground text-xs mb-2">리포트 생성 과정</p>
                <div className="flex items-center gap-1 flex-wrap text-xs">
                  {[
                    { label: 'Stage 1~3 완료', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
                    { label: '1차 리포트', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
                    { label: 'Stage 4 완료', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400' },
                    { label: '최종 리포트', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
                  ].map((step, i) => (
                    <div key={step.label} className="flex items-center gap-1">
                      <span className={`rounded-md px-2 py-0.5 font-medium ${step.color}`}>
                        {step.label}
                      </span>
                      {i < 3 && <span className="text-muted-foreground">→</span>}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Stage 4(고급 분석) 완료 시 리포트가 자동으로 재생성되어 고급 분석 내용이 추가됩니다.
                </p>
              </div>

              <Separator />

              <div>
                <p className="font-medium text-foreground text-xs mb-2">리포트 구조 (8개 섹션)</p>
                <ol className="space-y-1 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">1</Badge>
                    <span><span className="text-foreground">전체 여론 구조</span> — 거시적 여론 흐름과 트렌드</span>
                  </li>
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">2</Badge>
                    <span><span className="text-foreground">집단별 반응 분석</span> — 세그먼트별 특성과 크기</span>
                  </li>
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">3</Badge>
                    <span><span className="text-foreground">감정 및 프레임 분석</span> — 미디어 프레이밍과 감정 톤</span>
                  </li>
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">4</Badge>
                    <span><span className="text-foreground">메시지 효과 분석</span> — 발언/이벤트의 여론 영향</span>
                  </li>
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">5</Badge>
                    <span><span className="text-foreground">리스크 분석</span> — 잠재 위협과 대응 필요 사항</span>
                  </li>
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">6</Badge>
                    <span><span className="text-foreground">기회 분석</span> — 활용 가능한 긍정 요소</span>
                  </li>
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">7</Badge>
                    <span><span className="text-foreground">전략 도출</span> — 메시지·매체·위기 대응 전략</span>
                  </li>
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">8</Badge>
                    <span><span className="text-foreground">최종 전략 요약</span> — 핵심 발견과 즉시 행동 사항</span>
                  </li>
                </ol>
              </div>

              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-[10px] text-muted-foreground">
                  고급 분석(Stage 4) 완료 시 <span className="text-foreground">지지율 추정, 프레임 전쟁, 위기 시나리오, 승리 시뮬레이션</span> 섹션이 추가됩니다.
                </p>
              </div>
            </TabsContent>

            {/* 섹션별 안내 탭 */}
            <TabsContent value="sections" className="p-4 space-y-3 mt-0">
              <p className="text-xs text-muted-foreground">
                각 섹션의 내용과 해당 분석 모듈을 안내합니다. 좌측 목차로 원하는 섹션으로 바로 이동할 수 있습니다.
              </p>

              {[
                {
                  num: '1',
                  title: '전체 여론 구조',
                  module: '거시 분석 (GPT-4o-mini)',
                  desc: '분석 기간 동안의 전체 여론 흐름을 요약합니다. 일별 언급량 변화, 주요 변곡점(이벤트), 여론의 전반적 방향(긍정/부정/혼합)을 서술합니다.',
                  keyPoints: ['언급량 급등/급락 시점과 원인', '여론의 전환 계기', '전체적 흐름의 방향성'],
                },
                {
                  num: '2',
                  title: '집단별 반응 분석',
                  module: '세그멘테이션 (GPT-4o-mini)',
                  desc: '여론 참여자를 지지층, 반대층, 부동층 등으로 분류하고 각 집단의 특성, 규모, 주요 관심사를 분석합니다.',
                  keyPoints: ['세그먼트별 크기와 성향', '플랫폼별 여론 분포', '핵심 설득 대상 그룹'],
                },
                {
                  num: '3',
                  title: '감정 및 프레임 분석',
                  module: '감정 프레이밍 (GPT-4o-mini)',
                  desc: '미디어와 여론의 감정 톤(긍정/부정/중립)과 프레이밍 방식을 분석합니다. 어떤 프레임으로 보도/논의되는지 파악합니다.',
                  keyPoints: ['지배적 감정 톤', '미디어 프레이밍 패턴', '감정 전환점'],
                },
                {
                  num: '4',
                  title: '메시지 효과 분석',
                  module: '메시지 임팩트 (GPT-4o-mini)',
                  desc: '특정 발언, 이벤트, 콘텐츠가 여론에 미친 영향을 측정합니다. 바이럴 효과와 핵심 키워드를 추출합니다.',
                  keyPoints: ['영향력 높은 발언/이벤트', '바이럴 전파 경로', '핵심 키워드의 확산 패턴'],
                },
                {
                  num: '5',
                  title: '리스크 분석',
                  module: '리스크 맵 (Claude Sonnet)',
                  desc: 'Stage 1 결과를 종합하여 잠재 위험 요인을 식별합니다. 영향도, 확산 확률, 트리거 조건을 포함합니다.',
                  keyPoints: ['위험 요인의 우선순위', '각 리스크의 발생 조건', '확산 시나리오'],
                },
                {
                  num: '6',
                  title: '기회 분석',
                  module: '기회 발굴 (Claude Sonnet)',
                  desc: '여론 데이터에서 활용 가능한 긍정 요소와 전략적 기회를 도출합니다. 구체적 활용 방안이 포함됩니다.',
                  keyPoints: ['즉시 활용 가능한 기회', '잠재적 성장 포인트', '경쟁 우위 요소'],
                },
                {
                  num: '7',
                  title: '전략 도출',
                  module: '전략 제안 (Claude Sonnet)',
                  desc: '모든 분석을 종합한 구체적 대응 전략입니다. 메시지 방향, 매체 전략, 위기 대응 시나리오를 포함합니다.',
                  keyPoints: ['핵심 메시지 프레임', '채널별 커뮤니케이션 전략', '위기 대응 플레이북'],
                },
                {
                  num: '8',
                  title: '최종 전략 요약',
                  module: '종합 요약 (Claude Sonnet)',
                  desc: '리포트 전체의 핵심 발견사항과 우선순위별 즉시 행동 사항을 정리한 최종 요약입니다.',
                  keyPoints: ['한 줄 핵심 메시지', '즉시 실행 TOP 3', '중장기 과제'],
                },
              ].map((section) => (
                <Collapsible key={section.num}>
                  <CollapsibleTrigger className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors text-left group">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">
                      {section.num}
                    </Badge>
                    <span className="text-xs font-medium text-foreground flex-1">{section.title}</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                      {section.module.split(' (')[0]}
                    </Badge>
                    <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 pl-2 border-l py-2 space-y-1.5">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {section.desc}
                      </p>
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">주요 확인 포인트:</p>
                        <ul className="space-y-0.5">
                          {section.keyPoints.map((point) => (
                            <li key={point} className="text-[10px] text-muted-foreground flex gap-1">
                              <span className="text-primary shrink-0">→</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-[9px] text-muted-foreground/60">
                        분석 모듈: {section.module}
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}

              <Separator />

              <Collapsible>
                <CollapsibleTrigger className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors text-left group">
                  <Badge className="shrink-0 text-[9px] px-1.5 py-0 h-4 bg-purple-500/20 text-purple-700 dark:text-purple-400 hover:bg-purple-500/30">
                    고급
                  </Badge>
                  <span className="text-xs font-medium text-foreground flex-1">고급 분석 섹션 (Stage 4 완료 시)</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-6 pl-2 border-l py-2 space-y-2">
                    {[
                      { title: 'AI 지지율 추정', desc: '수집 데이터 기반 지지율 추이 추정. 면책 문구가 반드시 포함됩니다.' },
                      { title: '프레임 전쟁 분석', desc: '진영별 프레이밍 전략 비교. 지배적/위협/반전 가능 프레임을 구분합니다.' },
                      { title: '위기 시나리오', desc: '최악/최선/가능성 높은 3가지 시나리오를 표 형태로 정리합니다.' },
                      { title: '승리 시뮬레이션', desc: '최적 경로, 핵심 변수, 실행 타임라인을 도출합니다.' },
                    ].map((item) => (
                      <div key={item.title}>
                        <p className="text-[11px] text-foreground font-medium">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                      </div>
                    ))}
                    <p className="text-[9px] text-muted-foreground/60">
                      분석 모듈: 지지율·프레임 전쟁·위기 시나리오·승리 시뮬레이션 (Claude Sonnet)
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </TabsContent>

            {/* 활용 방법 탭 */}
            <TabsContent value="howto" className="p-4 space-y-3 mt-0">
              <div>
                <p className="font-medium text-foreground text-xs mb-2">리포트 읽기 순서</p>
                <ol className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">1</Badge>
                    <span><span className="text-foreground">한 줄 요약</span>을 먼저 읽고 전체 맥락 파악</span>
                  </li>
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">2</Badge>
                    <span><span className="text-foreground">최종 전략 요약</span>(마지막 섹션)으로 이동 — 핵심 행동 사항 확인</span>
                  </li>
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">3</Badge>
                    <span>관심 있는 <span className="text-foreground">개별 섹션</span>을 좌측 목차로 점프하여 상세 확인</span>
                  </li>
                  <li className="flex gap-2">
                    <Badge variant="outline" className="shrink-0 h-4 min-w-4 justify-center p-0 text-[9px]">4</Badge>
                    <span><span className="text-foreground">리스크 + 기회 + 전략</span> 섹션을 함께 읽으면 실행 계획 수립 가능</span>
                  </li>
                </ol>
              </div>

              <Separator />

              <div>
                <p className="font-medium text-foreground text-xs mb-2">실무 활용 팁</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span><span className="text-foreground">팀 브리핑용:</span> 한 줄 요약 + 최종 전략 요약을 슬라이드로 활용. PDF 내보내기로 공유</span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span><span className="text-foreground">위기 대응:</span> 리스크 분석 → 위기 시나리오(고급) → 전략 도출 순서로 즉시 대응 계획 수립</span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span><span className="text-foreground">메시지 전략:</span> 감정/프레임 분석 + 메시지 효과 → 전략 도출의 메시지 방향을 참고하여 핵심 메시지 작성</span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span><span className="text-foreground">정기 모니터링:</span> 매주/격주 동일 키워드로 분석 실행하여 리포트 비교 → 여론 변화 추적</span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span><span className="text-foreground">대시보드 연계:</span> 리포트의 서술 내용과 대시보드 차트를 교차 확인하면 더 깊은 인사이트 도출</span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div>
                <p className="font-medium text-foreground text-xs mb-2">기능 안내</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span><span className="text-foreground">좌측 목차:</span> 데스크톱에서 좌측 사이드바로 원하는 섹션에 바로 점프 (모바일은 상단 수평 탭)</span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span><span className="text-foreground">PDF 내보내기:</span> 브라우저 인쇄 기능으로 PDF 저장. 팀 공유 및 보고용으로 활용</span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-primary shrink-0">→</span>
                    <span><span className="text-foreground">스크롤 추적:</span> 스크롤 위치에 따라 좌측 목차의 현재 섹션이 자동으로 하이라이트됨</span>
                  </li>
                </ul>
              </div>
            </TabsContent>

            {/* 유의사항 탭 */}
            <TabsContent value="caution" className="p-4 space-y-3 mt-0">
              <div>
                <p className="font-medium text-foreground text-xs mb-2">리포트 해석 시 유의사항</p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex gap-1.5">
                    <span className="text-amber-500 shrink-0">!</span>
                    <div>
                      <span className="text-foreground font-medium">AI 생성 콘텐츠</span>
                      <p className="mt-0.5">리포트는 AI가 분석 데이터를 기반으로 생성한 것입니다. 최종 의사결정 전 전문가 검토를 권장합니다.</p>
                    </div>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-amber-500 shrink-0">!</span>
                    <div>
                      <span className="text-foreground font-medium">데이터 범위 한계</span>
                      <p className="mt-0.5">수집된 플랫폼과 기간 내 데이터만 분석합니다. 비공개 커뮤니티, SNS DM, 오프라인 여론은 반영되지 않습니다.</p>
                    </div>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-amber-500 shrink-0">!</span>
                    <div>
                      <span className="text-foreground font-medium">수집 한도 영향</span>
                      <p className="mt-0.5">기사 1,000건(일별 균등), 영상 50건 등 기본 수집 한도가 있습니다. 전체 여론의 완벽한 대표성을 보장하지 않습니다.</p>
                    </div>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-amber-500 shrink-0">!</span>
                    <div>
                      <span className="text-foreground font-medium">지지율 추정 면책</span>
                      <p className="mt-0.5">고급 분석의 지지율 추정은 온라인 여론 데이터 기반이며, 실제 여론조사와는 방법론이 다릅니다. 참고 자료로만 활용하세요.</p>
                    </div>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-amber-500 shrink-0">!</span>
                    <div>
                      <span className="text-foreground font-medium">모듈 실패 시</span>
                      <p className="mt-0.5">일부 분석 모듈이 실패한 경우, 리포트 상단에 누락된 모듈이 명시됩니다. 해당 섹션의 분석이 제한적일 수 있습니다.</p>
                    </div>
                  </li>
                </ul>
              </div>

              <Separator />

              <div>
                <p className="font-medium text-foreground text-xs mb-2">1차 vs 최종 리포트</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="rounded-lg border p-2.5">
                    <p className="text-foreground font-medium mb-0.5">1차 리포트 (Stage 1~3 완료 후)</p>
                    <p>기초 분석 + 심층 분석 + 종합 요약 기반. 8개 기본 섹션으로 구성됩니다.</p>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <p className="text-foreground font-medium mb-0.5">최종 리포트 (Stage 4 완료 후)</p>
                    <p>기본 8개 섹션 + 고급 분석 4개 섹션(지지율, 프레임 전쟁, 위기 시나리오, 승리 시뮬레이션)이 추가됩니다. 자동으로 재생성됩니다.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-[10px] text-muted-foreground">
                  분석 모듈이 실패하더라도 가용한 결과로 리포트를 생성합니다. 누락된 부분은 리포트 내에서 명시됩니다.
                </p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
