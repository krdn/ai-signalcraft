import type { AnalysisModuleResult } from '../analysis/types';
import type { AnalysisDomain } from '../analysis/domain';

// 리포트 생성 입력 (per D-02, from generator.ts)
export interface ReportGenerationInput {
  jobId: number;
  keyword: string;
  dateRange: { start: Date; end: Date };
  results: Record<string, AnalysisModuleResult>;
  completedModules: string[];
  failedModules: string[];
  domain?: AnalysisDomain;
}

// PDF 내보내기 옵션 (per D-02, from pdf-exporter.ts)
export interface PdfExportOptions {
  title?: string;
  format?: 'A4' | 'Letter';
  margin?: { top?: string; bottom?: string; left?: string; right?: string };
}
