'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const VERSIONS = [
  { value: 'v3', label: 'v3 — 최신', file: '/docs/tech-architecture-v3.html', badge: '최신' },
];

const VERSION_MAP: Record<string, { file: string; badge: string }> = {
  v3: { file: '/docs/tech-architecture-v3.html', badge: '최신' },
  latest: { file: '/docs/tech-architecture-v3.html', badge: '최신' },
};

const TABS = [
  { icon: '🏠', label: '전체 개요', desc: '기술 선택 이유 · CSS 애니메이션 데이터 흐름' },
  { icon: '🌐', label: '프론트엔드', desc: 'Next.js 15 · tRPC 권한 6단계 · SSE 수명주기' },
  { icon: '⚡', label: 'BullMQ · 워커', desc: 'FlowProducer 트리 · 워커 설정 수치 · FSM' },
  { icon: '📡', label: '수집기 9종', desc: 'Rate Limit · Playwright vs Fetch · 중복제거' },
  { icon: '🔧', label: '파이프라인', desc: 'Normalize → Persist · upsert SQL · 임베딩' },
  { icon: '🤖', label: 'AI 분석 Stage', desc: 'Gantt 타임라인 · 8개 도메인 · Map-Reduce 청킹' },
  { icon: '🧮', label: 'Vector DB', desc: 'pgvector · RAG 3모드 · 시맨틱 검색 SQL' },
  { icon: '🕸️', label: 'Graph DB', desc: '온톨로지 · D3.js 인터랙티브 그래프 (드래그)' },
  { icon: '💡', label: 'AI 프로바이더', desc: '10개 비교표 · Gemini CLI OAuth · 가격표' },
  { icon: '🗄️', label: 'DB 전체 맵', desc: '24개 테이블 ERD · FK 관계 · 클릭 상세' },
  { icon: '🚀', label: '배포 · 인프라', desc: 'CI/CD 플로우 · Docker Multi-stage · 체크리스트' },
  { icon: '🔧', label: '유지보수', desc: '헬스체크 · 자동복구 3종 · 장애대응 표' },
];

const STATS = [
  { value: '9개', label: '데이터 수집 소스', color: 'text-green-500', bg: 'bg-green-500/10' },
  { value: '42+', label: 'AI 분석 모듈', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { value: '24개', label: 'DB 테이블', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { value: '10개', label: 'AI 프로바이더', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { value: '12개', label: '문서 탭', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { value: '8개', label: '분석 도메인', color: 'text-pink-500', bg: 'bg-pink-500/10' },
];

export default function TechArchitecturePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <TechArchitectureContent />
    </Suspense>
  );
}

function TechArchitectureContent() {
  const searchParams = useSearchParams();
  const versionParam = searchParams.get('version') ?? 'latest';
  const resolved = VERSION_MAP[versionParam] ?? VERSION_MAP['latest'];

  const [selectedVersion, setSelectedVersion] = useState(
    versionParam === 'latest' ? 'v3' : versionParam in VERSION_MAP ? versionParam : 'v3',
  );
  const [fullscreen, setFullscreen] = useState(false);

  const currentFile = VERSION_MAP[selectedVersion]?.file ?? resolved.file;
  const currentBadge = VERSION_MAP[selectedVersion]?.badge ?? resolved.badge;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* 헤더 */}
      <div>
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          문서 허브로
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🏗️</span>
              <h1 className="text-2xl font-bold">시스템 아키텍처 완전 기술 문서</h1>
              <Badge variant="default">{currentBadge}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              수집 → 분석 → 배포 → 유지보수까지 전체 생애주기 · 초보자도 이해 가능한 인터랙티브 문서
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* 버전 선택 */}
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="rounded-md border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer"
            >
              {VERSIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
            <a
              href={currentFile}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />새 탭에서 열기
            </a>
          </div>
        </div>
      </div>

      {/* 수치 요약 */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {STATS.map((s) => (
          <div key={s.label} className={`rounded-lg ${s.bg} px-3 py-2.5 text-center`}>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 탭 구성 미리보기 */}
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">문서 구성 — 12개 탭</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {TABS.map((tab) => (
            <div
              key={tab.label}
              className="flex items-start gap-2 rounded-md bg-muted/40 px-2.5 py-2"
            >
              <span className="text-base shrink-0 leading-none mt-0.5">{tab.icon}</span>
              <div>
                <div className="text-xs font-semibold">{tab.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{tab.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* iframe 뷰어 */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
          <span className="text-sm font-medium">인터랙티브 문서 뷰어</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFullscreen(!fullscreen)}
            className="h-7 gap-1.5 text-xs"
          >
            {fullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                축소
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                전체 화면
              </>
            )}
          </Button>
        </div>
        <iframe
          src={currentFile}
          className="w-full border-0"
          style={{ height: fullscreen ? 'calc(100vh - 180px)' : '75vh', minHeight: '500px' }}
          title="AI SignalCraft 완전 기술 아키텍처"
        />
      </div>
    </div>
  );
}
