'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Cpu,
  ExternalLink,
  HardDrive,
  MemoryStick,
  Monitor,
  Network,
  Server,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const PRODUCTS = [
  {
    id: 'asus-gx10',
    name: 'ASUS Ascent GX10 크로스젠',
    subtitle: '128GB, M.2 1TB',
    manufacturer: 'ASUS',
    price: '550만원',
    priceNote: '최저가 기준',
    recommended: true,
    recommendLabel: '가성비 추천',
    description:
      '콤팩트한 미니PC 폼팩터에 NVIDIA DGX 급 AI 성능을 탑재. 소규모 팀의 온프레미스 분석에 최적.',
    danawaUrl:
      'https://prod.danawa.com/info/?pcode=100268615&keyword=%EB%AF%B8%EB%8B%88+%EC%84%9C%EB%B2%84&cate=1137492',
    specs: [
      { icon: Cpu, label: 'CPU', value: 'ARM v9.2-A' },
      { icon: MemoryStick, label: '메모리', value: '128GB LPDDR5X' },
      { icon: HardDrive, label: '스토리지', value: 'M.2 1TB' },
      { icon: Monitor, label: 'GPU', value: 'NVIDIA DGX' },
      { icon: Zap, label: '전력', value: '180W' },
      { icon: Network, label: '네트워크', value: '10Gbps + Wi-Fi 7' },
    ],
    ports: ['HDMI', 'DP Alt Mode', 'USB-C 20Gbps', 'USB-PD'],
    useCase: '키워드 3~5개 동시 분석, 일 10회 이내 분석 운영',
  },
  {
    id: 'dell-gb10',
    name: 'DELL Pro Max GB10',
    subtitle: '128GB, M.2 2TB',
    manufacturer: 'DELL',
    price: '941만원',
    priceNote: '최저가 기준',
    recommended: false,
    recommendLabel: '고성능 추천',
    description:
      'NVIDIA Grace CPU 기반의 고성능 미니 서버. 대용량 분석과 다수 동시 사용자를 위한 엔터프라이즈급 장비.',
    danawaUrl:
      'https://prod.danawa.com/info/?pcode=100843253&keyword=%EB%AF%B8%EB%8B%88+%EC%84%9C%EB%B2%84&cate=1137492',
    specs: [
      { icon: Cpu, label: 'CPU', value: 'NVIDIA Grace' },
      { icon: MemoryStick, label: '메모리', value: '128GB LPDDR5X' },
      { icon: HardDrive, label: '스토리지', value: 'M.2 2TB' },
      { icon: Monitor, label: 'GPU', value: 'NVIDIA' },
      { icon: Zap, label: '전력', value: '280W' },
      { icon: Network, label: '네트워크', value: '10Gbps + Wi-Fi 7' },
    ],
    ports: ['HDMI', 'DP Alt Mode', 'USB-C 20Gbps', 'USB-PD'],
    useCase: '키워드 10개 이상, 대규모 팀, 24시간 상시 운영',
  },
];

const WHY_ON_PREMISE = [
  {
    title: '데이터 보안',
    description: '민감한 여론 데이터가 외부로 나가지 않습니다. 내부망에서 완전 격리 운영.',
    icon: '🔒',
  },
  {
    title: '비용 절감',
    description: '월 구독료 없이 장비 1회 구매로 영구 사용. 1년이면 SaaS 비용 회수.',
    icon: '💰',
  },
  {
    title: '무제한 분석',
    description: '분석 횟수, 데이터 수집량 제한 없이 자유롭게 운영.',
    icon: '♾️',
  },
  {
    title: '커스터마이징',
    description: '고객사 환경에 맞춘 분석 모듈 추가, 내부 시스템 연동 가능.',
    icon: '🔧',
  },
];

const COMPARISON = [
  { feature: '초기 비용', saas: '0원', onPremise: '550~941만원' },
  { feature: '월 운영 비용', saas: '49~249만원/월', onPremise: '전기세만 (약 3~5만원)' },
  { feature: '1년 총비용', saas: '588~2,988만원', onPremise: '550~941만원' },
  { feature: '2년 총비용', saas: '1,176~5,976만원', onPremise: '550~941만원' },
  { feature: '분석 횟수', saas: '플랜별 제한', onPremise: '무제한' },
  { feature: '데이터 위치', saas: '클라우드', onPremise: '사내 서버' },
  { feature: '커스터마이징', saas: '제한적', onPremise: '완전 자유' },
];

export default function HardwarePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="text-lg font-bold">AI SignalCraft</span>
          </Link>
          <Link
            href="/landing"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            홈으로
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <Badge variant="outline" className="mb-4 gap-1.5">
            <Server className="size-3.5" />
            온프레미스 솔루션
          </Badge>
          <h1 className="mb-4 text-3xl font-bold md:text-5xl">
            사내 서버로 운영하는
            <br />
            AI 여론 분석 시스템
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            데이터를 외부에 보내지 않고, 자체 장비에서 AI SignalCraft를 운영하세요.
            <br />
            미니 서버 하나면 충분합니다.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/partner/apply" className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}>
              도입 문의
              <ArrowRight className="size-4" />
            </Link>
            <a href="#products" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
              장비 스펙 보기
            </a>
          </div>
        </div>
      </section>

      {/* 왜 온프레미스인가 */}
      <section className="border-t bg-muted/20 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold md:text-3xl">왜 온프레미스인가?</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_ON_PREMISE.map((item) => (
              <Card key={item.title}>
                <CardContent className="pt-6">
                  <div className="mb-3 text-3xl">{item.icon}</div>
                  <h3 className="mb-2 font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 제품 소개 */}
      <section id="products" className="border-t py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-4 text-center text-2xl font-bold md:text-3xl">추천 하드웨어</h2>
          <p className="mb-12 text-center text-muted-foreground">
            AI SignalCraft 온프레미스 운영에 검증된 미니 서버
          </p>

          <div className="grid gap-8 lg:grid-cols-2">
            {PRODUCTS.map((product) => (
              <Card
                key={product.id}
                className={cn(
                  'relative flex flex-col',
                  product.recommended && 'border-primary/30 ring-1 ring-primary/20',
                )}
              >
                {product.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      {product.recommendLabel}
                    </Badge>
                  </div>
                )}
                {!product.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="secondary">{product.recommendLabel}</Badge>
                  </div>
                )}

                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardDescription>{product.manufacturer}</CardDescription>
                      <CardTitle className="text-xl">{product.name}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{product.subtitle}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{product.price}</div>
                      <div className="text-xs text-muted-foreground">{product.priceNote}</div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col">
                  <p className="mb-4 text-sm text-muted-foreground">{product.description}</p>

                  {/* 스펙 그리드 */}
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    {product.specs.map((spec) => (
                      <div key={spec.label} className="flex items-center gap-2">
                        <spec.icon className="size-4 shrink-0 text-muted-foreground" />
                        <div>
                          <div className="text-xs text-muted-foreground">{spec.label}</div>
                          <div className="text-sm font-medium">{spec.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 포트 */}
                  <div className="mb-4">
                    <div className="mb-1.5 text-xs text-muted-foreground">포트</div>
                    <div className="flex flex-wrap gap-1.5">
                      {product.ports.map((port) => (
                        <Badge key={port} variant="secondary" className="text-xs">
                          {port}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* 활용 시나리오 */}
                  <div className="mb-4 rounded-lg bg-muted/50 p-3">
                    <div className="text-xs font-medium text-muted-foreground">추천 활용</div>
                    <div className="mt-1 text-sm">{product.useCase}</div>
                  </div>

                  {/* 다나와 링크 */}
                  <a
                    href={product.danawaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'mt-auto gap-1.5',
                    )}
                  >
                    다나와에서 상세 보기
                    <ExternalLink className="size-3.5" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SaaS vs 온프레미스 비교 */}
      <section className="border-t bg-muted/20 py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="mb-4 text-center text-2xl font-bold md:text-3xl">SaaS vs 온프레미스</h2>
          <p className="mb-8 text-center text-muted-foreground">
            Professional 플랜(129만원/월) 기준 비교
          </p>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-4 text-left font-medium">항목</th>
                      <th className="p-4 text-center font-medium">SaaS (클라우드)</th>
                      <th className="p-4 text-center font-medium text-primary">
                        온프레미스 (자체 서버)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row) => (
                      <tr key={row.feature} className="border-b last:border-0">
                        <td className="p-4 font-medium">{row.feature}</td>
                        <td className="p-4 text-center text-muted-foreground">{row.saas}</td>
                        <td className="p-4 text-center font-medium">{row.onPremise}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            * 온프레미스는 장비 구매비 외 AI API 비용(분석당 약 500~2,000원)이 별도로 발생합니다
          </p>
        </div>
      </section>

      {/* 도입 프로세스 */}
      <section className="border-t py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold md:text-3xl">도입 프로세스</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: '1', title: '상담', desc: '요구사항 분석 및 장비 선정' },
              { step: '2', title: '구매', desc: '장비 구매 및 환경 설정' },
              { step: '3', title: '설치', desc: 'AI SignalCraft 설치 및 테스트' },
              { step: '4', title: '운영', desc: '교육 및 기술 지원 시작' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="mb-1 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/20 py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">
            온프레미스 도입을 검토하고 계신가요?
          </h2>
          <p className="mb-8 text-muted-foreground">
            파트너를 통해 장비 구매부터 설치, 운영까지 원스톱으로 지원합니다.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/partner/apply" className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}>
              도입 문의하기
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="mailto:krdn.net@gmail.com"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
            >
              이메일 상담
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
