'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowRight,
  BarChart3,
  Brain,
  Clock,
  Globe,
  LineChart,
  MessageSquareWarning,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const SOURCES = [
  { name: '네이버 뉴스', icon: Globe },
  { name: '네이버 댓글', icon: MessageSquareWarning },
  { name: '유튜브', icon: BarChart3 },
  { name: 'DC갤러리', icon: Users },
  { name: 'FM코리아', icon: TrendingUp },
];

const MODULES = [
  {
    stage: 'Stage 1',
    label: '초기 분석',
    color: 'bg-blue-500/10 text-blue-600',
    items: ['거시 여론 구조', '집단별 반응', '감정/프레임 분석', '메시지 파급력'],
  },
  {
    stage: 'Stage 2',
    label: '심화 분석',
    color: 'bg-purple-500/10 text-purple-600',
    items: ['리스크 지도', '기회 분석', '전략 도출', '최종 요약'],
  },
  {
    stage: 'Stage 4',
    label: '고급 분석',
    color: 'bg-amber-500/10 text-amber-600',
    items: ['지지율 추정', '프레임 전쟁', '위기 시나리오', '승리 시뮬레이션'],
  },
];

const USE_CASES = [
  {
    icon: Target,
    title: '정치 캠프',
    description:
      '실시간 여론 추적, 지지율 추정, 프레임 전쟁 분석으로 선거 전략을 데이터 기반으로 수립합니다.',
    highlight: '의사결정 시간 수일 → 수시간',
  },
  {
    icon: Shield,
    title: 'PR / 위기관리',
    description:
      '위기 시나리오 3개와 대응 전략을 자동 생성합니다. 골든타임 안에 전략적 판단이 가능합니다.',
    highlight: '수동 클리핑 주 20시간 → 0',
  },
  {
    icon: LineChart,
    title: '기업 평판 관리',
    description: '네이버·유튜브·커뮤니티 전체를 통합 분석하여 경영진 보고서를 자동 생성합니다.',
    highlight: '보고서 작성 3일 → 자동 생성',
  },
  {
    icon: Sparkles,
    title: '연예인 / 기획사',
    description:
      '아티스트·배우의 온라인 반응을 실시간 추적하고, 팬덤 동향과 리스크를 분석하여 매니지먼트 전략을 지원합니다.',
    highlight: '팬덤 여론 분석 자동화',
  },
];

const PRICING = [
  {
    name: 'Starter',
    price: '49',
    unit: '만원/월',
    description: '소규모 팀과 컨설턴트',
    features: [
      '분석 대상 1개',
      '3개 소스 수집',
      '기본 8개 모듈 (Stage 1+2)',
      '월 4회 분석',
      '팀원 3명',
    ],
    cta: '14일 무료 체험',
    popular: false,
  },
  {
    name: 'Professional',
    price: '129',
    unit: '만원/월',
    description: 'PR 에이전시와 기업 홍보팀',
    features: [
      '분석 대상 3개',
      '전체 5개 소스 수집',
      '14개 전체 모듈',
      '월 12회 분석',
      '팀원 10명',
      'PDF 리포트 내보내기',
    ],
    cta: '14일 무료 체험',
    popular: true,
  },
  {
    name: 'Campaign',
    price: '249',
    unit: '만원/월',
    description: '정치 캠프와 대규모 조직',
    features: [
      '분석 대상 5개',
      '무제한 분석',
      '14개 전체 모듈',
      'API 접근',
      '전담 CSM',
      '맞춤 분석 모듈',
    ],
    cta: '상담 신청',
    popular: false,
  },
];

const COMPARISONS = [
  { label: '모니터링 주니어 인건비', cost: '250~350만원/월', scope: '수집만' },
  { label: '소셜 리스닝 도구', cost: '50~300만원/월', scope: '수집 + 감정 분석' },
  {
    label: 'AI SignalCraft',
    cost: '129만원/월',
    scope: '수집 + 분석 + 전략',
    highlight: true as const,
  },
];

export function LandingContent() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

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
            <a href="#features" className="hover:text-foreground">
              기능
            </a>
            <a href="#use-cases" className="hover:text-foreground">
              활용 사례
            </a>
            <a href="#pricing" className="hover:text-foreground">
              가격
            </a>
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
                <a href="#pricing" className={cn(buttonVariants({ size: 'sm' }))}>
                  무료 체험
                </a>
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
            한국 온라인 여론을 5개 소스에서 자동 수집하고, AI가 리스크·기회·전략을 분석하여 실행
            가능한 리포트를 생성합니다.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#pricing" className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}>
              14일 무료 체험 시작
              <ArrowRight className="size-4" />
            </a>
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
              <div className="text-2xl font-bold text-primary">5개</div>
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
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              한국 온라인 여론의 핵심 5개 소스
            </h2>
            <p className="text-muted-foreground">
              클릭 한 번으로 뉴스, 댓글, 영상, 커뮤니티를 동시에 수집합니다.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 md:grid-cols-5">
            {SOURCES.map((source) => (
              <Card key={source.name} className="text-center">
                <CardContent className="flex flex-col items-center gap-2 pt-2">
                  <source.icon className="size-8 text-primary" />
                  <span className="text-sm font-medium">{source.name}</span>
                </CardContent>
              </Card>
            ))}
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
                      <li key={item} className="flex items-center gap-2 text-sm">
                        <Brain className="size-4 text-primary" />
                        {item}
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
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
            {[
              {
                icon: Globe,
                step: '1',
                title: '키워드 입력',
                desc: '분석 대상과 기간 설정',
              },
              {
                icon: Zap,
                step: '2',
                title: '자동 수집',
                desc: '5개 소스 병렬 크롤링',
              },
              {
                icon: Brain,
                step: '3',
                title: 'AI 분석',
                desc: '14개 모듈 단계별 실행',
              },
              {
                icon: BarChart3,
                step: '4',
                title: '전략 리포트',
                desc: '실행 가능한 인사이트',
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <item.icon className="size-6 text-primary" />
                </div>
                <Badge variant="outline" className="mb-2">
                  Step {item.step}
                </Badge>
                <h3 className="mb-1 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">누가 사용하나요?</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((uc) => (
              <Card key={uc.title}>
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <uc.icon className="size-5 text-primary" />
                  </div>
                  <CardTitle>{uc.title}</CardTitle>
                  <CardDescription>{uc.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="mr-1 size-3" />
                    {uc.highlight}
                  </Badge>
                </CardContent>
              </Card>
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
              14일 무료 체험 · 카드 등록 불필요 · 연간 결제 시 2개월 무료
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
                    href={plan.cta === '상담 신청' ? 'mailto:krdn.net@gmail.com' : '/login'}
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

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            여론 분석, 전략으로 바꿀 준비가 되셨나요?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            14일 무료 체험으로 시작하세요. 카드 등록 없이, 5분 안에 첫 분석을 실행할 수 있습니다.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#pricing" className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}>
              무료 체험 시작
              <ArrowRight className="size-4" />
            </a>
            <a
              href="mailto:krdn.net@gmail.com"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
            >
              영업팀 상담
            </a>
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
    </div>
  );
}
