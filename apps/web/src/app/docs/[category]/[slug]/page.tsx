import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import { getDoc, getAdjacentDocs, getAllDocPaths } from '@/lib/docs';
import { DocNav } from '@/components/docs/doc-nav';
import { mdxComponents } from '@/components/docs/mdx-components';

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateStaticParams() {
  const paths = await getAllDocPaths();
  return paths;
}

export async function generateMetadata({ params }: Props) {
  const { category, slug } = await params;
  const doc = await getDoc(category, slug);
  if (!doc) return {};
  return {
    title: `${doc.title} — AI SignalCraft 문서`,
    description: doc.description,
  };
}

export default async function DocPage({ params }: Props) {
  const { category, slug } = await params;
  const [doc, adjacent] = await Promise.all([
    getDoc(category, slug),
    getAdjacentDocs(category, slug),
  ]);

  if (!doc) notFound();

  return (
    <article className="max-w-3xl w-full">
      {/* 문서 제목 영역 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{doc.title}</h1>
        {doc.description && <p className="text-muted-foreground text-lg">{doc.description}</p>}
      </div>

      {/* 마크다운 콘텐츠 */}
      <div className="max-w-none">
        <MDXRemote
          source={doc.content}
          options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
          components={mdxComponents}
        />
      </div>

      {/* 이전/다음 네비게이션 */}
      <DocNav prev={adjacent.prev} next={adjacent.next} />
    </article>
  );
}
