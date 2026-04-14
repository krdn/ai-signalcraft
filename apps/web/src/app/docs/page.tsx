import Link from 'next/link';
import { BookOpen, Bot, ExternalLink, Layers, Settings, Share2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const VERSIONS = [
  {
    version: 'v3',
    label: '최신',
    badge: '현재',
    badgeVariant: 'default' as const,
    desc: '12개 탭 · D3.js 인터랙티브 그래프 · AI 프로바이더 10개 비교 · Vector/Graph DB 추가',
    href: '/docs/tech-architecture?version=v3',
    directHref: '/docs/tech-architecture-v3.html',
    color: 'border-primary/40 bg-primary/5',
  },
];

const USE_CASES = [
  {
    icon: Settings,
    title: '유지보수 팀',
    desc: '최신 아키텍처 문서를 확인하고 시스템 구조를 파악합니다.',
    link: '/docs/tech-architecture?version=v3',
    linkLabel: '최신 문서 열기',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Share2,
    title: '영업 팀',
    desc: '고객사 미팅 시 기술 문서를 직접 공유하거나 링크를 전달합니다.',
    link: '/sales/share-links',
    linkLabel: '공유 링크 관리',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
  {
    icon: Users,
    title: '파트너',
    desc: '파트너 포털에서 기술 문서와 인프라 정보를 확인합니다.',
    link: '/partner/tech-docs',
    linkLabel: '파트너 기술자료',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
];

export default function DocsPage() {
  return (
    <div className="space-y-10 max-w-5xl">
      {/* 헤더 */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">기술 문서 허브</h1>
        </div>
        <p className="text-muted-foreground">
          AI SignalCraft 시스템 아키텍처 문서를 버전별로 관리하고 용도에 맞게 활용하세요.
        </p>
      </div>

      {/* 문서 버전 목록 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">시스템 아키텍처 문서</h2>
        </div>

        <div className="space-y-3">
          {VERSIONS.map((v) => (
            <div key={v.version} className={`rounded-lg border p-5 ${v.color}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-xl border">
                    🏗️
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold">시스템 아키텍처 완전 기술 문서</span>
                      <Badge variant={v.badgeVariant}>{v.badge}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{v.version}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{v.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={v.href}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    문서 보기
                  </Link>
                  <a
                    href={v.directHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />새 탭
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI 모델 설정 문서 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">AI 모델 설정 문서</h2>
        </div>

        <div className="rounded-lg border p-5 border-orange-400/40 bg-orange-500/5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-xl border">
                🤖
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold">LLM 모델 추천 가이드</span>
                  <Badge variant="secondary">2026-04-14</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  분석 모듈별 최고/보통/최소 티어 추천 · 한국어 성능 비교 · 시나리오 프리셋
                  업그레이드 가이드
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/docs/llm-model-recommendations.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />새 탭
              </a>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-md bg-background border px-3 py-2">
              <p className="font-medium text-xs text-muted-foreground mb-1">최고 티어</p>
              <p>Gemini 2.5 Pro · Claude Opus 4.6</p>
            </div>
            <div className="rounded-md bg-background border px-3 py-2">
              <p className="font-medium text-xs text-muted-foreground mb-1">보통 티어 (권장)</p>
              <p>Gemini 2.5 Flash · Claude Sonnet 4.6</p>
            </div>
            <div className="rounded-md bg-background border px-3 py-2">
              <p className="font-medium text-xs text-muted-foreground mb-1">최소 티어</p>
              <p>Gemini Flash-Lite · Claude Haiku 4.5</p>
            </div>
          </div>
        </div>
      </section>

      {/* 용도별 빠른 링크 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">용도별 바로가기</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {USE_CASES.map((uc) => {
            const Icon = uc.icon;
            return (
              <Card key={uc.title}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`rounded-lg ${uc.bg} p-2`}>
                      <Icon className={`h-4 w-4 ${uc.color}`} />
                    </div>
                    <CardTitle className="text-base">{uc.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{uc.desc}</p>
                  <Link
                    href={uc.link}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {uc.linkLabel}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
