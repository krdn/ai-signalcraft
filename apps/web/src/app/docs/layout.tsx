import Link from 'next/link';
import { BookOpen, Home } from 'lucide-react';
import { getSidebarTree } from '@/lib/docs';
import { DocsSidebar } from '@/components/docs/sidebar';

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const tree = await getSidebarTree();

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header
        aria-label="문서 상단 바"
        className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="flex h-14 items-center gap-4 px-6 max-w-7xl mx-auto">
          <Link href="/docs" className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>문서 허브</span>
          </Link>
          <span className="text-muted-foreground/50">|</span>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            대시보드
          </Link>
        </div>
      </header>

      {/* 본문: 사이드바 + 콘텐츠 */}
      <div className="flex max-w-7xl mx-auto">
        <DocsSidebar tree={tree} />
        <main aria-label="문서 콘텐츠" className="flex-1 px-8 py-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
