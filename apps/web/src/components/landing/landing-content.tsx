'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  Globe,
  ExternalLink,
  HelpCircle,
  Handshake,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ACTIVE_SOURCES, UPCOMING_SOURCE_GROUPS } from './data/sources';
import { MODULES } from './data/modules';
import { PRICING, COMPARISONS } from './data/pricing';
import { USE_CASE_CATEGORIES, USE_CASE_DETAILS } from './data/use-cases';
import { UseCaseDetailModal } from './use-case-detail-modal';
import { ShowcaseSection } from './showcase-section';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { buttonVariants } from '@/components/ui/button';

export function LandingContent() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);
  const selectedDetail = selectedUseCase ? (USE_CASE_DETAILS[selectedUseCase] ?? null) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="text-lg font-bold">AI SignalCraft</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#showcase" className="hover:text-foreground">
              샘플 분석
            </a>
            <a href="#features" className="hover:text-foreground">
              기능
            </a>
            <a href="#use-cases" className="hover:text-foreground">
              활용 사례
            </a>
            <a href="#pricing" className="hover:text-foreground">
              가격
            </a>
            <Link href="/programs" className="hover:text-foreground">
              파트너
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Link href="/dashboard" className={cn(buttonVariants({ size: 'sm' }))}>
                대시보드
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                >
                  로그인
                </Link>
                <Link href="/demo" className={cn(buttonVariants({ size: 'sm' }))}>
                  무료 체험
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-32 md:pb-36">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <Badge variant="secondary" className="mb-6">
            <Zap className="mr-1 size-3" />
            14개 AI 분석 모듈로 여론을 전략으로
          </Badge>
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
            여론 수집에서 멈추지 마세요.
            <br />
            <span className="text-primary">전략까지 자동으로.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
            한국 온라인 여론을 6개 소스에서 자동 수집하고, AI가 리스크·기회·전략을 분석하여 실행
            가능한 리포트를 생성합니다.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/demo" className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}>
              7일 무료 체험 시작
              <ArrowRight className="size-4" />
            </Link>
            <a href="#features" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
              기능 살펴보기
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            카드 등록 없이 시작 · 설치 불필요 · 5분 안에 첫 분석
          </p>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-t border-b bg-muted/30 py-8">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">6개</div>
              <div className="text-sm text-muted-foreground">데이터 소스</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">14개</div>
              <div className="text-sm text-muted-foreground">AI 분석 모듈</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">1~3시간</div>
              <div className="text-sm text-muted-foreground">분석 완료</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">90%+</div>
              <div className="text-sm text-muted-foreground">시간 절감</div>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase */}
      <ShowcaseSection />

      {/* Problem → Solution */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              기존 도구는 &quot;무슨 말이 있다&quot;에서 멈춥니다
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              AI SignalCraft는 &quot;그래서 어떻게 할 것인가&quot;까지 제시합니다.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-red-200/50 dark:border-red-900/30">
              <CardHeader>
                <CardTitle className="text-red-600">기존 방식의 한계</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>✕ 수동 클리핑에 주 10~20시간</p>
                <p>✕ 단순 감정 분석 (긍정/부정 비율)</p>
                <p>✕ &quot;그래서 뭘 해야 하는데?&quot; 답변 못함</p>
                <p>✕ 리포트 작성에 추가 2~3일</p>
              </CardContent>
            </Card>
            <Card className="md:scale-105 ring-2 ring-primary/20">
              <CardHeader>
                <Badge className="mb-2 w-fit">AI SignalCraft</Badge>
                <CardTitle className="text-primary">전략 도구</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>✓ 5개 소스 자동 수집 (클릭 한 번)</p>
                <p>✓ 14개 모듈 심층 분석</p>
                <p>
                  <strong>✓ 전략·리스크·시나리오까지 제시</strong>
                </p>
                <p>✓ 종합 리포트 자동 생성 (PDF)</p>
              </CardContent>
            </Card>
            <Card className="border-muted">
              <CardHeader>
                <CardTitle className="text-muted-foreground">기존 소셜 리스닝</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>△ 자동 수집은 되지만</p>
                <p>△ 감정 분석까지만</p>
                <p>✕ 전략 도출 없음</p>
                <p>✕ 한국 커뮤니티 미지원</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section id="features" className="border-t bg-muted/20 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16">
            <div className="mb-8 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">데이터 소스</h2>
              <p className="text-muted-foreground">
                클릭 한 번으로 뉴스, 댓글, 영상, 커뮤니티를 동시에 수집합니다.
              </p>
            </div>
            <div className="mb-6 flex items-center gap-3">
              <Badge className="shrink-0 bg-primary">수집 중</Badge>
              <span className="text-sm font-medium">현재 지원하는 6개 소스</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
              {ACTIVE_SOURCES.map((source) => (
                <Popover key={source.name}>
                  <PopoverTrigger className="w-full text-left cursor-pointer">
                    <Card className="text-center ring-1 ring-primary/20 transition-colors hover:bg-primary/5">
                      <CardContent className="flex flex-col items-center gap-2 pt-2">
                        <source.icon className="size-8 text-primary" />
                        <span className="text-sm font-medium">{source.name}</span>
                      </CardContent>
                    </Card>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" sideOffset={8} className="w-80 p-0">
                    <div className="p-3 pb-2 border-b">
                      <div className="flex items-center gap-2">
                        <source.icon className="size-4 text-primary shrink-0" />
                        <h4 className="font-semibold text-sm">{source.name}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        {source.help}
                      </p>
                    </div>
                    <div className="p-3 pt-2 space-y-2.5">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground mb-1">
                          수집 항목
                        </p>
                        <ul className="space-y-0.5">
                          {source.collects.map((item) => (
                            <li key={item} className="text-xs text-muted-foreground flex gap-1.5">
                              <span className="shrink-0 mt-0.5 text-primary/60">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                            수집 방법
                          </p>
                          <p className="text-muted-foreground">{source.method}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                            수집 한도
                          </p>
                          <p className="text-muted-foreground">{source.limit}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                          분석 활용
                        </p>
                        <p className="text-xs text-muted-foreground">{source.strength}</p>
                      </div>
                      <div className="pt-1.5 border-t">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {source.url.replace('https://', '')}
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-6 flex items-center gap-3">
              <Badge variant="outline" className="shrink-0">
                추가 예정
              </Badge>
              <span className="text-sm text-muted-foreground">확장 예정 소스</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {UPCOMING_SOURCE_GROUPS.map((group) => (
                <div
                  key={group.label}
                  className="rounded-lg border border-dashed border-border/60 p-4"
                >
                  <h4 className="mb-3 text-sm font-medium text-muted-foreground">{group.label}</h4>
                  <div className="flex flex-wrap gap-2">
                    {group.sources.map((source) => (
                      <Popover key={source.name}>
                        <PopoverTrigger className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground cursor-pointer">
                          <source.icon className="size-3.5" />
                          <span>{source.name}</span>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" sideOffset={8} className="w-72 p-0">
                          <div className="p-3 pb-2 border-b">
                            <div className="flex items-center gap-2">
                              <source.icon className="size-3.5 text-muted-foreground shrink-0" />
                              <h4 className="font-semibold text-sm">{source.name}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                              {source.help}
                            </p>
                          </div>
                          <div className="p-3 pt-2 space-y-2">
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                                활용 목표
                              </p>
                              <p className="text-xs text-muted-foreground">{source.goal}</p>
                            </div>
                            <div className="pt-1.5 border-t">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                {source.url.replace('https://', '').replace('https://www.', '')}
                                <ExternalLink className="size-3" />
                              </a>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 14 Analysis Modules */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">14개 AI 분석 모듈</h2>
            <p className="text-muted-foreground">
              단순 감정 분석을 넘어, 전략적 인사이트를 단계별로 도출합니다.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {MODULES.map((group) => (
              <Card key={group.stage}>
                <CardHeader>
                  <Badge variant="outline" className={group.color}>
                    {group.stage}
                  </Badge>
                  <CardTitle>{group.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {group.items.map((item) => (
                      <li key={item.name} className="flex items-center gap-2 text-sm">
                        <Brain className="size-4 shrink-0 text-primary" />
                        <span className="flex-1">{item.name}</span>
                        <Popover>
                          <PopoverTrigger
                            className="text-muted-foreground/50 hover:text-primary transition-colors cursor-help shrink-0"
                            aria-label={`${item.name} 도움말`}
                          >
                            <HelpCircle className="size-4" />
                          </PopoverTrigger>
                          <PopoverContent side="top" sideOffset={8} className="w-80 p-0">
                            <div className="p-3 pb-2 border-b">
                              <h4 className="font-semibold text-sm">{item.name}</h4>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                {item.help}
                              </p>
                            </div>
                            <div className="p-3 pt-2 space-y-2">
                              <div>
                                <p className="text-[11px] font-medium text-muted-foreground mb-1">
                                  분석 내용
                                </p>
                                <ul className="space-y-1">
                                  {item.details.map((detail) => (
                                    <li
                                      key={detail}
                                      className="text-xs text-muted-foreground flex gap-1.5"
                                    >
                                      <span className="shrink-0 mt-0.5 text-primary/60">•</span>
                                      <span>{detail}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="pt-1.5 border-t">
                                <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                                  출력 결과
                                </p>
                                <p className="text-xs text-muted-foreground">{item.output}</p>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline Flow */}
      <section className="border-t bg-muted/20 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">클릭 한 번, 전략 리포트까지</h2>
            <p className="text-muted-foreground">
              각 단계를 클릭하면 상세 워크플로우를 확인할 수 있습니다.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
            {(
              [
                {
                  icon: Globe,
                  step: '1',
                  title: '키워드 입력',
                  desc: '분석 대상과 기간 설정',
                  help: '분석하려는 인물, 정책, 이슈 등의 키워드와 수집 기간을 지정합니다.',
                  details: [
                    '분석 키워드 입력 (인물명, 정책명, 이슈 등)',
                    '수집 기간 설정 (최근 1일~30일)',
                    '분석 소스 선택 (전체 또는 개별 소스)',
                    '분석 모듈 선택 (기본 8개 또는 전체 14개)',
                  ],
                  example: '예) "의료 개혁" 키워드 → 최근 7일 → 전체 소스 → 기본 분석',
                },
                {
                  icon: Zap,
                  step: '2',
                  title: '자동 수집',
                  desc: '6개 소스 병렬 크롤링',
                  help: '키워드와 기간에 맞춰 6개 소스에서 관련 데이터를 동시에 크롤링합니다.',
                  details: [
                    '6개 소스에 병렬로 크롤링 요청 발송',
                    '뉴스 기사, 댓글, 커뮤니티 게시글, 영상 자막 수집',
                    '수집 데이터 정규화 (중복 제거, 포맷 통일)',
                    '소스별 수집 현황 실시간 모니터링',
                  ],
                  example: '평균 수집량: 키워드당 300~1,000건 / 소요 시간: 3~10분',
                },
                {
                  icon: Brain,
                  step: '3',
                  title: 'AI 분석',
                  desc: '14개 모듈 단계별 실행',
                  help: '수집된 데이터를 4단계에 걸쳐 14개 AI 모듈이 순차·병렬로 분석합니다.',
                  details: [
                    'Stage 1: 거시 여론·세분화·감정·메시지 영향력 (병렬)',
                    'Stage 2: 리스크맵 → 기회 → 전략 → 종합 요약 (순차)',
                    'Stage 3: 종합 리포트 자동 생성',
                    'Stage 4: 지지율·프레임전쟁·위기시나리오·승리시뮬레이션 (고급)',
                  ],
                  example: 'Claude, GPT, Gemini 등 최적 AI 모델을 모듈별로 자동 배정',
                },
                {
                  icon: BarChart3,
                  step: '4',
                  title: '전략 리포트',
                  desc: '실행 가능한 인사이트',
                  help: '분석 결과를 종합하여 즉시 활용 가능한 전략 리포트를 자동 생성합니다. 단순 데이터 나열이 아닌, 의사결정에 필요한 핵심 인사이트와 구체적 실행 방안을 포함합니다.',
                  details: [
                    '핵심 여론 흐름 요약 — 주요 이슈별 감정 분포와 변화 추이',
                    '리스크 지도 — 잠재적 위험 요인과 심각도·확산 가능성 평가',
                    '기회 분석 — 긍정 여론 확대 또는 반전 가능한 포인트',
                    '맞춤형 전략 제안 — 타겟 그룹별 메시지 전략과 채널 전략',
                    '위기 시나리오 — 최악·기본·최선 시나리오별 대응 방안',
                    '지지율 추정 및 트렌드 — 여론 데이터 기반 지지율 추이',
                  ],
                  example: '리포트 형태: 웹 대시보드 + PDF 다운로드 / 팀 공유 링크 지원',
                },
              ] as const
            ).map((item) => (
              <Popover key={item.step}>
                <PopoverTrigger className="flex flex-col items-center text-center cursor-pointer group">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <item.icon className="size-6 text-primary" />
                  </div>
                  <Badge variant="outline" className="mb-2">
                    Step {item.step}
                  </Badge>
                  <h3 className="mb-1 font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                  <span className="mt-1.5 text-xs text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                    클릭하여 자세히 보기
                  </span>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  sideOffset={8}
                  className={cn('p-0', item.step === '4' ? 'w-96' : 'w-80')}
                >
                  <div className="p-3 pb-2 border-b">
                    <div className="flex items-center gap-2">
                      <item.icon className="size-4 text-primary shrink-0" />
                      <h4 className="font-semibold text-sm">
                        Step {item.step}. {item.title}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {item.help}
                    </p>
                  </div>
                  <div className="p-3 pt-2 space-y-2.5">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">
                        {item.step === '4' ? '리포트 포함 내용' : '상세 워크플로우'}
                      </p>
                      <ul className="space-y-1">
                        {item.details.map((detail) => (
                          <li key={detail} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="shrink-0 mt-0.5 text-primary/60">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-1.5 border-t">
                      <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                        {item.step === '4' ? '출력 형태' : '참고'}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.example}</p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">누가 사용하나요?</h2>
            <p className="text-muted-foreground">
              여론 분석이 필요한 모든 조직에서 활용할 수 있습니다.
            </p>
          </div>
          <div className="space-y-12">
            {USE_CASE_CATEGORIES.map((category) => (
              <div key={category.label}>
                <div className="mb-6 flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{category.label}</h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {category.cases.map((uc) => (
                    <Card
                      key={uc.title}
                      className="group cursor-pointer transition-all hover:border-primary/30 hover:shadow-md"
                      onClick={() => setSelectedUseCase(uc.title)}
                    >
                      <CardHeader>
                        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                          <uc.icon className="size-5 text-primary" />
                        </div>
                        <CardTitle className="text-base">{uc.title}</CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
                          {uc.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="mr-1 size-3" />
                            {uc.highlight}
                          </Badge>
                          <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                            자세히 보기 →
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t bg-muted/20 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">투명한 가격</h2>
            <p className="text-muted-foreground">
              7일 무료 체험 · 카드 등록 불필요 · 연간 결제 시 2개월 무료
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PRICING.map((plan) => (
              <Card
                key={plan.name}
                className={plan.popular ? 'ring-2 ring-primary md:scale-105' : ''}
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.popular && <Badge>추천</Badge>}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.unit}</span>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="size-4 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.cta === '상담 신청' ? 'mailto:krdn.net@gmail.com' : '/demo'}
                    className={cn(
                      buttonVariants({
                        variant: plan.popular ? 'default' : 'outline',
                        size: 'lg',
                      }),
                      'w-full',
                    )}
                  >
                    {plan.cta}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Cost comparison */}
          <div className="mx-auto mt-16 max-w-2xl">
            <h3 className="mb-6 text-center text-xl font-semibold">비용 비교</h3>
            <div className="space-y-3">
              {COMPARISONS.map((c) => (
                <div
                  key={c.label}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-4',
                    'highlight' in c &&
                      c.highlight &&
                      'border-primary/30 bg-primary/5 ring-1 ring-primary/20',
                  )}
                >
                  <div>
                    <div className="font-medium">{c.label}</div>
                    <div className="text-sm text-muted-foreground">{c.scope}</div>
                  </div>
                  <div
                    className={cn(
                      'text-lg font-bold',
                      'highlight' in c && c.highlight && 'text-primary',
                    )}
                  >
                    {c.cost}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Partner Program Banner */}
      <section className="border-t bg-muted/20 py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <Badge variant="outline" className="mb-4 gap-1.5">
            <Handshake className="size-3.5" />
            파트너 프로그램
          </Badge>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            함께 성장하는 비즈니스 파트너를 찾습니다
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            초기 비용 0원, 최대 50% 수수료. AI SignalCraft를 영업하고 성과에 따른 수수료를 받으세요.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/programs" className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}>
              <Handshake className="size-4" />
              파트너 프로그램 자세히 보기
            </Link>
            <Link
              href="/partner/apply"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-1.5')}
            >
              파트너 신청하기
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            여론 분석, 전략으로 바꿀 준비가 되셨나요?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            7일 무료 체험으로 시작하세요. 카드 등록 없이, 5분 안에 첫 분석을 실행할 수 있습니다.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/demo" className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}>
              무료 체험 시작
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/partner/apply"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-1.5')}
            >
              <Handshake className="size-4" />
              파트너 신청
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-muted-foreground md:flex-row md:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="font-medium text-foreground">AI SignalCraft</span>
          </div>
          <p>&copy; 2026 AI SignalCraft. All rights reserved.</p>
        </div>
      </footer>

      {/* Use Case Detail Modal */}
      <UseCaseDetailModal
        detail={selectedDetail}
        open={!!selectedUseCase}
        onOpenChange={(open) => {
          if (!open) setSelectedUseCase(null);
        }}
      />
    </div>
  );
}
