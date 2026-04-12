'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, FileText } from 'lucide-react';
import { SectionNav, type Section } from './section-nav';
import { ReportViewer } from './report-viewer';
import { ReportHelp } from './report-help';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ReportViewProps {
  jobId: number | null;
  /** 공개 페이지에서 사용할 대체 데이터 페칭 함수 */
  fetchFn?: (jobId: number) => Promise<{
    title: string;
    oneLiner: string | null;
    markdownContent: string;
    metadata: unknown;
  } | null>;
}

/**
 * 마크다운에서 `## N. 제목` 또는 `### N. 제목` 패턴을 파싱하여 섹션 배열 생성
 * AI 모델에 따라 ## 또는 ### 로 섹션을 생성하는 경우가 있어 둘 다 지원
 */
function parseSections(markdown: string): Section[] {
  // ## 섹션이 2개 이상이면 ## 기준, 아니면 ### 기준으로 파싱
  const h2Matches = markdown.match(/^## .+$/gm) ?? [];
  const regex = h2Matches.length >= 2 ? /^## (.+)$/gm : /^### (.+)$/gm;
  const sections: Section[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const title = match[1].trim();
    const id = title
      .replace(/\s+/g, '-')
      .replace(/[^가-힣a-zA-Z0-9-]/g, '')
      .toLowerCase();
    sections.push({ id, title });
  }
  return sections;
}

/**
 * AI 리포트 뷰 컨테이너
 * - tRPC로 리포트 조회
 * - SectionNav + ReportViewer 레이아웃
 * - PDF 내보내기 버튼
 */
export function ReportView({ jobId, fetchFn }: ReportViewProps) {
  const [activeSection, setActiveSection] = useState('');

  const defaultFetch = (id: number) => trpcClient.report.getByJobId.query({ jobId: id });
  const queryFnToUse = fetchFn ?? defaultFetch;

  const { data: report, isLoading } = useQuery({
    queryKey: fetchFn ? ['showcase', 'getReport', jobId] : ['report', 'getByJobId', jobId],
    queryFn: () => queryFnToUse(jobId!),
    enabled: jobId !== null,
    staleTime: fetchFn ? Infinity : undefined,
  });

  const sections = useMemo(() => {
    if (!report?.markdownContent) return [];
    return parseSections(report.markdownContent);
  }, [report?.markdownContent]);

  // PDF 내보내기 -- window.print() 기반 간이 PDF
  const handleExportPdf = () => {
    window.print();
  };

  // jobId 미선택 상태
  if (jobId === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-semibold">리포트를 선택해 주세요</p>
        <p className="text-sm mt-2">
          분석 실행 탭에서 새 분석을 시작하거나, 히스토리에서 이전 결과를 선택하세요.
        </p>
      </div>
    );
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex flex-row">
        {/* 사이드바 스켈레톤 */}
        <div className="hidden md:block w-[200px] shrink-0 p-4 space-y-3 border-r">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        {/* 콘텐츠 스켈레톤 */}
        <div className="flex-1 max-w-3xl p-8 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  // 리포트 없음
  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-semibold">리포트 없음</p>
        <p className="text-sm mt-2">이 분석에 대한 리포트가 아직 생성되지 않았습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* 상단: 리포트 메타데이터 + 도움말/PDF */}
      <div className="flex items-start justify-between px-4 py-4 md:px-8 border-b print:hidden">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold leading-tight">{report.title}</h1>
          {report.oneLiner && (
            <p className="text-sm border-l-2 border-accent pl-3 text-muted-foreground">
              {report.oneLiner}
            </p>
          )}
          {report.metadata != null &&
            (() => {
              const meta = report.metadata as {
                generatedAt?: string;
                totalTokens?: number;
                reportModel?: { provider: string; model: string };
              };
              return (
                <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                  {meta.generatedAt && <span>{meta.generatedAt}</span>}
                  {meta.reportModel && (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                      {meta.reportModel.provider}/{meta.reportModel.model}
                    </span>
                  )}
                  {meta.totalTokens != null && meta.totalTokens > 0 && (
                    <span className="text-[10px]">{meta.totalTokens.toLocaleString()} 토큰</span>
                  )}
                </div>
              );
            })()}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ReportHelp />
          <Button variant="secondary" size="sm" onClick={handleExportPdf} className="gap-2">
            <FileDown className="h-4 w-4" />
            PDF 내보내기
          </Button>
        </div>
      </div>

      {/* 본문: 섹션 네비 + 마크다운 뷰어 */}
      <div className="flex flex-col md:flex-row">
        <SectionNav sections={sections} activeSection={activeSection} />
        <ReportViewer
          markdownContent={report.markdownContent}
          onActiveSectionChange={setActiveSection}
        />
      </div>
    </div>
  );
}
