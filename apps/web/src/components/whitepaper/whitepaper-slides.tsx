/**
 * 화이트페이퍼 슬라이드 컴포넌트 모음
 * 각 슬라이드는 동일한 외곽 (16:9 비율, 인쇄 시 A4 가로 한 페이지) 안에서 렌더링됨.
 * 인쇄 스타일은 whitepaper-deck.tsx의 print CSS에서 처리.
 */
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  Layers,
  Lightbulb,
  Network,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { COLLECTION_SOURCES, DIFFERENTIATORS, MODEL_STRATEGY, USE_CASES } from './whitepaper-data';
import { MODULES } from '@/components/landing/data/modules';

const ICONS = {
  Zap,
  Layers,
  Cpu,
  TrendingUp,
  Shield,
  Users,
} as const;

/* ─────────────────────────── 공통 슬라이드 헤더 ─────────────────────────── */

interface SlideHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

function SlideHeader({ eyebrow, title, subtitle }: SlideHeaderProps) {
  return (
    <div className="mb-6 border-b border-border pb-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</div>
      <h2 className="mt-1 text-3xl font-bold text-foreground md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-2 text-base text-muted-foreground md:text-lg">{subtitle}</p>}
    </div>
  );
}

/* ─────────────────────────── 슬라이드 1: 표지 ─────────────────────────── */

export function CoverSlide() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-6 flex items-center gap-3">
        <Sparkles className="h-12 w-12 text-primary" />
        <span className="text-4xl font-bold text-primary md:text-5xl">AI SignalCraft</span>
      </div>
      <h1 className="max-w-3xl text-2xl font-bold text-foreground md:text-4xl">
        AI 기반 여론 분석 & 전략 플랫폼
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
        한국 온라인 여론을 자동 수집하고{' '}
        <span className="font-semibold text-foreground">14개 AI 분석 모듈</span>로
        <br />
        실행 가능한 전략 리포트를 생성합니다.
      </p>
      <div className="mt-10 flex gap-4 text-sm text-muted-foreground">
        <div className="rounded-md border border-border px-4 py-2">
          <div className="text-2xl font-bold text-foreground">5</div>
          <div>데이터 소스</div>
        </div>
        <div className="rounded-md border border-border px-4 py-2">
          <div className="text-2xl font-bold text-foreground">14</div>
          <div>AI 분석 모듈</div>
        </div>
        <div className="rounded-md border border-border px-4 py-2">
          <div className="text-2xl font-bold text-foreground">4</div>
          <div>분석 단계</div>
        </div>
        <div className="rounded-md border border-border px-4 py-2">
          <div className="text-2xl font-bold text-foreground">1~3h</div>
          <div>리포트 생성</div>
        </div>
      </div>
      <p className="mt-12 text-xs text-muted-foreground">
        영업용 화이트페이퍼 · 사내 배포용 · {new Date().getFullYear()}
      </p>
    </div>
  );
}

/* ─────────────────────────── 슬라이드 2: 문제 정의 ─────────────────────────── */

export function ProblemSlide() {
  const problems = [
    {
      icon: Clock,
      title: '속도가 느리다',
      desc: '아침에 일어나면 이미 어제 위기가 오늘 사고가 되어 있다. 사람이 매일 수십 매체를 따라가지 못한다.',
    },
    {
      icon: AlertTriangle,
      title: '편향이 생긴다',
      desc: '한 명의 분석가가 모든 플랫폼을 보면 자기가 익숙한 매체에 가중치가 쏠린다.',
    },
    {
      icon: Network,
      title: '점점 더 흩어진다',
      desc: '여론은 네이버·유튜브·커뮤니티·SNS로 파편화되는데, 의사결정자는 한 장의 보고서만 본다.',
    },
    {
      icon: Target,
      title: '판단의 근거가 약하다',
      desc: '"감"으로 대응했다가 메시지가 역효과를 낸다. 무엇이 통하고 무엇이 안 통하는지 측정 불가.',
    },
  ];
  return (
    <>
      <SlideHeader
        eyebrow="Problem"
        title="여론 모니터링, 사람이 하기엔 이미 한계"
        subtitle="선거 캠프·PR 에이전시·공공기관·컨설팅이 공통적으로 겪는 4가지 문제"
      />
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {problems.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex gap-4 rounded-lg border border-border bg-muted/30 p-5">
            <Icon className="h-8 w-8 shrink-0 text-destructive" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─────────────────────────── 슬라이드 3: 솔루션 한 장 ─────────────────────────── */

export function SolutionSlide() {
  return (
    <>
      <SlideHeader
        eyebrow="Solution"
        title="자동 수집 → AI 분석 → 전략 리포트, 단일 파이프라인"
        subtitle="버튼 한 번으로 5개 매체에서 데이터를 모아 14개 AI가 다각도로 해부합니다."
      />
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { icon: Database, label: '수집', desc: '5개 소스 자동 수집' },
            { icon: Activity, label: '정규화', desc: '플랫폼 차이 제거·중복 통합' },
            { icon: Brain, label: 'AI 분석', desc: '14개 모듈, 4단계 파이프라인' },
            { icon: FileText, label: '리포트', desc: '의사결정자용 한 장 요약' },
          ].map(({ icon: Icon, label, desc }, i) => (
            <div key={label} className="relative">
              <div className="rounded-lg border border-border bg-card p-5 text-center">
                <Icon className="mx-auto h-10 w-10 text-primary" />
                <div className="mt-3 text-lg font-bold text-foreground">{label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
              </div>
              {i < 3 && (
                <ArrowRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-primary md:block" />
              )}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-6 text-center">
          <div className="text-sm font-semibold uppercase tracking-wider text-primary">결과</div>
          <p className="mt-2 text-xl font-semibold text-foreground">
            수일 걸리던 분석을 <span className="text-primary">1~3시간</span>으로,{' '}
            <span className="text-primary">한 사람</span>이 할 수 있습니다.
          </p>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── 슬라이드 4: 수집 소스 ─────────────────────────── */

export function CollectionSlide() {
  return (
    <>
      <SlideHeader
        eyebrow="Step 1 — Collection"
        title="5개 핵심 데이터 소스"
        subtitle="진영·세대·플랫폼이 다른 5개 소스에서 동시에 수집해 사각지대를 없앱니다."
      />
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        {COLLECTION_SOURCES.map((src, i) => (
          <div key={src.name} className="flex gap-4 rounded-lg border border-border bg-card p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
              {i + 1}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{src.name}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{src.desc}</p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                <span className="font-medium">수집 신호:</span> {src.signal}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">확장성:</span> 새로운 매체 추가가 모듈식
        설계 — 어댑터 한 파일만 추가하면 즉시 파이프라인에 연결됩니다. (Playwright + Cheerio 기반)
      </div>
    </>
  );
}

/* ─────────────────────────── 슬라이드 5~7: Stage 1/2/4 모듈 ─────────────────────────── */

interface StageSlideProps {
  groupIndex: number;
}

const STAGE_META = [
  {
    eyebrow: 'Step 2 — Stage 1',
    title: '기초 분석 (4개 모듈, 병렬 실행)',
    subtitle:
      '가장 빠르게 "지금 여론이 어떻게 생겼는지"를 4개 각도에서 동시에 파악합니다. (Gemini 2.5 Flash)',
    accent: 'from-blue-500/20 to-blue-500/0',
    badge: 'bg-blue-500/15 text-blue-600',
  },
  {
    eyebrow: 'Step 3 — Stage 2 + 3',
    title: '심화 분석 + 최종 요약 (4개 모듈, 순차 실행)',
    subtitle: 'Stage 1 결과를 종합해 리스크·기회·전략·요약을 도출합니다. (Claude Sonnet 4.6)',
    accent: 'from-purple-500/20 to-purple-500/0',
    badge: 'bg-purple-500/15 text-purple-600',
  },
  {
    eyebrow: 'Step 4 — Stage 4 (ADVN)',
    title: '고급 분석 (4개 모듈, 11개 선행 결과 종합)',
    subtitle: '정량 지지율 + 프레임 세력 + 시나리오 + 승리 확률 — 예측형 분석. (Claude Sonnet 4.6)',
    accent: 'from-amber-500/20 to-amber-500/0',
    badge: 'bg-amber-500/15 text-amber-600',
  },
] as const;

export function StageSlide({ groupIndex }: StageSlideProps) {
  const meta = STAGE_META[groupIndex];
  const group = MODULES[groupIndex];
  if (!meta || !group) return null;

  return (
    <>
      <SlideHeader eyebrow={meta.eyebrow} title={meta.title} subtitle={meta.subtitle} />
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        {group.items.map((module, idx) => (
          <div
            key={module.name}
            className="flex flex-col rounded-lg border border-border bg-card p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${meta.badge}`}
              >
                {idx + 1}
              </span>
              <h3 className="text-base font-bold text-foreground">{module.name}</h3>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{module.help}</p>
            <ul className="mb-2 space-y-0.5 text-[11px] text-foreground/80">
              {module.details.slice(0, 3).map((d) => (
                <li key={d} className="flex gap-1.5">
                  <span className="text-primary">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto rounded border border-border/60 bg-muted/40 p-2 text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">출력: </span>
              {module.output}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─────────────────────────── 슬라이드 8: 모델 전략 ─────────────────────────── */

export function ModelStrategySlide() {
  return (
    <>
      <SlideHeader
        eyebrow="Architecture"
        title="멀티 LLM 전략 — 모듈마다 최적 모델"
        subtitle="한 AI에 의존하지 않습니다. 속도가 필요한 곳엔 Gemini, 추론 품질이 필요한 곳엔 Claude."
      />
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {MODEL_STRATEGY.map((m) => (
            <div key={m.stage} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{m.stage}</span>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {m.model}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{m.reason}</p>
              <p className="mt-2 text-xs text-foreground/70">
                <span className="font-medium">모듈:</span> {m.examples}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm text-foreground">
              <span className="font-semibold">왜 중요한가:</span> 한 모델에만 의존하면 그 모델의
              편향이 모든 결과에 들어갑니다. 모듈별 다른 모델을 쓰면{' '}
              <span className="font-semibold">교차 검증 효과</span>가 생기고, 비용도{' '}
              <span className="font-semibold">절반 이하</span>로 떨어집니다.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── 슬라이드 9: 차별점 ─────────────────────────── */

export function DifferentiatorsSlide() {
  return (
    <>
      <SlideHeader
        eyebrow="Why Us"
        title="6가지 차별점"
        subtitle="기존 모니터링 도구·대행 인력 대비 명확한 우위"
      />
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
        {DIFFERENTIATORS.map((d) => {
          const Icon = ICONS[d.icon as keyof typeof ICONS] ?? Sparkles;
          return (
            <div key={d.title} className="rounded-lg border border-border bg-card p-4">
              <Icon className="h-7 w-7 text-primary" />
              <h3 className="mt-2 text-base font-bold text-foreground">{d.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{d.desc}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─────────────────────────── 슬라이드 10: 사용 시나리오 ─────────────────────────── */

export function UseCasesSlide() {
  return (
    <>
      <SlideHeader
        eyebrow="Use Cases"
        title="누가 어떻게 쓰는가"
        subtitle="4가지 대표 고객 시나리오"
      />
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        {USE_CASES.map((u, i) => (
          <div key={u.title} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <h3 className="text-base font-bold text-foreground">{u.title}</h3>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{u.who}</p>
            <div className="mt-2 space-y-1.5 text-xs">
              <div>
                <span className="font-semibold text-destructive">문제: </span>
                <span className="text-foreground/80">{u.problem}</span>
              </div>
              <div>
                <span className="font-semibold text-primary">솔루션: </span>
                <span className="text-foreground/80">{u.solution}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─────────────────────────── 슬라이드 11: ROI / 가치 ─────────────────────────── */

export function ValueSlide() {
  const rows = [
    { metric: '여론 분석 소요 시간', before: '3~5일 (분석가 1명 풀타임)', after: '1~3시간 (자동)' },
    { metric: '커버 매체 수', before: '2~3개 (사람 한계)', after: '5개 + 확장 가능' },
    {
      metric: '분석 모듈',
      before: '감정 분석 정도',
      after: '14개 모듈 (감정·프레임·리스크·전략·시뮬레이션)',
    },
    { metric: '편향 보정', before: '없음 (분석가 주관)', after: '플랫폼별 자동 보정' },
    { metric: '리스크 발견', before: '터지고 나서', after: 'Top 3~5 사전 식별 + 트리거 조건' },
    { metric: '예측 능력', before: '리포트만', after: '위기 시나리오 + 승리 확률 시뮬레이션' },
  ];
  return (
    <>
      <SlideHeader
        eyebrow="Value"
        title="Before / After 한눈에"
        subtitle="기존 방식 vs AI SignalCraft 도입 후"
      />
      <div className="flex-1 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="border-b border-border p-3 text-left font-semibold text-foreground">
                항목
              </th>
              <th className="border-b border-border p-3 text-left font-semibold text-muted-foreground">
                Before (수동)
              </th>
              <th className="border-b border-border p-3 text-left font-semibold text-primary">
                After (SignalCraft)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.metric} className="odd:bg-muted/20">
                <td className="border-b border-border/60 p-3 font-medium text-foreground">
                  {r.metric}
                </td>
                <td className="border-b border-border/60 p-3 text-muted-foreground">{r.before}</td>
                <td className="border-b border-border/60 p-3 text-foreground">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-primary" />
                  {r.after}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─────────────────────────── 슬라이드 12: CTA / 다음 단계 ─────────────────────────── */

export function CtaSlide() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <Sparkles className="h-14 w-14 text-primary" />
      <h2 className="mt-4 text-3xl font-bold text-foreground md:text-4xl">
        다음 단계는 30분 데모입니다
      </h2>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
        실제 키워드 한 개로 라이브 분석을 보여드립니다. 14개 모듈이 1~3시간 내 어떤 결과를
        만들어내는지 직접 확인하세요.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { icon: BarChart3, title: '1. 라이브 데모', desc: '실제 키워드로 분석 실행' },
          { icon: FileText, title: '2. 샘플 리포트', desc: '14개 모듈 출력 PDF 송부' },
          { icon: CheckCircle2, title: '3. 파일럿 도입', desc: '2주 무료 PoC 제공' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-lg border border-border bg-card p-5">
            <Icon className="mx-auto h-8 w-8 text-primary" />
            <div className="mt-2 text-base font-bold text-foreground">{title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
          </div>
        ))}
      </div>
      <div className="mt-10 rounded-lg border border-primary/40 bg-primary/5 px-6 py-4">
        <p className="text-sm text-muted-foreground">담당 영업</p>
        <p className="mt-1 text-lg font-semibold text-foreground">AI SignalCraft Sales Team</p>
        <p className="text-sm text-muted-foreground">krdn.net@gmail.com · 데모 요청 환영</p>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        본 문서는 영업 목적의 사내 배포용 화이트페이퍼입니다. © {new Date().getFullYear()} AI
        SignalCraft
      </p>
    </div>
  );
}
