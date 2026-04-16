'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Briefcase, Code, Folder, Megaphone, Menu } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { SidebarCategory } from '@/lib/docs';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  briefcase: Briefcase,
  megaphone: Megaphone,
  code: Code,
  book: BookOpen,
  folder: Folder,
};

interface DocsSidebarProps {
  tree: SidebarCategory[];
}

function SidebarContent({ tree }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <ScrollArea className="h-full py-4">
      <nav className="px-3 space-y-1">
        {tree.map((category) => {
          const Icon = ICON_MAP[category.icon] ?? Folder;
          return (
            <div key={category.slug} className="mb-4">
              {/* 카테고리 헤더 */}
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {category.label}
                </span>
              </div>

              {/* 문서 목록 */}
              <ul className="space-y-0.5">
                {category.docs.map((doc) => {
                  const href = `/docs/${doc.category}/${doc.slug}`;
                  const isActive = pathname === href;
                  return (
                    <li key={doc.slug}>
                      <Link
                        href={href}
                        className={cn(
                          'block rounded-md px-3 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {doc.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <Separator className="mt-3" />
            </div>
          );
        })}
      </nav>
    </ScrollArea>
  );
}

export function DocsSidebar({ tree }: DocsSidebarProps) {
  return (
    <>
      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r h-[calc(100vh-3.5rem)] sticky top-14">
        <SidebarContent tree={tree} />
      </aside>

      {/* 모바일 드로어 */}
      <div className="md:hidden fixed bottom-4 right-4 z-50">
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" size="icon" className="rounded-full shadow-lg">
                <Menu className="h-5 w-5" />
              </Button>
            }
          />
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="font-semibold">문서 허브</span>
            </div>
            <SidebarContent tree={tree} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
