'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Handshake,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  PARTNER_PROGRAMS,
  PARTNER_BENEFITS,
  PARTNER_PROCESS,
} from '@/components/landing/data/partner-program';

// 제품 소개글 (파트너 → 고객 대상)
const PRODUCT_COPY = {
  short: {
    label: '숏폼형',
    length: '50~100자',
    purpose: '시선 강탈',
    usage: 'SNS 광고, 인스타그램 피드, 제안서 헤드라인, 짧은 문자·카톡 소개',
    description:
      '3초 안에 고객의 시선을 붙잡고 "더 알아보기"를 유도합니다. 가장 강력한 혜택 하나에 집중합니다.',
    copies: [
      {
        title: '시간 절감 강조형',
        text: '여론 수집에 주 20시간? AI SignalCraft는 클릭 한 번이면 끝. 6개 소스 자동 수집 + 14개 AI 분석 = 전략 리포트 자동 생성.',
      },
      {
        title: '차별화 강조형',
        text: '"무슨 말이 있다"에서 멈추는 도구 말고, "그래서 뭘 해야 하는지"까지 알려주는 AI 여론분석. 7일 무료 체험.',
      },
      {
        title: '핵심 기능 요약형',
        text: '뉴스·댓글·영상·커뮤니티 자동 수집 → AI가 리스크·기회·전략 분석 → 실행 가능한 리포트. 설치 없이 5분 안에 시작.',
      },
    ],
  },
  middle: {
    label: '미들형',
    length: '300~500자',
    purpose: '신뢰와 공감',
    usage: '블로그 포스팅, 뉴스레터, 제안서 본문, 이메일 소개',
    description:
      '고객이 겪는 문제점을 공감하고, AI SignalCraft가 어떻게 해결하는지 특장점을 나열합니다.',
    copies: [
      {
        title: '문제-해결 구조형',
        text: `여론 분석, 이렇게 하고 계신가요?

수동으로 뉴스 클리핑하고, 댓글을 하나하나 읽고, 엑셀에 정리하고... 주 10~20시간을 쏟아도 결론은 "긍정 45%, 부정 55%". 보고서를 받은 팀장은 묻습니다 — "그래서 우리가 뭘 해야 하는데?"

AI SignalCraft는 이 전 과정을 자동화합니다.

• 네이버 뉴스, YouTube, 커뮤니티 등 6개 소스 자동 수집
• 14개 AI 분석 모듈이 감정 분석을 넘어 리스크·기회·전략까지 도출
• 클릭 한 번으로 실행 가능한 전략 리포트 자동 생성
• 분석 1건당 1~3시간, 기존 대비 90% 이상 시간 절감

카드 등록 없이 7일 무료 체험. 5분 안에 첫 분석을 실행할 수 있습니다.`,
      },
      {
        title: '대상별 활용 강조형',
        text: `정치 캠프에서 기업 홍보팀까지, 여론 데이터를 전략으로 바꾸는 조직이 늘고 있습니다.

AI SignalCraft는 한국 온라인 여론에 특화된 AI 분석 플랫폼입니다.

• 정치/선거 — 후보 지지율 동향, 공약 반응, 위기 시나리오 시뮬레이션
• 기업 PR — 브랜드 이슈 모니터링, 리스크 맵핑, 대응 전략 도출
• 미디어/리서치 — 여론 프레임 분석, 세대·지역별 여론 세분화
• 공공기관 — 정책 반응 분석, 국민 소통 전략 수립

6개 소스에서 자동 수집하고, 14개 AI 모듈이 단계별로 분석하여 실행 가능한 전략 리포트를 생성합니다. 데이터 보안이 중요하다면 온프레미스(자체 서버) 설치도 가능합니다.`,
      },
    ],
  },
  long: {
    label: '롱폼형',
    length: '1,000자 이상',
    purpose: '설득과 구매',
    usage: '공식 제안서, 보도자료, 도입 검토 자료, 홈페이지 상세 소개',
    description:
      '제품의 기술적 디테일, 분석 프로세스, 활용 사례를 상세히 전달하여 도입을 설득합니다.',
    copies: [
      {
        title: '제품 상세 소개형',
        text: `■ AI SignalCraft — 여론 수집에서 전략까지, 원스톱 AI 분석 플랫폼

기존 여론 분석의 한계는 명확합니다. 수동 클리핑에 주 10~20시간을 소비하고, 얻는 결과는 단순한 감정 비율(긍정/부정)뿐입니다. 기존 소셜 리스닝 도구를 쓰더라도 자동 수집까지는 되지만, "어떤 말이 있다" 수준에서 멈춥니다. 가장 중요한 질문 — "그래서 우리가 뭘 해야 하는가?" — 에는 답하지 못합니다.

AI SignalCraft는 바로 이 문제를 해결합니다.

■ 자동 수집 (6개 소스)
네이버 뉴스, YouTube, 네이버 카페, 디시인사이드, 더쿠, FM코리아 등 한국 온라인 여론의 핵심 소스를 자동으로 수집합니다. 키워드와 기간을 설정하면 클릭 한 번으로 병렬 크롤링이 시작됩니다. 수동 클리핑에 소비하던 시간을 완전히 제거합니다.

■ AI 분석 (14개 모듈, 4단계)
단순 감정 분석을 넘어, 전략적 인사이트를 단계별로 도출합니다.

• Stage 1 (기초 분석) — 거시 여론 흐름, 여론 세분화, 감정 프레이밍, 메시지 영향력 측정
• Stage 2 (전략 분석) — 리스크 맵핑, 기회 포착, 전략 도출, 종합 요약
• Stage 3 (리포트) — 실행 가능한 전략 리포트 자동 생성 (PDF 다운로드)
• Stage 4 (고급 분석) — 지지율 추정, 프레임 전쟁 분석, 위기 시나리오 시뮬레이션, 승리 시뮬레이션

각 모듈은 Claude, GPT, Gemini 등 최신 AI 모델을 활용하며, 이전 단계의 분석 결과를 참조하여 점진적으로 깊은 인사이트를 도출합니다.

■ 누가 사용하나요?

• 정치 캠프 / 선거 컨설팅 — 후보 지지율 동향 분석, 공약 반응 모니터링, 위기 시나리오 사전 대비, 상대 캠프 전략 분석
• 기업 홍보팀 / PR 에이전시 — 브랜드 이슈 실시간 감지, 경쟁사 비교 분석, 위기 대응 전략 도출, 캠페인 효과 측정
• 미디어 / 리서치 기관 — 여론 프레임 심층 분석, 세대·지역·플랫폼별 여론 세분화, 트렌드 예측
• 공공기관 — 정책 반응 분석, 국민 소통 전략 수립, 공공 이슈 모니터링

■ 도입 방식

• SaaS (클라우드) — 설치 불필요, 웹 브라우저에서 바로 사용. 월 49만원부터. 7일 무료 체험 제공.
• 온프레미스 (자체 서버) — 데이터 보안이 중요한 조직을 위한 자체 서버 설치. 미니 서버 1대면 충분. 파트너가 장비 구매부터 설치, 운영까지 원스톱 지원.

■ 핵심 수치

• 6개 데이터 소스 자동 수집
• 14개 AI 분석 모듈 (4단계 심층 분석)
• 분석 완료 1~3시간 (기존 대비 90%+ 시간 절감)
• 카드 등록 없이 7일 무료 체험

여론을 읽는 것에서 멈추지 마세요. AI SignalCraft로 전략까지 자동으로.`,
      },
    ],
  },
};

// 파트너 모집 소개글 (파트너 대상)
const MARKETING_COPY = {
  short: {
    label: '숏폼형',
    length: '50~100자',
    purpose: '시선 강탈',
    usage: '인스타그램 피드, 광고 카피, 제품 상세페이지 헤드라인',
    description:
      '3초 안에 고객의 시선을 붙잡고 "더 알아보기"를 유도합니다. 가장 강력한 혜택 하나에 집중합니다.',
    copies: [
      {
        title: '수수료 강조형',
        text: 'AI 여론분석 솔루션, 소개만 해도 매출의 최대 50% 수수료. 초기 비용 0원, 지금 파트너 신청하세요.',
      },
      {
        title: '진입장벽 해소형',
        text: '가입비 0원, 보증금 0원. AI SignalCraft 파트너가 되면 매달 수수료가 들어옵니다.',
      },
      {
        title: '성과 중심형',
        text: '고객 한 명 소개하면, 1년 매출의 최대 20%가 내 수입. AI 시대의 새로운 영업 파이프라인.',
      },
    ],
  },
  middle: {
    label: '미들형',
    length: '300~500자',
    purpose: '신뢰와 공감',
    usage: '블로그, 뉴스레터, 제품 상세페이지 중간 설명부',
    description:
      '고객이 겪는 문제점을 공감하고, 우리 제품이 어떻게 해결하는지 특장점을 나열합니다.',
    copies: [
      {
        title: '문제 해결형',
        text: `AI 솔루션을 팔고 싶지만, 전문 지식도 필요하고, 재고 부담도 크고, 기술 지원은 누가 하죠?

AI SignalCraft 파트너 프로그램은 이 모든 고민을 해결합니다.

• 재고·물류 부담 제로 — SaaS 기반이라 소개만 하면 됩니다
• 전담 매니저 배정 — 기술 상담, 제안서, 데모까지 지원
• 실시간 대시보드 — 고객 현황과 수수료를 한눈에 확인
• 유연한 수수료 — 리셀러 10~20%, 사업 파트너 최대 50%

IT 컨설턴트, 마케팅 전문가, SI 업체 누구나 초기 비용 없이 시작할 수 있습니다. 월 1회 정산, 1년 자동 갱신, 언제든 해지 가능.`,
      },
      {
        title: '기회 제시형',
        text: `한국 AI 여론분석 시장은 빠르게 성장하고 있습니다. 정치, 기업 PR, 미디어 모니터링까지 — 여론 데이터를 전략으로 바꾸려는 수요가 폭발적입니다.

AI SignalCraft는 6개 소스에서 자동 수집하고, 14개 AI 모듈로 리스크·기회·전략까지 분석하는 유일한 한국형 솔루션입니다.

파트너가 되면:
• 검증된 제품으로 신뢰도 높은 영업 가능
• 고객 소개만으로 반복 수익 창출
• 온프레미스 구축까지 담당하면 최대 50% 수수료
• 전담 매니저가 기술·영업을 전면 지원

성장하는 시장에서 먼저 자리를 잡으세요.`,
      },
    ],
  },
  long: {
    label: '롱폼형',
    length: '1,000자 이상',
    purpose: '설득과 구매',
    usage: '공식 홈페이지 브랜드 스토리, 보도자료, 심층 리뷰',
    description: '제작 배경, 기술적 디테일, 브랜드 철학을 전달하여 충성 고객을 만듭니다.',
    copies: [
      {
        title: '브랜드 스토리형',
        text: `"여론을 읽는 것"과 "여론으로 전략을 세우는 것"은 완전히 다른 일입니다.

기존의 소셜 리스닝 도구들은 "어떤 말이 있다"까지만 알려줍니다. 감정 분석 그래프를 보여주고, 키워드 빈도를 나열하고 — 그래서 끝입니다. "그래서 우리가 뭘 해야 하는데?"라는 가장 중요한 질문에는 답하지 못합니다.

AI SignalCraft는 바로 이 문제를 해결하기 위해 만들어졌습니다. 네이버 뉴스, YouTube, 커뮤니티까지 6개 소스에서 한국 온라인 여론을 자동 수집하고, 14개 AI 분석 모듈이 단계별로 작동합니다. 거시적 흐름 분석에서 시작해, 여론 세분화, 감정 프레이밍, 리스크 맵핑, 기회 포착, 전략 도출, 위기 시나리오까지 — 클릭 한 번으로 실행 가능한 전략 리포트를 생성합니다.

우리는 이 기술을 더 많은 조직에 전달하고 싶습니다. 하지만 모든 것을 직접 할 수는 없습니다. 그래서 파트너 프로그램을 만들었습니다.

■ 리셀러 프로그램 (10~20% 수수료)
영업에 집중하고 싶은 분을 위한 프로그램입니다. 고객을 소개하고 계약이 성사되면, 해당 고객의 1년 매출 기준으로 10~20%의 수수료를 받습니다. 기술 상담, 데모, 제안서는 저희가 지원합니다. 전용 대시보드에서 고객 현황과 수수료를 실시간으로 추적할 수 있습니다.

IT 컨설턴트, 프리랜서, 마케팅 전문가, 세일즈 에이전트에게 특히 적합합니다. 이미 고객 네트워크가 있다면, 추가 수입원을 만들 수 있는 가장 간편한 방법입니다.

■ 사업 파트너 프로그램 (10~50% 수수료)
더 깊이 참여하고 싶은 분을 위한 프로그램입니다. 영업관리, 마케팅, 납품, 고객관리, 온프레미스 구축까지 직접 담당하며, 업무 비중에 따라 최대 50%의 수수료를 받습니다. 전담 기술 지원과 공동 영업을 제공합니다.

SI 업체, IT 에이전시, 컨설팅 펌, 솔루션 리셀러가 주요 대상입니다. 자체 고객사에 AI 여론분석을 번들링하거나, 온프레미스 구축 프로젝트를 수주하는 데 활용할 수 있습니다.

■ 공통 혜택
• 초기 비용 0원 — 가입비, 보증금 없음
• 월 1회 정산 — 매월 확정 후 익월 정산
• 1년 자동 갱신 — 언제든 해지 가능
• 전담 매니저 — 기술·영업 자료 전면 지원

파트너 등록은 온라인 신청 폼 작성(5분) → 담당자 심사 → 수수료율 협의 및 계약 → 대시보드 접근 및 영업 개시, 총 4단계로 진행됩니다.

AI 여론분석 시장은 이제 시작입니다. 정치 캠프, 기업 홍보팀, PR 에이전시, 미디어 분석 기관, 공공기관까지 — 여론 데이터를 전략적으로 활용하려는 조직은 계속 늘어나고 있습니다.

함께 성장할 파트너를 기다립니다.`,
      },
    ],
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleCopy}>
      {copied ? (
        <>
          <CheckCircle2 className="size-3.5 text-green-500" />
          복사됨
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          복사
        </>
      )}
    </Button>
  );
}

type CopyData = typeof PRODUCT_COPY;

function CopyTabs({ data, idPrefix }: { data: CopyData; idPrefix: string }) {
  return (
    <Tabs defaultValue={`${idPrefix}-short`} className="w-full">
      <TabsList className="mx-auto mb-8 grid w-full max-w-lg grid-cols-3">
        <TabsTrigger value={`${idPrefix}-short`}>숏폼 (50~100자)</TabsTrigger>
        <TabsTrigger value={`${idPrefix}-middle`}>미들폼 (300~500자)</TabsTrigger>
        <TabsTrigger value={`${idPrefix}-long`}>롱폼 (1,000자+)</TabsTrigger>
      </TabsList>

      {Object.entries(data).map(([key, section]) => (
        <TabsContent key={key} value={`${idPrefix}-${key}`}>
          <div className="mb-6 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{section.label}</Badge>
              <Badge variant="secondary">{section.purpose}</Badge>
              <span className="text-sm text-muted-foreground">{section.length}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium">용도:</span> {section.usage}
            </p>
          </div>

          <div className="space-y-4">
            {section.copies.map((copy) => (
              <Card key={copy.title}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{copy.title}</CardTitle>
                    <CopyButton text={copy.text} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-line rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
                    {copy.text}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

export default function PartnerProgramPage() {
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
            <Handshake className="size-3.5" />
            파트너 프로그램
          </Badge>
          <h1 className="mb-4 text-3xl font-bold md:text-5xl">
            함께 성장하는
            <br />
            비즈니스 파트너를 찾습니다
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            개인 사업자로 AI SignalCraft를 영업하고, 성과에 따른 수수료를 받으세요.
            <br />
            초기 비용 없이 바로 시작할 수 있습니다.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/partner/apply" className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}>
              파트너 신청하기
              <ArrowRight className="size-4" />
            </Link>
            <a href="#programs" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
              프로그램 비교
            </a>
          </div>
        </div>
      </section>

      {/* 핵심 수치 */}
      <section className="border-t border-b bg-muted/30 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">0원</div>
              <div className="text-sm text-muted-foreground">초기 비용</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">최대 50%</div>
              <div className="text-sm text-muted-foreground">수수료율</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">월 1회</div>
              <div className="text-sm text-muted-foreground">정산 주기</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">전담 매니저</div>
              <div className="text-sm text-muted-foreground">기술·영업 지원</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2가지 프로그램 비교 */}
      <section id="programs" className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-2xl font-bold md:text-3xl">파트너 프로그램 비교</h2>
            <p className="text-muted-foreground">영업 스타일과 역량에 맞는 프로그램을 선택하세요</p>
          </div>

          <div className="mb-12 grid gap-6 md:grid-cols-2">
            {PARTNER_PROGRAMS.map((program) => (
              <Card
                key={program.type}
                className={cn(
                  'relative flex flex-col',
                  program.highlight && 'border-primary/30 ring-1 ring-primary/20',
                )}
              >
                {program.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">추천</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardDescription>{program.subtitle}</CardDescription>
                  <CardTitle className="text-2xl">{program.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-primary">
                      {program.commissionRange}
                    </span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {program.commissionBasis}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <p className="mb-4 text-sm text-muted-foreground">{program.description}</p>
                  <ul className="mb-6 flex-1 space-y-2">
                    {program.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs font-medium text-muted-foreground">추천 대상</div>
                    <div className="mt-1 text-sm">{program.targetAudience}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 혜택 */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {PARTNER_BENEFITS.map((b) => (
              <div key={b.label} className="rounded-lg border bg-card p-4 text-center">
                <div className="text-2xl font-bold text-primary">{b.value}</div>
                <div className="mt-1 text-sm font-medium">{b.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{b.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 등록 프로세스 */}
      <section className="border-t bg-muted/20 py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold md:text-3xl">파트너 등록 프로세스</h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {PARTNER_PROCESS.map((p) => (
              <div key={p.step} className="text-center">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {p.step}
                </div>
                <h3 className="mb-1 font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 왜 AI SignalCraft 파트너인가 */}
      <section className="border-t py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold md:text-3xl">
            왜 AI SignalCraft 파트너인가?
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="size-5 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">성장하는 시장</h3>
                <p className="text-sm text-muted-foreground">
                  정치, 기업 PR, 미디어 모니터링까지 — AI 여론분석 수요는 매년 증가하고 있습니다.
                  시장 초기에 자리를 잡으세요.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="size-5 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">검증된 제품</h3>
                <p className="text-sm text-muted-foreground">
                  6개 소스 자동 수집, 14개 AI 분석 모듈, 전략 리포트 자동 생성. 고객에게 자신 있게
                  소개할 수 있는 기술력.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="size-5 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">전면 지원</h3>
                <p className="text-sm text-muted-foreground">
                  전담 매니저, 마케팅 자료, 제안서 템플릿, 기술 데모까지. 영업에만 집중할 수 있도록
                  모든 것을 지원합니다.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 제품 소개글 (파트너 → 고객) */}
      <section className="border-t bg-muted/20 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <Badge variant="outline" className="mb-4 gap-1.5">
              <Copy className="size-3.5" />
              제품 소개 자료
            </Badge>
            <h2 className="mb-4 text-2xl font-bold md:text-3xl">고객에게 보내는 제품 소개글</h2>
            <p className="text-muted-foreground">
              고객 대상 영업·마케팅에 바로 쓸 수 있는 AI SignalCraft 소개글입니다
            </p>
          </div>

          <CopyTabs data={PRODUCT_COPY} idPrefix="product" />
        </div>
      </section>

      {/* 파트너 모집 소개글 */}
      <section className="border-t py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <Badge variant="outline" className="mb-4 gap-1.5">
              <Handshake className="size-3.5" />
              파트너 모집 자료
            </Badge>
            <h2 className="mb-4 text-2xl font-bold md:text-3xl">파트너를 모집하는 소개글</h2>
            <p className="text-muted-foreground">
              파트너 모집 홍보에 바로 쓸 수 있는 프로그램 소개글입니다
            </p>
          </div>

          <CopyTabs data={MARKETING_COPY} idPrefix="partner" />
        </div>
      </section>

      {/* CTA */}
      <section className="border-t py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">
            파트너로 함께 성장할 준비가 되셨나요?
          </h2>
          <p className="mb-8 text-muted-foreground">
            초기 비용 없이 5분 만에 신청을 완료하세요. 담당자가 1~2영업일 내로 연락드립니다.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/partner/apply" className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}>
              <Handshake className="size-4" />
              파트너 신청하기
            </Link>
            <Link
              href="/hardware"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-1.5')}
            >
              온프레미스 장비 보기
            </Link>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">문의: krdn.net@gmail.com</p>
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
