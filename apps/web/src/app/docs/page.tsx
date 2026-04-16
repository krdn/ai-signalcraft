import { redirect } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { getSidebarTree } from '@/lib/docs';

export default async function DocsPage() {
  const tree = await getSidebarTree();
  const first = tree[0]?.docs[0];

  if (first) {
    redirect(`/docs/${first.category}/${first.slug}`);
  }

  // 문서가 없는 경우 빈 상태 UI
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">문서가 없습니다</h2>
      <p className="text-muted-foreground text-sm">
        <code className="font-mono bg-muted px-1.5 py-0.5 rounded">docs/</code> 폴더에 마크다운
        파일을 추가하세요.
      </p>
    </div>
  );
}
