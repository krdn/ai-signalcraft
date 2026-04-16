import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DocMeta } from '@/lib/docs';

interface DocNavProps {
  prev: DocMeta | null;
  next: DocMeta | null;
}

export function DocNav({ prev, next }: DocNavProps) {
  if (!prev && !next) return null;

  return (
    <nav className="flex items-center justify-between pt-8 mt-8 border-t">
      {prev ? (
        <Link
          href={`/docs/${prev.category}/${prev.slug}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <div className="text-left">
            <div className="text-xs text-muted-foreground mb-0.5">이전</div>
            <div className="font-medium text-foreground">{prev.title}</div>
          </div>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          href={`/docs/${next.category}/${next.slug}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-0.5">다음</div>
            <div className="font-medium text-foreground">{next.title}</div>
          </div>
          <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
