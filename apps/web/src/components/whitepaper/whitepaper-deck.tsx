'use client';

/**
 * 화이트페이퍼 슬라이드 데크
 *
 * 영업사원이 고객 미팅에서 보면서 설명하고, 동시에 PDF로 내려받아
 * 기안서에 첨부할 수 있는 12장짜리 인터랙티브 슬라이드.
 *
 * 기능:
 *  - ←/→ 키보드 슬라이드 이동
 *  - F: 풀스크린 토글
 *  - P 또는 Ctrl/Cmd+P: 브라우저 인쇄(= PDF 저장)
 *  - 우상단 다운로드 버튼: 인쇄 다이얼로그 트리거
 *  - 인쇄 시 print CSS가 모든 슬라이드를 한 페이지씩 펼쳐서 출력
 *  - 좌측 점프 네비 (썸네일)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  Download,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import {
  CollectionSlide,
  CoverSlide,
  CtaSlide,
  DifferentiatorsSlide,
  ModelStrategySlide,
  ProblemSlide,
  SolutionSlide,
  StageSlide,
  UseCasesSlide,
  ValueSlide,
} from './whitepaper-slides';
import { cn } from '@/lib/utils';

interface SlideDef {
  id: string;
  title: string;
  render: () => React.ReactNode;
}

const SLIDES: SlideDef[] = [
  { id: 'cover', title: '표지', render: () => <CoverSlide /> },
  { id: 'problem', title: '문제 정의', render: () => <ProblemSlide /> },
  { id: 'solution', title: '솔루션 개요', render: () => <SolutionSlide /> },
  { id: 'collection', title: '수집 소스', render: () => <CollectionSlide /> },
  { id: 'stage1', title: 'Stage 1 — 기초 분석', render: () => <StageSlide groupIndex={0} /> },
  { id: 'stage2', title: 'Stage 2+3 — 심화 분석', render: () => <StageSlide groupIndex={1} /> },
  { id: 'stage4', title: 'Stage 4 — 고급 분석', render: () => <StageSlide groupIndex={2} /> },
  { id: 'model', title: '멀티 LLM 전략', render: () => <ModelStrategySlide /> },
  { id: 'why', title: '6가지 차별점', render: () => <DifferentiatorsSlide /> },
  { id: 'use-cases', title: '사용 시나리오', render: () => <UseCasesSlide /> },
  { id: 'value', title: 'Before / After', render: () => <ValueSlide /> },
  { id: 'cta', title: '다음 단계', render: () => <CtaSlide /> },
];

export function WhitepaperDeck() {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const total = SLIDES.length;

  const goNext = useCallback(() => setCurrent((c) => Math.min(c + 1, total - 1)), [total]);
  const goPrev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') window.print();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 입력 요소에 포커스되어 있으면 무시
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrent(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrent(total - 1);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'p' || e.key === 'P') {
        // Ctrl/Cmd+P는 브라우저 기본, 단독 P는 우리가 트리거
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handlePrint();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, handlePrint, toggleFullscreen, total]);

  const progress = useMemo(() => ((current + 1) / total) * 100, [current, total]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── 화면용 (인쇄 시 숨김) 상단 툴바 ─── */}
      <header className="screen-only sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:text-sm"
          >
            <ChevronLeft className="h-4 w-4" />홈
          </Link>
          <div className="ml-2 hidden text-sm font-semibold text-foreground md:block">
            AI SignalCraft 제품 소개
          </div>
          <div className="flex-1" />
          <Link
            href="/whitepaper/report"
            className="hidden items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted sm:flex"
            title="14개 모듈 상세 명세 + 학술 출처"
          >
            <BookOpen className="h-3.5 w-3.5" />
            상세 리포트
          </Link>
          <button
            type="button"
            onClick={() => setNavOpen((o) => !o)}
            className="rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted sm:px-3 sm:text-xs"
          >
            목차 ({current + 1}/{total})
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden rounded-md border border-border p-1.5 text-foreground hover:bg-muted sm:inline-flex"
            title="풀스크린 (F)"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 sm:gap-1.5 sm:px-3 sm:text-xs"
            title="PDF로 다운로드 (P)"
          >
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">PDF 다운로드</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>
        {/* 진행 막대 */}
        <div className="h-0.5 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* ─── 목차 사이드시트 ─── */}
      {navOpen && (
        <div className="screen-only fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setNavOpen(false)}
            aria-hidden
          />
          <aside className="relative ml-auto h-full w-80 overflow-y-auto border-l border-border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">목차</h3>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="space-y-1">
              {SLIDES.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrent(i);
                      setNavOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      i === current
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <span className="w-6 text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-md border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
              <div className="mb-1 font-semibold text-foreground">단축키</div>
              <ul className="space-y-0.5">
                <li>← / → : 슬라이드 이동</li>
                <li>Home / End : 처음 / 끝</li>
                <li>F : 풀스크린</li>
                <li>P : PDF 인쇄</li>
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* ─── 화면 모드: 현재 슬라이드 1장 ─── */}
      <main className="screen-only mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="flex justify-center">
          {/*
            모바일에서는 1280px 폭의 슬라이드를 CSS scale로 통째 축소해 16:9 비율과
            내부 폰트 비례를 그대로 유지한다 (텍스트 잘림 방지).
          */}
          <div className="slide-stage relative w-full max-w-6xl" style={{ aspectRatio: '16 / 9' }}>
            <article
              className="slide-frame absolute left-1/2 top-1/2 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
              key={SLIDES[current].id}
            >
              <div className="flex h-full flex-col">{SLIDES[current].render()}</div>
              {/* 슬라이드 푸터 */}
              <div className="absolute bottom-3 right-5 text-[10px] text-muted-foreground">
                {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')} · AI
                SignalCraft
              </div>
            </article>
          </div>
        </div>

        {/* 좌우 컨트롤 */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={current === 0}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            이전
          </button>
          <span className="text-sm text-muted-foreground">
            {current + 1} / {total} — {SLIDES[current].title}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={current === total - 1}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-muted"
          >
            다음
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          ← / → 키로 이동 · F 풀스크린 · P 키 또는 우상단 버튼으로 PDF 다운로드
        </p>
      </main>

      {/* ─── 인쇄용: 모든 슬라이드를 한 페이지씩 ─── */}
      <div className="print-only">
        {SLIDES.map((s, i) => (
          <section key={`print-${s.id}`} className="print-page">
            <div className="flex h-full flex-col">{s.render()}</div>
            <div className="print-footer">
              {String(i + 1).padStart(2, '0')} / {String(total).padStart(2, '0')} · AI SignalCraft
              제품 소개
            </div>
          </section>
        ))}
      </div>

      {/* ─── 인쇄/화면 분기 스타일 ─── */}
      <style jsx global>{`
        /* 슬라이드 무대: 1280×720 고정 → 컨테이너 폭에 맞춰 비율 유지 축소 */
        .slide-stage {
          /* CSS 변수로 컨테이너 폭 기반 scale 계산 */
          container-type: inline-size;
        }
        .slide-frame {
          width: 1280px;
          height: 720px;
          padding: 40px;
          /* container query 단위(cqw) 사용 — stage 폭의 1/1280만큼 scale */
          transform: translate(-50%, -50%) scale(calc(100cqw / 1280));
          transform-origin: center center;
        }
        .print-only {
          display: none;
        }
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html,
          body {
            background: white !important;
          }
          .screen-only {
            display: none !important;
          }
          .print-only {
            display: block;
          }
          .print-page {
            position: relative;
            width: 297mm;
            height: 210mm;
            padding: 14mm 16mm;
            box-sizing: border-box;
            page-break-after: always;
            break-after: page;
            background: white;
            color: #111;
            overflow: hidden;
          }
          .print-page:last-child {
            page-break-after: auto;
          }
          .print-footer {
            position: absolute;
            bottom: 6mm;
            right: 12mm;
            font-size: 9px;
            color: #888;
          }
          /* 인쇄 시 카드 배경/테두리를 종이에 잘 보이게 */
          .print-page * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
