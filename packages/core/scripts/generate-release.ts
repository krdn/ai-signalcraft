/**
 * Git 커밋 범위를 읽어 AI 요약 후 releases + release_entries 를 draft 상태로 insert.
 *
 * 사용: tsx scripts/generate-release.ts --from <sha> --to <sha> --gh-sha <sha>
 *
 * 실패 시에도 배포는 막지 않도록 에러를 stderr에 출력하고 exit 0.
 * AI 호출 실패 시 원본 커밋 메시지로 fallback entry 생성.
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { eq, sql as drizzleSql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../src/db';
import { releases, releaseEntries } from '../src/db/schema';

type CategoryType = 'feature' | 'fix' | 'pipeline' | 'chore' | 'breaking';
type ScopeType = 'user' | 'internal';

interface RawCommit {
  sha: string;
  author: string;
  subject: string;
  body: string;
  files: string[];
}

interface ClassifiedCommit extends RawCommit {
  category: CategoryType;
  scope: ScopeType;
}

const AIEntrySchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.enum(['feature', 'fix', 'pipeline', 'chore', 'breaking']),
  scope: z.enum(['user', 'internal']),
});

const AIResponseSchema = z.object({
  summary: z.string(),
  entries: z.array(AIEntrySchema),
});

function parseArgs(): { from: string; to: string; ghSha: string } {
  const args = process.argv.slice(2);
  const get = (k: string) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const from = get('from');
  const to = get('to');
  const ghSha = get('gh-sha');
  if (!from || !to || !ghSha) {
    throw new Error('Missing required args: --from --to --gh-sha');
  }
  return { from, to, ghSha };
}

function collectCommits(from: string, to: string): RawCommit[] {
  // git log --format 으로 커밋 메타 수집 후 각 SHA별로 파일 목록 조회
  const DELIM = '\x1e';
  const RECORD = '\x1f';
  const format = ['%H', '%an', '%s', '%b'].join(DELIM);
  const raw = execSync(`git log --no-merges --pretty=format:"${format}${RECORD}" ${from}..${to}`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });

  return raw
    .split(RECORD)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((rec) => {
      const [sha, author, subject, body] = rec.split(DELIM);
      let files: string[];
      try {
        files = execSync(`git show --name-only --pretty=format: ${sha}`, {
          encoding: 'utf-8',
        })
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
      } catch {
        files = [];
      }
      return {
        sha: sha.trim(),
        author: author.trim(),
        subject: subject.trim(),
        body: (body ?? '').trim(),
        files,
      };
    });
}

function classify(commit: RawCommit): ClassifiedCommit {
  const subject = commit.subject.toLowerCase();

  let category: CategoryType = 'chore';
  if (/breaking change/i.test(commit.body) || subject.startsWith('feat!')) {
    category = 'breaking';
  } else if (subject.startsWith('feat')) {
    category = 'feature';
  } else if (subject.startsWith('fix')) {
    category = 'fix';
  } else if (/^(refactor|chore|style|test|docs)/.test(subject)) {
    category = 'chore';
  }

  // 파일 경로 기반 pipeline/scope 판정
  const pipelinePaths = [
    'packages/core/src/analysis/',
    'packages/collectors/',
    'packages/insight-engine/',
    'packages/insight-gateway/',
  ];
  const userPaths = ['apps/web/', 'packages/core/src/db/'];

  const pipelineCount = commit.files.filter((f) =>
    pipelinePaths.some((p) => f.startsWith(p)),
  ).length;
  const userCount = commit.files.filter((f) => userPaths.some((p) => f.startsWith(p))).length;
  const total = commit.files.length || 1;

  if (pipelineCount / total >= 0.5 && category === 'chore') {
    category = 'pipeline';
  }

  let scope: ScopeType = 'internal';
  if (category === 'feature' || category === 'fix' || category === 'breaking') {
    scope = 'user';
  } else if (userCount / total >= 0.5) {
    scope = 'user';
  }

  return { ...commit, category, scope };
}

async function callAnthropic(
  commits: ClassifiedCommit[],
): Promise<z.infer<typeof AIResponseSchema> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[generate-release] ANTHROPIC_API_KEY not set, skipping AI summary');
    return null;
  }

  const systemPrompt = `너는 AI SignalCraft(여론 분석 서비스) 릴리스 노트 작성 도우미다.
개발자 커밋 메시지를 3~10명 규모 팀의 비개발자 사용자가 이해할 수 있게 한국어로 설명한다.
'무엇이 달라지는지' 중심으로 작성하고, 기술 용어는 최소화한다.
반드시 아래 JSON 스키마에 맞춰 응답한다. 추가 텍스트 없이 JSON만 출력.

{
  "summary": "한 줄 요약 (배포 전체의 핵심, 50자 이내)",
  "entries": [
    {
      "title": "사용자 친화적 제목 (40자 이내)",
      "description": "상세 설명 (1~2문장)",
      "category": "feature | fix | pipeline | chore | breaking",
      "scope": "user | internal"
    }
  ]
}

규칙:
- entries는 입력 커밋과 동일한 순서, 동일한 개수로 반환
- category/scope는 입력으로 주어진 값을 유지
- chore/internal 항목도 반드시 포함 (생략 금지)`;

  const userPrompt = commits
    .map(
      (c, i) =>
        `[${i + 1}] category=${c.category} scope=${c.scope}
subject: ${c.subject}
body: ${c.body || '(없음)'}
files: ${c.files.slice(0, 5).join(', ')}${c.files.length > 5 ? ` ...외 ${c.files.length - 5}개` : ''}`,
    )
    .join('\n\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      console.error('[generate-release] Anthropic API error:', res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[generate-release] No JSON in AI response');
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return AIResponseSchema.parse(parsed);
  } catch (err) {
    console.error('[generate-release] AI call failed:', err);
    return null;
  }
}

async function computeVersion(): Promise<string> {
  const db = getDb();
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const datePrefix = `${y}.${m}.${d}`;

  const existing = await db
    .select({ version: releases.version })
    .from(releases)
    .where(drizzleSql`${releases.version} LIKE ${`${datePrefix}-%`}`);

  return `${datePrefix}-${existing.length + 1}`;
}

async function main() {
  const { from, to, ghSha } = parseArgs();
  const db = getDb();

  // 중복 방지: 같은 gitShaTo로 이미 release가 있으면 스킵
  const [existing] = await db
    .select({ id: releases.id })
    .from(releases)
    .where(eq(releases.gitShaTo, ghSha))
    .limit(1);

  if (existing) {
    console.warn(`[generate-release] Release for ${ghSha} already exists (id=${existing.id})`);
    process.stdout.write(String(existing.id));
    process.exit(0);
  }

  const raw = collectCommits(from, to);
  if (raw.length === 0) {
    console.warn('[generate-release] No commits in range, nothing to do');
    process.exit(0);
  }

  const classified = raw.map(classify);
  const aiResult = await callAnthropic(classified);

  const version = await computeVersion();

  const [release] = await db
    .insert(releases)
    .values({
      version,
      gitShaFrom: from,
      gitShaTo: ghSha,
      summary: aiResult?.summary ?? null,
      status: 'draft',
    })
    .returning();

  const entries = classified.map((c, i) => {
    const ai = aiResult?.entries[i];
    return {
      releaseId: release.id,
      category: ai?.category ?? c.category,
      scope: ai?.scope ?? c.scope,
      title: ai?.title ?? c.subject,
      description: (ai?.description ?? c.body) || null,
      originalMessage: `${c.subject}${c.body ? '\n\n' + c.body : ''}`,
      commitSha: c.sha,
      authorName: c.author,
      order: i,
    };
  });

  await db.insert(releaseEntries).values(entries);

  console.warn(
    `[generate-release] Created release ${version} (id=${release.id}) with ${entries.length} entries`,
  );
  process.stdout.write(String(release.id));
  process.exit(0);
}

main().catch((err) => {
  console.error('[generate-release] fatal error:', err);
  // 배포 파이프라인 보호 — 실패해도 exit 0
  process.exit(0);
});
