'use client';

/**
 * 화이트페이퍼 — 종합 기술 리포트 (긴 형식)
 *
 * 화면 구성:
 *   - 좌측: 고정 사이드바 목차 (스크롤 따라 활성 섹션 표시)
 *   - 본문: 섹션별 상세 설명, 14개 모듈 카드, 출처 목록
 *   - 우상단: PDF 다운로드 버튼 (window.print)
 *
 * 디자인 영감: 사용자가 보여준 실제 분석 리포트(좌측 목차 + 메타 + 본문) 형태.
 * 인쇄 시: A4 세로, 좌측 사이드바 숨김, 섹션이 자연스럽게 페이지 분할.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronLeft,
  Download,
  ExternalLink,
  Layers,
  Menu,
  Printer,
  Sparkles,
  X,
} from 'lucide-react';
import type { ReportModule } from './report-data';
import { REPORT_META, REPORT_MODULES, REPORT_SECTIONS } from './report-data';
import { COLLECTION_SOURCES, MODEL_STRATEGY } from './whitepaper-data';
import { cn } from '@/lib/utils';

/* ─────────── Stage 색상 매핑 ─────────── */
const STAGE_COLORS: Record<string, string> = {
  'Stage 1': 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  'Stage 2': 'bg-purple-500/10 text-purple-700 border-purple-500/30',
  'Stage 3': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  'Stage 4': 'bg-amber-500/10 text-amber-700 border-amber-500/30',
};

export function WhitepaperReport() {
  const [activeSection, setActiveSection] = useState<string>('summary');
  const [tocOpen, setTocOpen] = useState(false);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') window.print();
  }, []);

  /** 스크롤 위치에 따라 활성 섹션 자동 갱신 */
  useEffect(() => {
    const onScroll = () => {
      const ids = REPORT_SECTIONS.map((s) => s.id);
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= 120) current = id;
      }
      setActiveSection(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const allSources = useMemo(() => {
    const map = new Map<string, string>();
    REPORT_MODULES.forEach((m) =>
      m.sources.forEach((s) => {
        if (!map.has(s.label)) map.set(s.label, s.detail);
      }),
    );
    return Array.from(map.entries()).map(([label, detail]) => ({ label, detail }));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── 상단 툴바 (인쇄 시 숨김) ─── */}
      <header className="screen-only sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link
            href="/whitepaper"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">슬라이드 데크로</span>
            <span className="sm:hidden">데크</span>
          </Link>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <Link
            href="/"
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
          >
            홈으로
          </Link>
          <div className="ml-2 hidden text-sm font-semibold text-foreground md:block">
            AI SignalCraft 종합 기술 리포트
          </div>
          <div className="flex-1" />
          {/* 모바일 전용 목차 토글 */}
          <button
            type="button"
            onClick={() => setTocOpen(true)}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted lg:hidden"
            aria-label="목차 열기"
          >
            <Menu className="h-3.5 w-3.5" />
            목차
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 sm:gap-1.5 sm:px-3 sm:text-xs"
            title="브라우저 인쇄로 PDF 저장"
          >
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">PDF 다운로드</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>
      </header>

      {/* ─── 모바일 목차 시트 ─── */}
      {tocOpen && (
        <div className="screen-only fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setTocOpen(false)}
            aria-hidden
          />
          <aside className="relative ml-auto h-full w-72 overflow-y-auto border-l border-border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                목차
              </h3>
              <button
                type="button"
                onClick={() => setTocOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="space-y-0.5">
              {REPORT_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setTocOpen(false)}
                  className={cn(
                    'block rounded-md px-3 py-2 text-sm transition-colors',
                    activeSection === s.id
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {s.id === 'summary' ? (
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      {s.title}
                    </span>
                  ) : (
                    <span>
                      <span className="mr-1.5 text-xs text-muted-foreground/70">{s.no}.</span>
                      {s.title}
                    </span>
                  )}
                </a>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="mx-auto flex max-w-[1400px] gap-8 px-3 py-6 sm:px-4 sm:py-8 lg:px-8">
        {/* ─── 좌측 사이드바 목차 (인쇄 시 숨김) ─── */}
        <aside className="screen-only hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              목차
            </div>
            <nav className="space-y-0.5">
              {REPORT_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={cn(
                    'block rounded-md px-3 py-2 text-sm transition-colors',
                    activeSection === s.id
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {s.id === 'summary' ? (
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      {s.title}
                    </span>
                  ) : (
                    <span>
                      <span className="mr-1.5 text-xs text-muted-foreground/70">{s.no}.</span>
                      {s.title}
                    </span>
                  )}
                </a>
              ))}
            </nav>

            <div className="mt-6 rounded-md border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
              <div className="mb-1 font-semibold text-foreground">팁</div>
              <ul className="space-y-0.5">
                <li>· 우상단 PDF 버튼으로 인쇄</li>
                <li>· 기안서 첨부용 A4 세로</li>
                <li>· 좌측 목차로 빠른 이동</li>
              </ul>
            </div>
          </div>
        </aside>

        {/* ─── 본문 ─── */}
        <main className="report-body min-w-0 flex-1">
          {/* 헤더 메타 */}
          <header className="mb-10 border-b border-border pb-6">
            <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
              {REPORT_META.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base md:text-lg">
              {REPORT_META.subtitle}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">분류:</span>{' '}
                {REPORT_META.classification}
              </span>
              <span className="text-muted-foreground/40">|</span>
              <span>
                <span className="font-semibold text-foreground">대상:</span> {REPORT_META.audience}
              </span>
              <span className="text-muted-foreground/40">|</span>
              <span>
                <span className="font-semibold text-foreground">버전:</span> {REPORT_META.version}
              </span>
              <span className="text-muted-foreground/40">|</span>
              <span>
                <span className="font-semibold text-foreground">작성일:</span>{' '}
                {new Date().toISOString().slice(0, 10)}
              </span>
            </div>
          </header>

          {/* ─── 한 줄 요약 ─── */}
          <Section id="summary" title="🔑 한 줄 요약">
            <Highlight>
              {`"한국 온라인 여론을 5개 매체에서 자동 수집하고, 14개 AI 분석 모듈이 4단계 파이프라인으로 다각도 분석해 — 수일 걸리던 전략 리포트를 1~3시간 안에 자동 생성한다."`}
            </Highlight>
            <p className="mt-4 text-sm leading-7 text-foreground/90">
              본 리포트는 AI SignalCraft의 14개 분석 모듈 각각이{' '}
              <strong>무엇을, 어떻게, 어떤 이론적 근거</strong>로 분석하는지 모두 설명합니다. 영업
              담당자가 고객의 기술 질문에 즉답할 수 있도록 작성되었으며, 그대로 기안서에 첨부
              가능합니다.
            </p>
          </Section>

          {/* ─── 0. 제품 개요 ─── */}
          <Section id="overview" title="0. 제품 개요" eyebrow="OVERVIEW">
            <p className="mb-3 leading-7 text-foreground/90">
              <strong>AI SignalCraft</strong>는 선거 캠프, PR 에이전시, 공공기관 홍보팀, 정치 컨설팅
              회사가 매일 직면하는 4가지 문제 — <em>속도·편향·파편화·근거 부족</em> — 를 해결하기
              위해 설계된 자동화 여론 분석 플랫폼입니다.
            </p>
            <p className="mb-3 leading-7 text-foreground/90">
              사람이 며칠 걸려 5개 매체를 수동으로 모니터링하던 작업을, 본 시스템은{' '}
              <strong>1~3시간</strong> 안에 14개 각도에서 자동 분석합니다. 결과는 단순 모니터링이
              아니라 <strong>실행 가능한 전략</strong>(타겟·메시지·콘텐츠·리스크 대응) 단위로
              구조화되어 의사결정자에게 즉시 전달됩니다.
            </p>
            <Stat />
          </Section>

          {/* ─── 1. 4단계 파이프라인 ─── */}
          <Section id="pipeline" title="1. 4단계 파이프라인" eyebrow="ARCHITECTURE">
            <p className="mb-4 leading-7 text-foreground/90">
              모든 분석은 다음 4단계를 거쳐 진행됩니다. 각 단계는 BullMQ 작업 큐 위에서 의존성에
              따라 자동으로 병렬 또는 순차 실행됩니다.
            </p>
            <ol className="space-y-3">
              {[
                {
                  no: '①',
                  title: '수집 (Collection)',
                  desc: '5개 매체에서 키워드 기반으로 게시글·댓글·반응을 자동 크롤링. Playwright + Cheerio 기반.',
                },
                {
                  no: '②',
                  title: '정규화 (Normalization)',
                  desc: '서로 다른 매체의 데이터를 동일 스키마(작성자/시간/본문/반응)로 변환, 중복 제거, 시간대 통일.',
                },
                {
                  no: '③',
                  title: 'AI 분석 (Analysis)',
                  desc: '14개 모듈이 4단계로 실행 (Stage 1 병렬 → Stage 2 순차 → Stage 3 요약 → Stage 4 고급).',
                },
                {
                  no: '④',
                  title: '리포트 (Report)',
                  desc: '의사결정자용 한 줄 요약부터 분석가용 상세 데이터까지 한 문서로 통합, PDF/대시보드로 출력.',
                },
              ].map((step) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-lg border border-border bg-card p-4"
                >
                  <div className="text-2xl font-bold text-primary">{step.no}</div>
                  <div>
                    <div className="font-semibold text-foreground">{step.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{step.desc}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {/* ─── 2. 5개 데이터 소스 ─── */}
          <Section id="sources" title="2. 5개 데이터 소스" eyebrow="DATA SOURCES">
            <p className="mb-4 leading-7 text-foreground/90">
              한 매체에만 의존하면 그 매체의 정치 편향이 모든 분석에 들어갑니다. 본 시스템은
              진영·세대·플랫폼이 다른 5개 소스를 동시에 수집해 사각지대를 없앱니다.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="border-b border-border p-3 text-left font-semibold">#</th>
                    <th className="border-b border-border p-3 text-left font-semibold">소스</th>
                    <th className="border-b border-border p-3 text-left font-semibold">역할</th>
                    <th className="border-b border-border p-3 text-left font-semibold">
                      수집 신호
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COLLECTION_SOURCES.map((s, i) => (
                    <tr key={s.name} className="odd:bg-muted/20">
                      <td className="border-b border-border/60 p-3 text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="border-b border-border/60 p-3 font-medium text-foreground">
                        {s.name}
                      </td>
                      <td className="border-b border-border/60 p-3 text-foreground/80">{s.desc}</td>
                      <td className="border-b border-border/60 p-3 text-xs text-muted-foreground">
                        {s.signal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              새 매체 추가는{' '}
              <code className="rounded bg-muted px-1 text-foreground">Collector</code>
              인터페이스를 구현한 어댑터 한 파일만 추가하면 됩니다 — 모듈식 설계.
            </p>
          </Section>

          {/* ─── 3. 14개 분석 모듈 상세 ─── */}
          <Section id="modules" title="3. 14개 분석 모듈 상세" eyebrow="MODULE SPEC">
            <p className="mb-6 leading-7 text-foreground/90">
              각 모듈은 독립된 LLM 프롬프트와 Zod 스키마로 정의되어 있으며, 모듈마다 가장 적합한
              모델이 배정됩니다. 아래는 12개 분석 모듈 + 2개 시스템 모듈, 총{' '}
              <strong>14개 모듈</strong>의 완전한 명세입니다.
            </p>
            <div className="space-y-6">
              {REPORT_MODULES.map((m) => (
                <ModuleCard key={m.id} module={m} />
              ))}
            </div>
          </Section>

          {/* ─── 4. 멀티 LLM 모델 전략 ─── */}
          <Section id="model-strategy" title="4. 멀티 LLM 모델 전략" eyebrow="MODEL STRATEGY">
            <p className="mb-4 leading-7 text-foreground/90">
              한 AI 모델에만 의존하면 그 모델의 학습 편향이 모든 결과에 들어갑니다. 본 시스템은
              모듈의 성격에 따라 다른 모델을 배정해 <strong>속도·비용·품질</strong>의 균형을 맞추고{' '}
              <strong>교차 검증 효과</strong>를 얻습니다.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="border-b border-border p-3 text-left font-semibold">단계</th>
                    <th className="border-b border-border p-3 text-left font-semibold">모델</th>
                    <th className="border-b border-border p-3 text-left font-semibold">
                      배정 이유
                    </th>
                    <th className="border-b border-border p-3 text-left font-semibold">
                      담당 모듈
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MODEL_STRATEGY.map((m) => (
                    <tr key={m.stage} className="odd:bg-muted/20">
                      <td className="border-b border-border/60 p-3 font-medium text-foreground">
                        {m.stage}
                      </td>
                      <td className="border-b border-border/60 p-3">
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          {m.model}
                        </span>
                      </td>
                      <td className="border-b border-border/60 p-3 text-foreground/80">
                        {m.reason}
                      </td>
                      <td className="border-b border-border/60 p-3 text-xs text-muted-foreground">
                        {m.examples}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ─── 5. 이론적 기반 종합 ─── */}
          <Section id="theory" title="5. 이론적 기반 종합" eyebrow="THEORETICAL FOUNDATION">
            <p className="mb-4 leading-7 text-foreground/90">
              본 시스템의 14개 모듈은 임의로 설계된 것이 아니라, 정치학·커뮤니케이션학·마케팅·통계학
              분야에서 검증된 이론을 LLM 시대에 맞게 재구현한 것입니다. 핵심 이론 계보를 한 표로
              정리하면 다음과 같습니다.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="border-b border-border p-3 text-left font-semibold">분야</th>
                    <th className="border-b border-border p-3 text-left font-semibold">
                      핵심 이론
                    </th>
                    <th className="border-b border-border p-3 text-left font-semibold">
                      관련 모듈
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      area: '커뮤니케이션학',
                      theory:
                        '어젠다 세팅 (McCombs & Shaw 1972), 프레이밍 (Entman 1993), 두 단계 흐름 (Katz & Lazarsfeld 1955)',
                      modules: 'macro-view, sentiment-framing, message-impact',
                    },
                    {
                      area: '정치마케팅',
                      theory: '정치 시장 세분화 STP (Newman 1994), 정치 캠페인 4P',
                      modules: 'segmentation, strategy',
                    },
                    {
                      area: '전략경영',
                      theory: 'SWOT (Andrews 1971), 블루오션 (Kim & Mauborgne 2005)',
                      modules: 'opportunity, strategy',
                    },
                    {
                      area: '리스크/위기관리',
                      theory:
                        '정치 리스크 4D (Bremmer & Keat 2009), SCCT (Coombs 2007), 시나리오 플래닝 (Schwartz 1991)',
                      modules: 'risk-map, crisis-scenario',
                    },
                    {
                      area: '담론분석',
                      theory:
                        '프레임 경쟁 (Chong & Druckman 2007), 담론 헤게모니 (Laclau & Mouffe 1985)',
                      modules: 'frame-war',
                    },
                    {
                      area: '통계/예측',
                      theory: '비표본 보정 (Wang et al. 2015), 베이지안 예측 (Silver 2012)',
                      modules: 'approval-rating, win-simulation',
                    },
                    {
                      area: '경영보고',
                      theory: '피라미드 원칙 (Minto 1987), BLUF (US Army FM 6-0)',
                      modules: 'final-summary, integrated-report',
                    },
                  ].map((row) => (
                    <tr key={row.area} className="odd:bg-muted/20">
                      <td className="border-b border-border/60 p-3 font-medium text-foreground">
                        {row.area}
                      </td>
                      <td className="border-b border-border/60 p-3 text-foreground/80">
                        {row.theory}
                      </td>
                      <td className="border-b border-border/60 p-3 text-xs text-muted-foreground">
                        {row.modules}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ─── 6. 경쟁 접근과의 차이 ─── */}
          <Section id="comparison" title="6. 경쟁 접근과의 차이" eyebrow="DIFFERENTIATION">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="border-b border-border p-3 text-left font-semibold">항목</th>
                    <th className="border-b border-border p-3 text-left font-semibold text-muted-foreground">
                      전통 모니터링 도구
                    </th>
                    <th className="border-b border-border p-3 text-left font-semibold text-muted-foreground">
                      범용 ChatGPT/Claude
                    </th>
                    <th className="border-b border-border p-3 text-left font-semibold text-primary">
                      AI SignalCraft
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      m: '자동 수집',
                      a: '키워드 알림만',
                      b: '없음 (사람이 복붙)',
                      c: '5개 소스 자동',
                    },
                    {
                      m: '분석 깊이',
                      a: '감성·키워드',
                      b: '단발 답변',
                      c: '14개 모듈 다각도',
                    },
                    {
                      m: '구조화 출력',
                      a: '대시보드',
                      b: '자유 텍스트',
                      c: 'Zod 스키마 강제',
                    },
                    {
                      m: '예측·시뮬레이션',
                      a: '없음',
                      b: '없음',
                      c: '시나리오 + 승리 확률',
                    },
                    {
                      m: '편향 보정',
                      a: '없음',
                      b: '없음',
                      c: '플랫폼별 가중치',
                    },
                    {
                      m: '재현성',
                      a: '대체로 가능',
                      b: '낮음',
                      c: '결정론적 파이프라인',
                    },
                    {
                      m: '한국 특화',
                      a: '일부',
                      b: '낮음',
                      c: '5개 한국 매체 + 한국어 프롬프트',
                    },
                  ].map((r) => (
                    <tr key={r.m} className="odd:bg-muted/20">
                      <td className="border-b border-border/60 p-3 font-medium text-foreground">
                        {r.m}
                      </td>
                      <td className="border-b border-border/60 p-3 text-muted-foreground">{r.a}</td>
                      <td className="border-b border-border/60 p-3 text-muted-foreground">{r.b}</td>
                      <td className="border-b border-border/60 p-3 text-foreground">{r.c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ─── 7. 한계와 정직한 고지 ─── */}
          <Section id="limits" title="7. 한계와 정직한 고지" eyebrow="HONEST DISCLOSURE">
            <p className="mb-4 leading-7 text-foreground/90">
              영업 자료는 강점만 강조하기 쉽지만, 본 시스템은 의사결정자가 결과를 잘못 사용하지
              않도록 한계를 명시적으로 고지합니다.
            </p>
            <ul className="space-y-3 text-sm">
              {[
                {
                  t: 'AI 지지율은 과학적 여론조사가 아닙니다',
                  d: '온라인 여론은 전체 유권자의 일부 표본일 뿐입니다. 본 시스템의 지지율 추정은 추세 파악용 보조 지표이며, 확률 표본 기반 여론조사를 대체하지 않습니다. 모든 추정값에는 면책 문구가 자동 포함됩니다.',
                },
                {
                  t: '수집 소스는 공개 데이터에 한정',
                  d: '비공개 게시물·DM·암호화 채널은 수집하지 않으며, robots.txt와 각 사이트 이용약관을 준수합니다. 개인정보보호법 및 저작권법 준수 범위 내에서만 동작합니다.',
                },
                {
                  t: 'LLM의 환각(hallucination) 가능성',
                  d: '모든 모듈 프롬프트에 "실제 존재하는 데이터만 인용, 생성 금지" 지침이 포함되며, Zod 스키마로 출력 구조를 강제합니다. 그럼에도 불구하고 LLM 출력은 100% 사실 정확성을 보장하지 않으며, 최종 의사결정에는 반드시 사람의 검토가 필요합니다.',
                },
                {
                  t: '수동 트리거 방식',
                  d: '현재 버전은 사용자가 분석을 수동으로 시작하는 방식입니다. 24/7 실시간 위기 알림은 별도 설정(스케줄러 + 임계값)이 필요합니다.',
                },
                {
                  t: '비용 구조',
                  d: '14개 모듈 1회 실행은 LLM API 호출을 다수 발생시킵니다. 캐싱·결과 재사용을 통해 비용을 절감하지만, 대량 실행 전 비용 견적을 권장합니다.',
                },
              ].map((item) => (
                <li key={item.t} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-semibold text-foreground">⚠️ {item.t}</div>
                  <div className="mt-1 text-foreground/80">{item.d}</div>
                </li>
              ))}
            </ul>
          </Section>

          {/* ─── 8. 참고 문헌 ─── */}
          <Section id="references" title="8. 참고 문헌 전체 목록" eyebrow="REFERENCES">
            <p className="mb-4 leading-7 text-foreground/90">
              본 리포트에서 인용된 학술·실무 문헌 전체 목록입니다. 모듈별 출처는 각 모듈 카드의{' '}
              <em>출처</em> 섹션을 참조하세요. 총 {allSources.length}개 문헌.
            </p>
            <ol className="space-y-2 text-sm">
              {allSources.map((s, i) => (
                <li
                  key={s.label}
                  className="flex gap-3 rounded border border-border/60 bg-card p-3"
                >
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    [{String(i + 1).padStart(2, '0')}]
                  </span>
                  <div>
                    <div className="font-medium text-foreground">{s.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {/* 푸터 */}
          <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
            <p>
              본 문서는 AI SignalCraft 영업 자료입니다. 사내 배포용이며, 외부 공개 시 별도 검토가
              필요합니다. © {new Date().getFullYear()} AI SignalCraft. All rights reserved.
            </p>
            <p className="mt-2">
              문의: krdn.net@gmail.com · 데모 요청 환영 · 기술 질문은{' '}
              <Link href="/whitepaper" className="text-primary hover:underline">
                슬라이드 데크
              </Link>
              에서 빠르게 확인 가능
            </p>
          </footer>
        </main>
      </div>

      {/* ─── 인쇄용 스타일 ─── */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 16mm 14mm;
          }
          html,
          body {
            background: white !important;
          }
          .screen-only {
            display: none !important;
          }
          .report-body {
            max-width: 100% !important;
          }
          .report-body section {
            page-break-inside: auto;
            break-inside: auto;
          }
          .report-body h2 {
            page-break-after: avoid;
            break-after: avoid;
          }
          .report-body h3 {
            page-break-after: avoid;
            break-after: avoid;
          }
          .module-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          /* 인쇄 시 카드 배경/색상 보존 */
          .report-body * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          a {
            color: inherit !important;
            text-decoration: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────── 보조 컴포넌트 ─────────────────────── */

function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-20">
      {eyebrow && (
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
          {eyebrow}
        </div>
      )}
      <h2 className="mb-4 text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4 text-base font-medium italic text-foreground">
      {children}
    </div>
  );
}

function Stat() {
  const items = [
    { v: '5', l: '데이터 소스' },
    { v: '14', l: 'AI 분석 모듈' },
    { v: '4', l: '분석 단계' },
    { v: '1~3h', l: '리포트 생성' },
  ];
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((i) => (
        <div key={i.l} className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-primary">{i.v}</div>
          <div className="text-xs text-muted-foreground">{i.l}</div>
        </div>
      ))}
    </div>
  );
}

function ModuleCard({ module: m }: { module: ReportModule }) {
  const colorClass = STAGE_COLORS[m.stage] ?? 'bg-muted text-foreground border-border';
  return (
    <article
      id={`module-${m.id}`}
      className="module-card scroll-mt-20 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      {/* 헤더 */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              #{String(m.no).padStart(2, '0')}
            </span>
            <span
              className={cn(
                'rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                colorClass,
              )}
            >
              {m.stage} · {m.stageLabel}
            </span>
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {m.displayName}{' '}
            <span className="text-sm font-normal text-muted-foreground">({m.enName})</span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            모델: <span className="font-medium text-foreground">{m.model}</span> · 모듈 ID:{' '}
            <code className="rounded bg-muted px-1">{m.id}</code>
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-3 py-1 text-[11px] text-foreground/80">
          역할: <span className="font-semibold">{m.role}</span>
        </div>
      </header>

      {/* 무엇을 분석하는가 */}
      <SubSection title="무엇을 분석하는가">
        <p className="text-sm leading-6 text-foreground/90">{m.whatItDoes}</p>
      </SubSection>

      {/* 방법론 */}
      <SubSection title="분석 방법론">
        <ul className="space-y-1 text-sm text-foreground/80">
          {m.methodology.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-xs text-primary">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </SubSection>

      {/* 입력/출력 */}
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <SubSection title="입력 / 의존성" inline>
          <p className="text-sm text-foreground/80">{m.inputs}</p>
        </SubSection>
        <SubSection title="주요 출력 필드" inline>
          <ul className="space-y-1 text-xs">
            {m.outputs.map((o) => (
              <li key={o.field}>
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">{o.field}</code>{' '}
                <span className="text-muted-foreground">— {o.desc}</span>
              </li>
            ))}
          </ul>
        </SubSection>
      </div>

      {/* 활용법 */}
      <SubSection title="실무 활용법">
        <ul className="space-y-1 text-sm text-foreground/80">
          {m.howToUse.map((u, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary">▸</span>
              <span>{u}</span>
            </li>
          ))}
        </ul>
      </SubSection>

      {/* 이론 */}
      <SubSection title="이론적 기반">
        <p className="rounded-md border-l-2 border-primary/40 bg-primary/5 p-3 text-sm leading-6 text-foreground/90">
          {m.theory}
        </p>
      </SubSection>

      {/* 출처 */}
      <SubSection title="출처">
        <ul className="space-y-1.5 text-xs">
          {m.sources.map((s) => (
            <li key={s.label} className="flex gap-2">
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <div>
                <div className="font-medium text-foreground">{s.label}</div>
                <div className="text-muted-foreground">{s.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </SubSection>
    </article>
  );
}

function SubSection({
  title,
  children,
  inline = false,
}: {
  title: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={cn(inline ? 'mb-0' : 'mb-3')}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        <Layers className="h-3 w-3" />
        {title}
      </div>
      {children}
    </div>
  );
}

// Printer 아이콘은 import만 유지 (향후 사용 가능성)
void Printer;
