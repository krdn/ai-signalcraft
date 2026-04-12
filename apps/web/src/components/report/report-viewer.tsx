'use client';

import { useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ReportViewerProps {
  markdownContent: string;
  onActiveSectionChange?: (sectionId: string) => void;
}

/**
 * 섹션 제목에서 id 생성 (예: "1. 종합 개요" -> "1-종합-개요")
 */
function generateSectionId(text: string): string {
  return text
    .replace(/\s+/g, '-')
    .replace(/[^가-힣a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

/**
 * 마크다운 리포트 뷰어
 * - react-markdown + remark-gfm으로 렌더링
 * - IntersectionObserver로 현재 보이는 섹션 감지
 * - UI-SPEC 타이포그래피 준수
 */
export function ReportViewer({ markdownContent, onActiveSectionChange }: ReportViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver로 현재 보이는 h2 섹션 추적
  const setupObserver = useCallback(() => {
    if (!contentRef.current || !onActiveSectionChange) return;

    const headings = contentRef.current.querySelectorAll('h2[id], h3[id]');
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 화면에 보이는 첫 번째 heading을 활성 섹션으로 설정
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onActiveSectionChange(entry.target.id);
            break;
          }
        }
      },
      {
        rootMargin: '-48px 0px -60% 0px',
        threshold: 0.1,
      },
    );

    headings.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, [onActiveSectionChange]);

  useEffect(() => {
    // 마크다운 렌더링 후 약간 지연하여 Observer 설정
    const timer = setTimeout(setupObserver, 100);
    return () => clearTimeout(timer);
  }, [markdownContent, setupObserver]);

  return (
    <ScrollArea className="flex-1 max-w-3xl">
      <div ref={contentRef} className="px-4 py-6 md:px-8">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children, ...props }) => {
              const text = String(children);
              const id = generateSectionId(text);
              return (
                <h2
                  id={id}
                  className="text-lg font-semibold leading-tight mt-8 mb-4 scroll-mt-16 border-b pb-2"
                  {...props}
                >
                  {children}
                </h2>
              );
            },
            h3: ({ children, ...props }) => {
              const text = String(children);
              const id = generateSectionId(text);
              return (
                <h3
                  id={id}
                  className="text-base font-semibold leading-snug mt-6 mb-3 scroll-mt-16"
                  {...props}
                >
                  {children}
                </h3>
              );
            },
            p: ({ children, ...props }) => (
              <p className="text-sm leading-relaxed mb-3" {...props}>
                {children}
              </p>
            ),
            ul: ({ children, ...props }) => (
              <ul className="list-disc pl-6 space-y-1 mb-3 text-sm" {...props}>
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol className="list-decimal pl-6 space-y-1 mb-3 text-sm" {...props}>
                {children}
              </ol>
            ),
            li: ({ children, ...props }) => (
              <li className="leading-relaxed" {...props}>
                {children}
              </li>
            ),
            blockquote: ({ children, ...props }) => (
              <blockquote
                className="border-l-4 border-accent pl-4 py-2 my-4 bg-secondary/30 rounded-r text-sm italic"
                {...props}
              >
                {children}
              </blockquote>
            ),
            code: ({ children, className, ...props }) => {
              // 인라인 코드
              if (!className) {
                return (
                  <code className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded" {...props}>
                    {children}
                  </code>
                );
              }
              // 코드 블록
              return (
                <code
                  className="font-mono text-xs block bg-secondary p-4 rounded-lg overflow-x-auto my-3"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            pre: ({ children, ...props }) => (
              <pre className="my-3" {...props}>
                {children}
              </pre>
            ),
            table: ({ children, ...props }) => (
              <div className="my-4 rounded-md border overflow-x-auto">
                <Table {...props}>{children}</Table>
              </div>
            ),
            thead: ({ children, ...props }) => <TableHeader {...props}>{children}</TableHeader>,
            tbody: ({ children, ...props }) => <TableBody {...props}>{children}</TableBody>,
            tr: ({ children, ...props }) => <TableRow {...props}>{children}</TableRow>,
            th: ({ children, ...props }) => (
              <TableHead className="text-xs font-semibold" {...props}>
                {children}
              </TableHead>
            ),
            td: ({ children, ...props }) => (
              <TableCell className="text-sm" {...props}>
                {children}
              </TableCell>
            ),
            strong: ({ children, ...props }) => (
              <strong className="font-semibold" {...props}>
                {children}
              </strong>
            ),
            hr: (props) => <hr className="my-6 border-border" {...props} />,
          }}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    </ScrollArea>
  );
}
