import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// 모노레포 루트의 docs/ 폴더 경로
const DOCS_ROOT = path.join(process.cwd(), '../../docs');

export interface CategoryMeta {
  slug: string;
  label: string;
  icon: string;
  order: number;
}

export interface DocMeta {
  slug: string;
  category: string;
  title: string;
  description?: string;
  order: number;
  tags?: string[];
}

export interface SidebarCategory extends CategoryMeta {
  docs: DocMeta[];
}

export interface DocContent extends DocMeta {
  content: string;
}

// superpowers, excalidraw 등 내부 폴더 제외
const EXCLUDED_DIRS = ['superpowers'];

/**
 * docs/ 하위 카테고리 목록 반환 (order 정렬)
 */
export async function getAllCategories(): Promise<CategoryMeta[]> {
  const entries = fs.readdirSync(DOCS_ROOT, { withFileTypes: true });
  const categories: CategoryMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (EXCLUDED_DIRS.includes(entry.name)) continue;

    const slug = entry.name;
    const categoryJsonPath = path.join(DOCS_ROOT, slug, '_category.json');

    if (fs.existsSync(categoryJsonPath)) {
      const raw = fs.readFileSync(categoryJsonPath, 'utf-8');
      const meta = JSON.parse(raw);
      categories.push({
        slug,
        label: meta.label ?? slug,
        icon: meta.icon ?? 'folder',
        order: meta.order ?? 999,
      });
    } else {
      // _category.json 없으면 폴더명 폴백, order 마지막
      categories.push({
        slug,
        label: slug,
        icon: 'folder',
        order: 999,
      });
    }
  }

  return categories.sort((a, b) => a.order - b.order);
}

/**
 * 특정 카테고리의 문서 목록 반환 (order 정렬)
 */
export async function getDocsByCategory(category: string): Promise<DocMeta[]> {
  const categoryDir = path.join(DOCS_ROOT, category);

  if (!fs.existsSync(categoryDir)) return [];

  const files = fs.readdirSync(categoryDir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));

  const docs: DocMeta[] = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const filePath = path.join(categoryDir, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(raw);

    docs.push({
      slug,
      category,
      title: data.title ?? slug,
      description: data.description,
      order: data.order ?? 999,
      tags: data.tags,
    });
  }

  return docs.sort((a, b) => a.order - b.order);
}

/**
 * 단일 문서 내용 반환
 */
export async function getDoc(category: string, slug: string): Promise<DocContent | null> {
  const filePath = path.join(DOCS_ROOT, category, `${slug}.md`);

  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    slug,
    category,
    title: data.title ?? slug,
    description: data.description,
    order: data.order ?? 999,
    tags: data.tags,
    content,
  };
}

/**
 * 전체 사이드바 트리 반환
 */
export async function getSidebarTree(): Promise<SidebarCategory[]> {
  const categories = await getAllCategories();
  const tree: SidebarCategory[] = [];

  for (const cat of categories) {
    const docs = await getDocsByCategory(cat.slug);
    tree.push({ ...cat, docs });
  }

  return tree;
}

/**
 * 이전/다음 문서 반환
 */
export async function getAdjacentDocs(
  category: string,
  slug: string,
): Promise<{ prev: DocMeta | null; next: DocMeta | null }> {
  const tree = await getSidebarTree();
  const allDocs = tree.flatMap((cat) => cat.docs);

  const idx = allDocs.findIndex((d) => d.category === category && d.slug === slug);

  return {
    prev: idx > 0 ? allDocs[idx - 1] : null,
    next: idx < allDocs.length - 1 ? allDocs[idx + 1] : null,
  };
}

/**
 * generateStaticParams용 전체 경로 목록
 */
export async function getAllDocPaths(): Promise<Array<{ category: string; slug: string }>> {
  const tree = await getSidebarTree();
  return tree.flatMap((cat) => cat.docs.map((doc) => ({ category: cat.slug, slug: doc.slug })));
}
