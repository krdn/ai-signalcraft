'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MousePointer2,
  Server,
  Database,
  ListOrdered,
  Globe2,
  Brain,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Copy,
  Check,
  FileCode,
  Table as TableIcon,
  Workflow,
  ArrowRight,
  HelpCircle,
  Sparkles,
  MessageSquarePlus,
  Wrench,
  AlertTriangle,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────────────────────
// Ref ID 규약
// ──────────────────────────────────────────────────────────────
//
// 사용자와의 소통을 위한 고유 식별자 규약:
//
//   @ais:wf/<stage>                         → 단계 전체
//   @ais:wf/<stage>/file/<nn>                → 특정 파일
//   @ais:wf/<stage>/table/<nn>               → 특정 테이블/구성
//   @ais:wf/<stage>/fn/<nn>                  → 특정 함수
//   @ais:wf/<stage>/behavior/<nn>            → 특정 동작
//   @ais:wf/principle/<nn>                   → 설계 원칙
//
// 예)  "WF-QUEUE-02 수정해줘"  → @ais:wf/queue/file/02
//      "WF-ANALYZE 전체 설명"  → @ais:wf/analyze
//
// ──────────────────────────────────────────────────────────────

type StageKey = 'ui' | 'api' | 'db' | 'queue' | 'collect' | 'analyze' | 'status';

interface HelpBlock {
  what: string;
  why: string;
  howToChange: string[];
  relatedCommands?: string[];
  cautions?: string[];
}

interface RefItem {
  /** "01", "02" 같은 2자리 번호 */
  no: string;
  label: string;
  role: string;
  help?: HelpBlock;
}

interface RefFunction extends RefItem {
  signature: string;
}

interface StageDef {
  key: StageKey;
  index: number;
  code: string; // 예) "UI", "API"
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: {
    bg: string;
    border: string;
    text: string;
    dot: string;
    glow: string;
  };
  summary: string;
  stageHelp: HelpBlock;
  files: RefItem[];
  tables?: RefItem[];
  functions?: RefFunction[];
  behaviors: RefItem[];
  notes?: string[];
}

// ──────────────────────────────────────────────────────────────
// 워크플로우 7단계 정의
// ──────────────────────────────────────────────────────────────

const STAGES: StageDef[] = [
  {
    key: 'ui',
    index: 1,
    code: 'UI',
    title: 'UI 계층',
    subtitle: 'apps/web — 사용자 입력 & 실시간 모니터링',
    icon: MousePointer2,
    accent: {
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      border: 'border-sky-300 dark:border-sky-700',
      text: 'text-sky-700 dark:text-sky-300',
      dot: 'bg-sky-500',
      glow: 'shadow-sky-200 dark:shadow-sky-900/40',
    },
    summary: '사용자가 키워드·소스·주기를 등록하고, 실행 상태를 2초 폴링으로 실시간 관찰합니다.',
    stageHelp: {
      what: 'Next.js App Router 기반의 구독 관리 UI. 생성·수정·모니터링 모두 여기서 이뤄집니다.',
      why: '사용자에게 구독 생성과 결과 확인의 단일 창구를 제공하고, 2초 폴링으로 백엔드 작업 진행을 실시간 반영합니다.',
      howToChange: [
        '새 화면 추가 → apps/web/src/app/subscriptions/<route>/page.tsx',
        '공통 컴포넌트 → apps/web/src/components/subscriptions/',
        '상단 메뉴 탭 추가 → apps/web/src/app/subscriptions/layout.tsx의 NAV_ITEMS 배열',
      ],
      relatedCommands: ['pnpm dev', 'pnpm lint', 'pnpm format'],
      cautions: [
        '폴링 간격을 줄이면 서버 부하 증가',
        'tRPC 타입 변경 시 core DB 스키마까지 영향 전파 확인',
      ],
    },
    files: [
      {
        no: '01',
        label: 'apps/web/src/app/subscriptions/page.tsx',
        role: '구독 대시보드 메인 (KPI·목록·모니터링)',
        help: {
          what: '구독 목록 + KPI 카드 + 24시간 수집 항목 분류를 한 화면에 보여주는 대시보드입니다.',
          why: '사용자가 가장 자주 방문하는 진입점. 활성/일시중지 상태와 실행 이력을 종합해 빠르게 판단할 수 있어야 합니다.',
          howToChange: [
            'KPI 카드 수정 → SubscriptionKpiCards 컴포넌트',
            '필터 로직 → statusFilter state + SubscriptionStatusBar',
            '폴링 간격 조정 → refetchInterval 값 (기본 30_000 / 60_000ms)',
          ],
          cautions: ['24h 기준 runIds만 breakdown 쿼리 → 범위 바꿀 때 useMemo 키 확인'],
        },
      },
      {
        no: '02',
        label: 'apps/web/src/components/subscriptions/subscription-form.tsx',
        role: '생성·수정 폼 (프리셋 + 세밀 조정)',
        help: {
          what: '키워드, 소스 다중선택, 강도 프리셋(조용한/일반/급변), maxPerRun, commentsPerItem, YouTube 자막 옵션을 다루는 폼입니다.',
          why: '비개발자도 쉽게 수집 강도를 조절할 수 있도록 프리셋을 제공하고, 고급 사용자는 세부 숫자를 직접 조정할 수 있습니다.',
          howToChange: [
            '새 프리셋 추가 → PRESETS 상수에 정의 후 select 옵션 추가',
            '새 옵션 추가 → form state + trpc.subscriptions.create.mutate 인풋 타입 + Collector DB 스키마까지 3곳 동기화',
          ],
        },
      },
      {
        no: '03',
        label: 'apps/web/src/components/subscriptions/live-run-feed.tsx',
        role: '실행 중 작업 실시간 피드',
      },
      {
        no: '04',
        label: 'apps/web/src/components/subscriptions/run-progress-inline.tsx',
        role: '하트비트 (Live/Idle/Slow/Stalled)',
        help: {
          what: '2초 폴링으로 runProgress를 조회해 수집 진행률과 하트비트를 표시합니다.',
          why: '오래 걸리는 수집 작업이 멈춘 건지 진행 중인지 사용자가 즉시 구분할 수 있어야 합니다.',
          howToChange: [
            '하트비트 임계값(10/30/60초) 변경 → HEARTBEAT_THRESHOLDS 상수',
            '폴링 간격 변경 → refetchInterval (빠르게 하면 서버 부하↑)',
          ],
          cautions: ['lastProgressAtMs가 없으면 "기록 없음" 상태 — Stalled로 오판 금지'],
        },
      },
      {
        no: '05',
        label: 'apps/web/src/app/subscriptions/monitor/page.tsx',
        role: '중지·진단 모달 단일 진입점',
        help: {
          what: '실행 중 run에 대해 graceful/force 취소를 수행하는 전용 페이지입니다.',
          why: 'run 중지·진단은 단일 진입점으로 통합 관리해야 오동작·중복 요청을 방지할 수 있습니다.',
          howToChange: ['취소 모드 추가 → cancelRun tRPC의 mode union 확장'],
          cautions: ['DB run_cancellations 테이블을 수동 조작하지 말 것'],
        },
      },
    ],
    behaviors: [
      {
        no: '01',
        label: '구독 목록 30초 폴링, runs 60초 폴링, runProgress 2초 폴링',
        role: '페이지별 갱신 주기 차등',
      },
      {
        no: '02',
        label: '하트비트 판정: <10s Live · <30s Idle · <60s Slow · ≥60s Stalled',
        role: 'lastProgressAtMs 기반',
      },
      {
        no: '03',
        label: '프리셋(조용한/일반/급변) 또는 사용자 정의 maxPerRun/commentsPerItem',
        role: '수집 강도 조절 UX',
      },
      {
        no: '04',
        label: 'tRPC 호출: create · update · triggerNow · pause · resume · cancelRun',
        role: '주요 뮤테이션 집합',
      },
    ],
  },
  {
    key: 'api',
    index: 2,
    code: 'API',
    title: 'API 계층',
    subtitle: 'apps/web 프록시 → apps/collector 실제 구현',
    icon: Server,
    accent: {
      bg: 'bg-violet-50 dark:bg-violet-950/40',
      border: 'border-violet-300 dark:border-violet-700',
      text: 'text-violet-700 dark:text-violet-300',
      dot: 'bg-violet-500',
      glow: 'shadow-violet-200 dark:shadow-violet-900/40',
    },
    summary:
      'Web은 인증/소유권 검증 후 Collector tRPC로 전위임. Collector가 실제 DB·Queue 작업을 수행합니다.',
    stageHelp: {
      what: '2단 tRPC 구조입니다. Web 프록시는 세션 검증, Collector는 실제 쿼리·큐 삽입을 담당합니다.',
      why: 'Web/워커를 분리해 상호 스케일링과 장애 격리가 가능합니다. Web이 죽어도 스케줄러/워커는 계속 돕니다.',
      howToChange: [
        '새 API procedure 추가 → Collector 라우터에 먼저 구현 후 Web 프록시에 포워드',
        '스케줄 로직 변경 → scanner.ts와 source-window.ts 같이 확인',
      ],
      cautions: ['Web에서만 추가하면 실제 동작 안 함 — 반드시 Collector에 구현'],
    },
    files: [
      {
        no: '01',
        label: 'apps/web/src/server/trpc/routers/subscriptions.ts',
        role: 'tRPC 프록시 라우터 (인증·검증)',
      },
      {
        no: '02',
        label: 'apps/collector/src/server/trpc/subscriptions.ts',
        role: '실제 구현 (CRUD + triggerNow + dueForRun)',
      },
      {
        no: '03',
        label: 'apps/collector/src/scheduler/scanner.ts',
        role: '1분 주기 scanAndEnqueue',
        help: {
          what: '1분마다 active 구독 중 nextRunAt이 지난 것을 찾아 큐에 투입합니다.',
          why: '사용자 개입 없이 intervalHours 주기로 자동 수집되어야 하므로 필요한 유일한 백그라운드 잡입니다.',
          howToChange: [
            '스캔 주기 변경 → SCAN_INTERVAL_MS 상수',
            '한 번에 처리할 구독 수 → LIMIT 50',
          ],
          cautions: ['nextRunAt 선점을 먼저 해야 중복 enqueue 안 됨'],
        },
      },
      {
        no: '04',
        label: 'apps/collector/src/scheduler/source-window.ts',
        role: 'TTL 기반 windowed start 계산',
      },
    ],
    functions: [
      {
        no: '01',
        label: 'triggerNow',
        signature: '(id, sources?, ignoreCooldown?) → TriggerNowResult',
        role: '쿨다운 체크 → 소스별 window 계산 → enqueue × N → nextRunAt 선점',
        help: {
          what: '사용자가 "지금 수집" 버튼을 눌렀을 때 실행되는 수동 트리거 엔드포인트입니다.',
          why: '주기 수집 외에 급한 이슈가 터졌을 때 즉시 데이터를 보고 싶은 니즈가 있습니다.',
          howToChange: [
            '쿨다운 기간 변경 → MANUAL_TRIGGER_COOLDOWN_SEC',
            '특정 소스만 트리거 → sources 배열 인자 전달',
            '강제 트리거 → ignoreCooldown=true',
          ],
        },
      },
      {
        no: '02',
        label: 'computeSourceStartBatch',
        signature: '({subscriptionId, sources, now, overlapMs}) → Map<source, SourceWindow>',
        role: '소스별로 최근 items>0 성공 시각 기준 window 생성',
      },
      {
        no: '03',
        label: 'scanAndEnqueue',
        signature: '() → enqueuedCount',
        role: 'status=active AND nextRunAt<=NOW() 구독 스캔 후 큐 투입',
      },
    ],
    behaviors: [
      {
        no: '01',
        label: '쿨다운: MANUAL_TRIGGER_COOLDOWN_SEC=600 (ignoreCooldown으로 우회 가능)',
        role: '과도한 수동 트리거 방지',
      },
      {
        no: '02',
        label: 'nextRunAt은 enqueue 직후 선점 업데이트 → 중복 enqueue 방지',
        role: '원자성 보장',
      },
      {
        no: '03',
        label: '소스별 startISO는 각 소스의 최근 성공에서 intervalHours × 15% overlap 적용',
        role: 'Rolling overlap으로 누락 방지',
      },
      {
        no: '04',
        label: 'stale-fallback: 7일(MAX_STALENESS_MS) 초과 시 7일 전부터 재수집',
        role: '장기 미성공 소스 회복',
      },
    ],
    notes: [
      '소스별 독립 window 설계 이유: 전체 lastRunAt만 쓰면 한 소스 연속 0건일 때 영구 0건 고착됨',
    ],
  },
  {
    key: 'db',
    index: 3,
    code: 'DB',
    title: 'DB 스키마',
    subtitle: 'Collector DB + Core DB (이중 저장소)',
    icon: Database,
    accent: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-300 dark:border-emerald-700',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      glow: 'shadow-emerald-200 dark:shadow-emerald-900/40',
    },
    summary: '수집 메타·원본은 Collector DB, 정규화된 분석 데이터·리포트는 Core DB에 저장됩니다.',
    stageHelp: {
      what: '두 개의 논리적 DB가 있습니다. Collector는 수집기 전용 (raw_items, collection_runs), Core는 분석용 (articles, analysis_results).',
      why: '수집과 분석을 분리해 수집기가 분석 테이블을 건드리지 않도록 합니다. 재분석 시 수집은 건들지 않음.',
      howToChange: [
        '스키마 변경 → Drizzle schema 파일 편집 → pnpm db:push',
        '하이퍼테이블 UNIQUE 추가 → db:push 후 반드시 db:migrate-timescale',
      ],
      relatedCommands: ['pnpm db:push', 'pnpm db:studio', 'pnpm db:migrate-timescale'],
      cautions: [
        '개발/운영이 같은 Postgres 공유 — DROP/TRUNCATE 금지',
        'raw_items 혼합 쿼리 시 scope=feed 강제하지 않으면 댓글이 기사를 10:1로 밀어냄',
      ],
    },
    files: [
      {
        no: '01',
        label: 'apps/collector/src/db/schema/subscriptions.ts',
        role: 'keyword_subscriptions · collection_runs · raw_items',
      },
      {
        no: '02',
        label: 'packages/core/src/db/schema/collections.ts',
        role: 'collection_jobs · articles · videos · comments',
      },
      {
        no: '03',
        label: 'packages/core/src/db/schema/analysis.ts',
        role: 'analysis_results · analysis_reports',
      },
    ],
    tables: [
      {
        no: '01',
        label: 'keyword_subscriptions',
        role: '구독 정의. UNIQUE(keyword, ownerId), INDEX(status, nextRunAt)',
      },
      {
        no: '02',
        label: 'collection_runs',
        role: '소스별 실행 이력. window 계산의 기준 (itemsCollected>0 조회)',
      },
      {
        no: '03',
        label: 'raw_items',
        role: '수집 원본. UNIQUE(source, sourceId, itemType, time)로 중복 차단',
      },
      {
        no: '04',
        label: 'run_cancellations',
        role: 'Cooperative cancel의 단일 진실 소스. 워커가 폴링',
        help: {
          what: '취소 요청을 기록하는 테이블. Row가 있으면 "이 run은 그만두세요"라는 신호입니다.',
          why: 'BullMQ job을 강제로 죽이면 락 해제·DB 정합성이 깨집니다. 협력적(cooperative) 취소로 워커가 스스로 멈추도록 설계.',
          howToChange: [
            '취소 모드 추가 → mode enum에 값 추가',
            '취소 트리거 → UI cancelRun 버튼 (DB 직접 조작 금지)',
          ],
          cautions: ['DB에 직접 INSERT/DELETE 하지 말 것 — executor checkpoint가 이 값만 폴링'],
        },
      },
      {
        no: '05',
        label: 'collection_jobs',
        role: '분석 단위. progress JSONB에 소스별 실시간 카운트 저장',
      },
      { no: '06', label: 'analysis_results', role: '모듈별 결과 + 토큰 usage' },
      { no: '07', label: 'analysis_reports', role: '최종 Markdown 리포트' },
    ],
    behaviors: [
      {
        no: '01',
        label: '개발/운영이 같은 ais-prod-postgres:5438을 공유 (파괴적 SQL 주의)',
        role: '공유 인프라',
      },
      {
        no: '02',
        label: 'raw_items 혼합 쿼리 시 댓글이 기사를 10:1로 밀어냄 → scope=feed 강제',
        role: '조회 주의사항',
      },
      {
        no: '03',
        label: 'articles/videos/comments는 collection_jobs와 N:M 조인 (재수집 시 연결 재사용)',
        role: '조인 테이블 설계',
      },
    ],
    notes: ['하이퍼테이블 UNIQUE는 db:push 후 반드시 db:migrate-timescale 실행 필요'],
  },
  {
    key: 'queue',
    index: 4,
    code: 'QUEUE',
    title: '큐 · 워커',
    subtitle: 'BullMQ — 3개 큐, Flow 구조',
    icon: ListOrdered,
    accent: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-300 dark:border-amber-700',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      glow: 'shadow-amber-200 dark:shadow-amber-900/40',
    },
    summary:
      'collectors(직렬) → pipeline(병렬 정규화) → analysis(AI 모듈)가 BullMQ FlowProducer로 연쇄 실행됩니다.',
    stageHelp: {
      what: 'Redis 기반 BullMQ로 3개 큐를 운영합니다. FlowProducer로 부모-자식 Job 관계를 맺어 완료 시점 동기화를 처리합니다.',
      why: '수집은 네트워크 I/O, 정규화는 DB I/O, 분석은 LLM I/O로 특성이 완전히 다릅니다. 큐를 나눠야 각각 적절한 concurrency를 설정할 수 있습니다.',
      howToChange: [
        '큐 concurrency 조정 → createWorker 옵션',
        '새 큐 추가 → connection.ts + workers.ts + flows.ts 3곳',
        '환경 분리 → getBullPrefix() 로직',
      ],
      relatedCommands: ['pnpm worker', 'dserver logs ais-collector-worker'],
      cautions: ['prefix 섞이면 개발 job이 운영 워커에서 실행됨 → getBullPrefix() 검증 필수'],
    },
    files: [
      { no: '01', label: 'packages/core/src/queue/flows.ts', role: 'triggerCollection Flow 정의' },
      {
        no: '02',
        label: 'packages/core/src/queue/collector-worker.ts',
        role: 'Collector Worker 핸들러 (스트림 수집 + 취소 폴링)',
      },
      { no: '03', label: 'packages/core/src/queue/workers.ts', role: 'Worker 생성 옵션' },
      {
        no: '04',
        label: 'packages/core/src/queue/connection.ts',
        role: 'getBullPrefix() 환경 분리',
      },
    ],
    tables: [
      {
        no: '01',
        label: 'collectors 큐',
        role: 'concurrency=1, lock=30min — 일자 카운터 Map 보호 목적 직렬',
        help: {
          what: '수집기 전용 큐. 전역 상태(일자별 카운터 Map) 때문에 한 번에 하나만 실행됩니다.',
          why: 'concurrency>1이면 maxItemsPerDay 계산이 race condition으로 깨집니다.',
          howToChange: ['직렬 제약 해제 원하면 카운터를 Redis INCR로 이관 후 concurrency 증가'],
          cautions: ['단순 concurrency만 올리면 maxItemsPerDay 우회됨'],
        },
      },
      {
        no: '02',
        label: 'pipeline 큐',
        role: 'concurrency=3, lock=10min — normalize-* → persist',
      },
      {
        no: '03',
        label: 'analysis 큐',
        role: 'concurrency=4+, lock=30min+ — 12개 분석 모듈',
      },
    ],
    functions: [
      {
        no: '01',
        label: 'triggerCollection',
        signature: '(params: CollectionTrigger, dbJobId: number) → {flowId, dbJobId, flow}',
        role: 'Flow Tree 생성: persist ← normalize-* ← collect-* (소스별 병렬)',
      },
      {
        no: '02',
        label: 'getBullPrefix',
        signature: '() → "bull" | "ais-dev"',
        role: 'NODE_ENV에 따른 자동 분기',
      },
    ],
    behaviors: [
      {
        no: '01',
        label: 'prefix 자동 분기: NODE_ENV=production → "bull", 그 외 → "ais-dev"',
        role: '큐 격리',
      },
      {
        no: '02',
        label: 'Flow 자식 관계: persist ← normalize-* ← collect-* (소스별 병렬)',
        role: 'BullMQ Tree 구조',
      },
      {
        no: '03',
        label: 'persist 완료 → triggerClassify → triggerAnalysis 자동 연쇄',
        role: '자동 파이프라인',
      },
      {
        no: '04',
        label: '워커는 수집 루프 내에서 isPipelineCancelled() 폴링 → graceful cancel',
        role: '협력적 취소',
      },
    ],
    notes: ['개발·운영이 같은 Redis를 써도 prefix 분리로 큐 섞이지 않음'],
  },
  {
    key: 'collect',
    index: 5,
    code: 'COLLECT',
    title: '수집 계층',
    subtitle: 'packages/collectors — 5개 내장 + 동적 어댑터',
    icon: Globe2,
    accent: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-300 dark:border-rose-700',
      text: 'text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500',
      glow: 'shadow-rose-200 dark:shadow-rose-900/40',
    },
    summary:
      '각 소스별 Collector가 AsyncGenerator로 스트림 수집하며, 실시간 진행도와 취소 신호를 처리합니다.',
    stageHelp: {
      what: 'Collector 인터페이스를 구현한 어댑터들이 모여 있습니다. 공통 규약은 AsyncGenerator로 청크 단위 배출.',
      why: '스트림 패턴으로 메모리 사용을 낮추고, 청크마다 진행률을 DB에 반영해 사용자에게 실시간 피드백을 제공합니다.',
      howToChange: [
        '새 수집기 추가 → adapters/<name>.ts 생성 + init.ts에 등록 + flows.ts에 Flow 노드 추가',
        '커뮤니티 사이트 → CommunityBaseCollector 상속',
        '셀렉터 깨짐 시 → 해당 adapter의 CSS selector 업데이트',
      ],
      cautions: [
        'throw하면 Flow 전체가 실패 → 실패 시 빈 배열 반환 패턴 지킬 것',
        'robots.txt 및 이용약관 준수',
      ],
    },
    files: [
      { no: '01', label: 'packages/collectors/src/init.ts', role: '수집기 레지스트리 등록' },
      {
        no: '02',
        label: 'packages/collectors/src/adapters/naver-news.ts',
        role: 'Naver News — 기사 + 댓글',
      },
      {
        no: '03',
        label: 'packages/collectors/src/adapters/youtube.ts',
        role: 'YouTube — 영상 + 댓글 + 자막(옵션)',
      },
      {
        no: '04',
        label: 'packages/collectors/src/adapters/dcinside.ts',
        role: 'DCInside — 커뮤니티',
      },
      {
        no: '05',
        label: 'packages/collectors/src/adapters/fmkorea.ts',
        role: 'FMKorea — 안티봇 회피',
        help: {
          what: 'FMKorea는 적극적인 봇 차단을 하는 사이트라 별도 회피 로직이 있습니다.',
          why: '일반 fetch로는 403이 나옵니다. Playwright 기반 브라우저 수집이나 특수 헤더가 필요합니다.',
          howToChange: ['차단 패턴 변경 시 → UA, referer, 지연 시간 조정'],
          cautions: ['과도한 요청 시 IP 밴 가능성 → 주기 조절'],
        },
      },
      { no: '06', label: 'packages/collectors/src/adapters/clien.ts', role: 'Clien — 커뮤니티' },
    ],
    behaviors: [
      {
        no: '01',
        label: '스트림 패턴: for await (chunk of collector.collect(...))',
        role: '메모리 절약',
      },
      {
        no: '02',
        label: '청크마다 updateJobProgress(DB) 호출 → UI 폴링 원천',
        role: '실시간 진행도',
      },
      {
        no: '03',
        label: '취소 신호: isPipelineCancelled(dbJobId) true면 즉시 early return',
        role: '협력적 취소',
      },
      {
        no: '04',
        label: '부분 실패 허용: throw 대신 빈 배열 반환 → 다른 소스 영향 없음',
        role: '격리 정책',
      },
      {
        no: '05',
        label: 'dayWindow 링크별 dayIdx 직접 점프로 영구 0건 방지',
        role: '일자별 페이지네이션',
      },
    ],
  },
  {
    key: 'analyze',
    index: 6,
    code: 'ANALYZE',
    title: 'AI 분석',
    subtitle: 'packages/core/analysis — 4 Stage × 12 모듈',
    icon: Brain,
    accent: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-300 dark:border-indigo-700',
      text: 'text-indigo-700 dark:text-indigo-300',
      dot: 'bg-indigo-500',
      glow: 'shadow-indigo-200 dark:shadow-indigo-900/40',
    },
    summary:
      'Stage 1 병렬 → Stage 2 순차 → Stage 3 BERT classify → Stage 4 도메인별 고급 분석 → Markdown 리포트.',
    stageHelp: {
      what: '수집 완료된 데이터를 12개 모듈로 다각도 분석합니다. 각 모듈은 Zod 스키마로 결과 형식을 보장.',
      why: '여론은 한 측면만 보면 편향됩니다. 거시/세분/프레이밍/리스크/기회/전략 등 다층 분석이 필요합니다.',
      howToChange: [
        '새 모듈 추가 → modules/<name>.ts + schemas/<name>.schema.ts + runner.ts 등록',
        '모델 변경 → MODULE_MODEL_MAP',
        'docs/llm-model-recommendations.md 참고',
      ],
      cautions: [
        'ENCRYPTION_KEY 미설정 시 분석 전체 실패 (폴백 키 사용 중)',
        'LLM rate limit — 동시성 과도하면 429',
      ],
    },
    files: [
      { no: '01', label: 'packages/core/src/analysis/runner.ts', role: 'runModule + Stage 정의' },
      {
        no: '02',
        label: 'packages/core/src/analysis/pipeline-orchestrator.ts',
        role: 'Stage 간 실행 순서 제어',
      },
      {
        no: '03',
        label: 'packages/core/src/analysis/modules/',
        role: '12개 분석 모듈 구현',
      },
      {
        no: '04',
        label: 'packages/core/src/analysis/schemas/',
        role: 'Zod 결과 스키마',
      },
    ],
    tables: [
      {
        no: '01',
        label: 'Stage 1 (병렬)',
        role: 'macroView · segmentation · sentimentFraming · messageImpact',
      },
      {
        no: '02',
        label: 'Stage 2 (순차)',
        role: 'riskMap → opportunity → strategy → finalSummary',
      },
      { no: '03', label: 'Stage 3 (BERT)', role: 'classify — 모든 항목에 sentiment 태깅' },
      {
        no: '04',
        label: 'Stage 4 (도메인)',
        role: 'approvalRating · frameWar · crisisScenario · winSimulation',
      },
    ],
    behaviors: [
      {
        no: '01',
        label: '입력 해시 기반 모듈 캐시 (AIS_MODULE_CACHE) → 동일 input LLM 호출 스킵',
        role: '비용 절감',
      },
      {
        no: '02',
        label: 'subscription 직접 로더: useCollectorLoader=true 시 raw_items에서 바로 로드',
        role: '구독 기반 분석 최적화',
      },
      {
        no: '03',
        label: '모듈별 LLM 모델은 MODULE_MODEL_MAP에서 지정',
        role: '최고/보통/최소 티어 선택',
      },
      {
        no: '04',
        label: '완료 후 Report Builder가 통합 Markdown → analysis_reports INSERT',
        role: '최종 산출물',
      },
    ],
  },
  {
    key: 'status',
    index: 7,
    code: 'STATUS',
    title: '상태 & 취소',
    subtitle: '진행률 전달 + Cooperative Cancel',
    icon: Activity,
    accent: {
      bg: 'bg-slate-50 dark:bg-slate-900/60',
      border: 'border-slate-300 dark:border-slate-600',
      text: 'text-slate-700 dark:text-slate-300',
      dot: 'bg-slate-500',
      glow: 'shadow-slate-200 dark:shadow-slate-800/40',
    },
    summary:
      'DB progress JSONB를 2초 폴링으로 UI에 전달. 취소는 run_cancellations 테이블이 유일한 진실 소스.',
    stageHelp: {
      what: '백엔드 상태가 프론트엔드까지 어떻게 흘러가는지, 그리고 사용자가 어떻게 작업을 멈추는지를 정의합니다.',
      why: '긴 작업일수록 "지금 뭘 하고 있지? 멈출 수 있나?"가 사용자 신뢰의 핵심입니다.',
      howToChange: [
        '하트비트 기준 변경 → run-progress-inline.tsx',
        '새 취소 모드 추가 → cancelRun mode enum + run_cancellations 처리 로직',
      ],
      cautions: ['run_cancellations 수동 조작 절대 금지'],
    },
    files: [
      {
        no: '01',
        label: 'apps/collector/src/server/trpc/subscriptions.ts',
        role: 'cancelRun · forceCompleteRun · cancelBySubscription',
      },
      {
        no: '02',
        label: 'apps/web/src/components/subscriptions/run-progress-inline.tsx',
        role: '2초 폴링 + lastProgressAtMs 하트비트',
      },
      {
        no: '03',
        label: 'packages/core/src/queue/collector-worker.ts',
        role: 'isPipelineCancelled() 주기 확인',
      },
    ],
    behaviors: [
      {
        no: '01',
        label: '진행 쓰기: Collector/Pipeline Worker가 collection_jobs.progress JSONB 업데이트',
        role: '서버 → DB',
      },
      {
        no: '02',
        label: '진행 읽기: runProgress(2s) · runs(60s) 폴링 → UI가 하트비트 판정',
        role: 'DB → UI',
      },
      {
        no: '03',
        label: '취소 쓰기: UI cancelRun 클릭 → run_cancellations INSERT',
        role: 'UI → DB',
      },
      {
        no: '04',
        label: '취소 읽기: 워커가 다음 루프에서 신호 감지 → 수집분 반환 후 정상 종료',
        role: 'DB → 워커',
      },
    ],
    notes: ['run_cancellations 테이블은 수동 DB 조작 금지 — executor checkpoint가 이 값만 폴링'],
  },
];

// ──────────────────────────────────────────────────────────────
// Ref ID 빌더
// ──────────────────────────────────────────────────────────────

type RefType = 'stage' | 'file' | 'table' | 'fn' | 'behavior' | 'principle';

function buildRef(stage: StageKey | 'principle', type: RefType, no?: string): string {
  if (type === 'stage') return `@ais:wf/${stage}`;
  if (type === 'principle') return `@ais:wf/principle/${no ?? ''}`;
  return `@ais:wf/${stage}/${type}/${no ?? ''}`;
}

function buildShortCode(stageCode: string, type: RefType, no?: string): string {
  if (type === 'stage') return `WF-${stageCode}`;
  const typeShort =
    type === 'file'
      ? 'F'
      : type === 'table'
        ? 'T'
        : type === 'fn'
          ? 'FN'
          : type === 'behavior'
            ? 'B'
            : 'P';
  return `WF-${stageCode}-${typeShort}${no ?? ''}`;
}

// ──────────────────────────────────────────────────────────────
// 페이지 본체
// ──────────────────────────────────────────────────────────────

interface HelpContext {
  title: string;
  refId: string;
  shortCode: string;
  help: HelpBlock;
  stageTitle: string;
}

export default function WorkflowPage() {
  const [selectedKey, setSelectedKey] = useState<StageKey>('ui');
  const [isPlaying, setIsPlaying] = useState(false);
  const [helpCtx, setHelpCtx] = useState<HelpContext | null>(null);
  const [aiCtx, setAiCtx] = useState<{ refId: string; shortCode: string; label: string } | null>(
    null,
  );
  const [searchQ, setSearchQ] = useState('');

  const selected = useMemo(
    () => STAGES.find((s) => s.key === selectedKey) ?? STAGES[0],
    [selectedKey],
  );

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setSelectedKey((prev) => {
        const idx = STAGES.findIndex((s) => s.key === prev);
        const next = STAGES[(idx + 1) % STAGES.length];
        if (next.key === STAGES[0].key) {
          setIsPlaying(false);
          return prev;
        }
        return next.key;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const resetAndPlay = () => {
    setSelectedKey(STAGES[0].key);
    setIsPlaying(true);
  };

  const filteredStage = useMemo(() => {
    if (!searchQ.trim()) return null;
    const q = searchQ.toLowerCase();
    const hits: Array<{
      stage: StageDef;
      refId: string;
      shortCode: string;
      label: string;
      role: string;
    }> = [];
    for (const s of STAGES) {
      if (s.title.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q)) {
        hits.push({
          stage: s,
          refId: buildRef(s.key, 'stage'),
          shortCode: buildShortCode(s.code, 'stage'),
          label: s.title,
          role: s.summary,
        });
      }
      for (const f of s.files) {
        if (
          f.label.toLowerCase().includes(q) ||
          f.role.toLowerCase().includes(q) ||
          f.no.includes(q)
        ) {
          hits.push({
            stage: s,
            refId: buildRef(s.key, 'file', f.no),
            shortCode: buildShortCode(s.code, 'file', f.no),
            label: f.label,
            role: f.role,
          });
        }
      }
      for (const t of s.tables ?? []) {
        if (t.label.toLowerCase().includes(q) || t.role.toLowerCase().includes(q)) {
          hits.push({
            stage: s,
            refId: buildRef(s.key, 'table', t.no),
            shortCode: buildShortCode(s.code, 'table', t.no),
            label: t.label,
            role: t.role,
          });
        }
      }
      for (const fn of s.functions ?? []) {
        if (fn.label.toLowerCase().includes(q) || fn.role.toLowerCase().includes(q)) {
          hits.push({
            stage: s,
            refId: buildRef(s.key, 'fn', fn.no),
            shortCode: buildShortCode(s.code, 'fn', fn.no),
            label: fn.label,
            role: fn.role,
          });
        }
      }
      for (const b of s.behaviors) {
        if (b.label.toLowerCase().includes(q) || b.role.toLowerCase().includes(q)) {
          hits.push({
            stage: s,
            refId: buildRef(s.key, 'behavior', b.no),
            shortCode: buildShortCode(s.code, 'behavior', b.no),
            label: b.label,
            role: b.role,
          });
        }
      }
    }
    return hits.slice(0, 20);
  }, [searchQ]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Workflow className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">키워드 구독 워크플로우</h1>
          <Badge variant="outline" className="text-[10px]">
            UI → 워커 → DB
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] font-mono cursor-help"
            title="각 영역을 @ais:wf/<stage>/<type>/<no> 형식으로 지칭할 수 있습니다"
          >
            @ais:wf/*
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          각 영역에 고유 <span className="font-mono text-xs">ref ID</span>가 부여되어 있어{' '}
          <span className="font-semibold">AI(저)에게 "WF-QUEUE-F02 수정해줘"처럼 정확히 지칭</span>
          할 수 있습니다.{' '}
          <span className="inline-flex items-center gap-0.5">
            <HelpCircle className="h-3 w-3" />
            도움말
          </span>
          ,{' '}
          <span className="inline-flex items-center gap-0.5">
            <Sparkles className="h-3 w-3" />
            AI 요청
          </span>{' '}
          버튼을 활용하세요.
        </p>

        <div className="flex items-center gap-2 pt-2 flex-wrap">
          {isPlaying ? (
            <Button variant="outline" size="sm" onClick={() => setIsPlaying(false)}>
              <Pause className="h-3.5 w-3.5 mr-1" />
              일시정지
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={resetAndPlay}>
              <Play className="h-3.5 w-3.5 mr-1" />
              플로우 재생
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsPlaying(false);
              setSelectedKey(STAGES[0].key);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            처음으로
          </Button>

          {/* Ref ID 검색 */}
          <div className="relative ml-2 flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Ref ID 검색 (예: queue, raw_items, cancel)"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="pl-7 pr-8 h-8 text-xs"
            />
            {searchQ && (
              <button
                type="button"
                onClick={() => setSearchQ('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                aria-label="검색 초기화"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setHelpCtx({
                title: '사용 가이드',
                refId: '@ais:wf',
                shortCode: 'WF',
                stageTitle: '워크플로우',
                help: {
                  what: '이 페이지는 키워드 구독 파이프라인의 전체 구조를 시각화하고, AI(Claude)에게 정확히 지시할 수 있도록 각 영역에 ref ID를 부여한 작업 기반 도구입니다.',
                  why: '"수집 로직 고쳐줘" 같은 모호한 요청은 잘못된 파일을 건드리게 합니다. "WF-COLLECT-F05 고쳐줘" 처럼 ID로 지시하면 정확한 파일이 지목됩니다.',
                  howToChange: [
                    '① 다이어그램의 단계 클릭 → 상세 영역 확인',
                    '② 각 항목 옆 [?] 버튼으로 도움말 열람',
                    '③ [AI 요청] 버튼으로 프롬프트 템플릿 생성 → 복사',
                    '④ 클립보드 내용을 AI 채팅에 붙여넣고 수정/추가 요청',
                  ],
                  relatedCommands: [
                    '예시 프롬프트: "WF-QUEUE-T01 collectors 큐의 concurrency를 2로 올리고 싶어. 가능한지 검토해줘"',
                    '예시 프롬프트: "WF-UI-F04 하트비트 임계값을 5/15/30초로 조정해줘"',
                  ],
                },
              })
            }
          >
            <HelpCircle className="h-3.5 w-3.5 mr-1" />
            사용법
          </Button>

          <span className="text-xs text-muted-foreground ml-auto">
            <span className="font-mono font-bold">{buildShortCode(selected.code, 'stage')}</span> ·{' '}
            {selected.index} / {STAGES.length}
          </span>
        </div>

        {/* 검색 결과 */}
        {filteredStage && filteredStage.length > 0 && (
          <Card className="mt-2 p-3">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2">
              검색 결과 {filteredStage.length}개
            </p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filteredStage.map((hit, i) => {
                const handleSelect = () => {
                  setSelectedKey(hit.stage.key);
                  setSearchQ('');
                };
                return (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={handleSelect}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect();
                      }
                    }}
                    className="w-full flex items-start gap-2 rounded-md p-2 hover:bg-muted/60 text-left transition-colors cursor-pointer"
                  >
                    <RefBadge
                      shortCode={hit.shortCode}
                      refId={hit.refId}
                      accent={hit.stage.accent}
                      size="xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono truncate">{hit.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{hit.role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        {filteredStage && filteredStage.length === 0 && (
          <p className="text-xs text-muted-foreground italic pt-1">검색 결과가 없습니다.</p>
        )}
      </div>

      {/* 파이프라인 다이어그램 */}
      <PipelineDiagram
        selectedKey={selectedKey}
        onSelect={(k) => {
          setIsPlaying(false);
          setSelectedKey(k);
        }}
      />

      {/* 상세 패널 + 시퀀스 요약 */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <SequenceSummary selectedKey={selectedKey} onSelect={setSelectedKey} />
        <StageDetail
          stage={selected}
          onOpenHelp={(ctx) => setHelpCtx(ctx)}
          onOpenAi={(ctx) => setAiCtx(ctx)}
        />
      </div>

      {/* 핵심 설계 포인트 */}
      <DesignPrinciples onOpenHelp={(ctx) => setHelpCtx(ctx)} onOpenAi={(ctx) => setAiCtx(ctx)} />

      {/* 도움말 모달 */}
      <HelpDialog ctx={helpCtx} onClose={() => setHelpCtx(null)} />

      {/* AI 요청 모달 */}
      <AiRequestDialog ctx={aiCtx} onClose={() => setAiCtx(null)} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Ref Badge (클릭 → 전체 ref 복사)
// ──────────────────────────────────────────────────────────────

function RefBadge({
  shortCode,
  refId,
  accent,
  size = 'sm',
}: {
  shortCode: string;
  refId: string;
  accent?: StageDef['accent'];
  size?: 'xs' | 'sm';
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(refId);
      setCopied(true);
      toast.success(`${shortCode} 복사됨`, {
        description: refId,
        duration: 1400,
      });
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error('복사 실패');
    }
  };

  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';
  const iconSize = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`복사: ${refId}`}
      className={cn(
        'group shrink-0 inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono font-bold tabular-nums transition-colors',
        textSize,
        accent
          ? cn(accent.border, accent.text, accent.bg, 'hover:brightness-95')
          : 'border-muted-foreground/30 bg-muted/40 text-muted-foreground hover:bg-muted',
      )}
    >
      <span>{shortCode}</span>
      {copied ? (
        <Check className={cn(iconSize, 'text-emerald-600')} />
      ) : (
        <Copy className={cn(iconSize, 'opacity-40 group-hover:opacity-100 transition-opacity')} />
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────
// 파이프라인 다이어그램
// ──────────────────────────────────────────────────────────────

function PipelineDiagram({
  selectedKey,
  onSelect,
}: {
  selectedKey: StageKey;
  onSelect: (k: StageKey) => void;
}) {
  return (
    <Card className="p-4 md:p-6 overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-7 gap-2 items-stretch">
          {STAGES.map((stage, idx) => (
            <StageNode
              key={stage.key}
              stage={stage}
              isSelected={stage.key === selectedKey}
              onClick={() => onSelect(stage.key)}
              showArrow={idx < STAGES.length - 1}
            />
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 mt-3 text-[10px] text-muted-foreground text-center">
          <FlowLabel text="tRPC" />
          <FlowLabel text="tRPC / HTTP" />
          <FlowLabel text="SQL INSERT" />
          <FlowLabel text="BullMQ Job" />
          <FlowLabel text="Stream" />
          <FlowLabel text="LLM + BERT" />
          <FlowLabel text="Polling 2s" />
        </div>
      </div>
    </Card>
  );
}

function StageNode({
  stage,
  isSelected,
  onClick,
  showArrow,
}: {
  stage: StageDef;
  isSelected: boolean;
  onClick: () => void;
  showArrow: boolean;
}) {
  const Icon = stage.icon;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isSelected}
        className={cn(
          'w-full flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all text-left',
          'hover:scale-[1.02] hover:shadow-md',
          stage.accent.bg,
          isSelected
            ? cn(stage.accent.border, 'shadow-lg', stage.accent.glow)
            : 'border-transparent opacity-70 hover:opacity-100',
        )}
      >
        <div className={cn('flex items-center gap-1', stage.accent.text)}>
          <span
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white',
              stage.accent.dot,
            )}
          >
            {stage.index}
          </span>
          {isSelected && (
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                  stage.accent.dot,
                )}
              />
              <span className={cn('relative inline-flex h-2 w-2 rounded-full', stage.accent.dot)} />
            </span>
          )}
        </div>
        <Icon className={cn('h-7 w-7', stage.accent.text)} />
        <div className="text-center">
          <p className={cn('font-semibold text-sm', stage.accent.text)}>{stage.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{stage.subtitle}</p>
          <p className="mt-1 font-mono text-[9px] font-bold text-muted-foreground">
            WF-{stage.code}
          </p>
        </div>
      </button>

      {showArrow && (
        <ArrowRight
          className={cn(
            'absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 z-10 pointer-events-none',
            isSelected && 'text-primary',
          )}
          aria-hidden
        />
      )}
    </div>
  );
}

function FlowLabel({ text }: { text: string }) {
  return <span className="border-t border-dashed border-border pt-1 truncate">{text}</span>;
}

// ──────────────────────────────────────────────────────────────
// 시퀀스 요약
// ──────────────────────────────────────────────────────────────

function SequenceSummary({
  selectedKey,
  onSelect,
}: {
  selectedKey: StageKey;
  onSelect: (k: StageKey) => void;
}) {
  return (
    <Card className="p-4 h-full">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <ListOrdered className="h-4 w-4" />
        실행 시퀀스
      </h2>
      <ol className="space-y-2.5">
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          const isActive = stage.key === selectedKey;
          return (
            <li key={stage.key}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(stage.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(stage.key);
                  }
                }}
                className={cn(
                  'w-full flex items-start gap-3 p-2.5 rounded-md text-left transition-colors cursor-pointer',
                  isActive
                    ? cn(stage.accent.bg, 'ring-1', stage.accent.border)
                    : 'hover:bg-muted/50',
                )}
              >
                <span
                  className={cn(
                    'shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white',
                    stage.accent.dot,
                  )}
                >
                  {stage.index}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Icon className={cn('h-3.5 w-3.5', stage.accent.text)} />
                    <p className={cn('font-medium text-sm', isActive && stage.accent.text)}>
                      {stage.title}
                    </p>
                    <RefBadge
                      shortCode={buildShortCode(stage.code, 'stage')}
                      refId={buildRef(stage.key, 'stage')}
                      accent={stage.accent}
                      size="xs"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{stage.summary}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────
// 단계 상세
// ──────────────────────────────────────────────────────────────

function StageDetail({
  stage,
  onOpenHelp,
  onOpenAi,
}: {
  stage: StageDef;
  onOpenHelp: (ctx: HelpContext) => void;
  onOpenAi: (ctx: { refId: string; shortCode: string; label: string }) => void;
}) {
  const Icon = stage.icon;
  const stageRefId = buildRef(stage.key, 'stage');
  const stageShort = buildShortCode(stage.code, 'stage');

  return (
    <Card className={cn('p-5 border-2 transition-colors', stage.accent.border, stage.accent.bg)}>
      <div className="flex items-start gap-3 mb-4">
        <div
          className={cn(
            'shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg text-white',
            stage.accent.dot,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn('text-lg font-bold', stage.accent.text)}>{stage.title}</h2>
            <Badge variant="outline" className="text-[10px]">
              Step {stage.index}
            </Badge>
            <RefBadge shortCode={stageShort} refId={stageRefId} accent={stage.accent} size="sm" />
            <HelpButton
              onClick={() =>
                onOpenHelp({
                  title: stage.title,
                  refId: stageRefId,
                  shortCode: stageShort,
                  stageTitle: stage.title,
                  help: stage.stageHelp,
                })
              }
            />
            <AiButton
              onClick={() =>
                onOpenAi({
                  refId: stageRefId,
                  shortCode: stageShort,
                  label: `${stage.title} 전체`,
                })
              }
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{stage.subtitle}</p>
          <p className="text-sm mt-2">{stage.summary}</p>
        </div>
      </div>

      <Section title="주요 파일" icon={FileCode}>
        <div className="space-y-1.5">
          {stage.files.map((f) => {
            const refId = buildRef(stage.key, 'file', f.no);
            const shortCode = buildShortCode(stage.code, 'file', f.no);
            return (
              <RefRow
                key={f.no}
                shortCode={shortCode}
                refId={refId}
                accent={stage.accent}
                primary={f.label}
                secondary={f.role}
                isCodePath
                help={f.help}
                onOpenHelp={(help) =>
                  onOpenHelp({
                    title: f.label,
                    refId,
                    shortCode,
                    stageTitle: stage.title,
                    help,
                  })
                }
                onOpenAi={() => onOpenAi({ refId, shortCode, label: f.label })}
              />
            );
          })}
        </div>
      </Section>

      {stage.tables && stage.tables.length > 0 && (
        <Section title="테이블 / 구성" icon={TableIcon}>
          <div className="space-y-1.5">
            {stage.tables.map((t) => {
              const refId = buildRef(stage.key, 'table', t.no);
              const shortCode = buildShortCode(stage.code, 'table', t.no);
              return (
                <RefRow
                  key={t.no}
                  shortCode={shortCode}
                  refId={refId}
                  accent={stage.accent}
                  primary={t.label}
                  secondary={t.role}
                  help={t.help}
                  onOpenHelp={(help) =>
                    onOpenHelp({
                      title: t.label,
                      refId,
                      shortCode,
                      stageTitle: stage.title,
                      help,
                    })
                  }
                  onOpenAi={() => onOpenAi({ refId, shortCode, label: t.label })}
                />
              );
            })}
          </div>
        </Section>
      )}

      {stage.functions && stage.functions.length > 0 && (
        <Section title="핵심 함수" icon={Workflow}>
          <div className="space-y-1.5">
            {stage.functions.map((fn) => {
              const refId = buildRef(stage.key, 'fn', fn.no);
              const shortCode = buildShortCode(stage.code, 'fn', fn.no);
              return (
                <RefRow
                  key={fn.no}
                  shortCode={shortCode}
                  refId={refId}
                  accent={stage.accent}
                  primary={`${fn.label}${fn.signature}`}
                  secondary={fn.role}
                  isCodePath
                  help={fn.help}
                  onOpenHelp={(help) =>
                    onOpenHelp({
                      title: fn.label,
                      refId,
                      shortCode,
                      stageTitle: stage.title,
                      help,
                    })
                  }
                  onOpenAi={() =>
                    onOpenAi({ refId, shortCode, label: `${fn.label}${fn.signature}` })
                  }
                />
              );
            })}
          </div>
        </Section>
      )}

      <Section title="주요 동작" icon={Activity}>
        <div className="space-y-1.5">
          {stage.behaviors.map((b) => {
            const refId = buildRef(stage.key, 'behavior', b.no);
            const shortCode = buildShortCode(stage.code, 'behavior', b.no);
            return (
              <RefRow
                key={b.no}
                shortCode={shortCode}
                refId={refId}
                accent={stage.accent}
                primary={b.label}
                secondary={b.role}
                help={b.help}
                onOpenHelp={(help) =>
                  onOpenHelp({
                    title: b.label,
                    refId,
                    shortCode,
                    stageTitle: stage.title,
                    help,
                  })
                }
                onOpenAi={() => onOpenAi({ refId, shortCode, label: b.label })}
              />
            );
          })}
        </div>
      </Section>

      {stage.notes && stage.notes.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2.5">
          <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 mb-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            주의사항
          </p>
          <ul className="space-y-0.5 text-xs text-amber-900 dark:text-amber-200">
            {stage.notes.map((n, i) => (
              <li key={i}>• {n}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Ref Row (공통 렌더러)
// ──────────────────────────────────────────────────────────────

function RefRow({
  shortCode,
  refId,
  accent,
  primary,
  secondary,
  isCodePath,
  help,
  onOpenHelp,
  onOpenAi,
}: {
  shortCode: string;
  refId: string;
  accent: StageDef['accent'];
  primary: string;
  secondary: string;
  isCodePath?: boolean;
  help?: HelpBlock;
  onOpenHelp: (h: HelpBlock) => void;
  onOpenAi: () => void;
}) {
  return (
    <div className="group flex items-start gap-2 rounded-md border bg-background/60 px-2.5 py-1.5 hover:bg-background transition-colors">
      <RefBadge shortCode={shortCode} refId={refId} accent={accent} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-xs', isCodePath ? 'font-mono' : '', 'break-all')}>{primary}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{secondary}</p>
      </div>
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {help && <HelpButton size="xs" onClick={() => onOpenHelp(help)} />}
        <AiButton size="xs" onClick={onOpenAi} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 아이콘 버튼들
// ──────────────────────────────────────────────────────────────

function HelpButton({ onClick, size = 'sm' }: { onClick: () => void; size?: 'xs' | 'sm' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="상세 도움말"
      aria-label="상세 도움말"
      className={cn(
        'rounded-md border border-dashed hover:bg-muted transition-colors inline-flex items-center gap-1',
        size === 'xs' ? 'h-6 px-1.5 text-[10px]' : 'h-7 px-2 text-xs',
      )}
    >
      <HelpCircle className={size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span className="hidden sm:inline">도움말</span>
    </button>
  );
}

function AiButton({ onClick, size = 'sm' }: { onClick: () => void; size?: 'xs' | 'sm' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="AI 요청 프롬프트 생성"
      aria-label="AI 요청 프롬프트 생성"
      className={cn(
        'rounded-md border border-dashed border-primary/40 text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1',
        size === 'xs' ? 'h-6 px-1.5 text-[10px]' : 'h-7 px-2 text-xs',
      )}
    >
      <Sparkles className={size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span className="hidden sm:inline">AI 요청</span>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────
// 도움말 모달
// ──────────────────────────────────────────────────────────────

function HelpDialog({ ctx, onClose }: { ctx: HelpContext | null; onClose: () => void }) {
  return (
    <Dialog open={!!ctx} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {ctx && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle>{ctx.title}</DialogTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {ctx.shortCode}
                </Badge>
              </div>
              <DialogDescription>
                <span className="text-xs text-muted-foreground">
                  {ctx.stageTitle} · <span className="font-mono">{ctx.refId}</span>
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <HelpSection label="📌 무엇을 하는가?" body={ctx.help.what} />
              <HelpSection label="❓ 왜 필요한가?" body={ctx.help.why} />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  🔧 어떻게 수정하나?
                </p>
                <ul className="space-y-1 text-sm">
                  {ctx.help.howToChange.map((h, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {ctx.help.relatedCommands && ctx.help.relatedCommands.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    💻 관련 커맨드
                  </p>
                  <div className="space-y-1">
                    {ctx.help.relatedCommands.map((c, i) => (
                      <code
                        key={i}
                        className="block font-mono text-xs bg-muted px-2 py-1 rounded border"
                      >
                        {c}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {ctx.help.cautions && ctx.help.cautions.length > 0 && (
                <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    주의사항
                  </p>
                  <ul className="space-y-0.5 text-xs text-amber-900 dark:text-amber-200">
                    {ctx.help.cautions.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HelpSection({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-sm leading-relaxed">{body}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// AI 요청 템플릿 생성 모달
// ──────────────────────────────────────────────────────────────

type AiIntent = 'add' | 'fix' | 'upgrade' | 'explain';

const INTENT_DEFS: Record<AiIntent, { icon: LucideIcon; label: string; desc: string }> = {
  add: { icon: MessageSquarePlus, label: '기능 추가', desc: '이 영역에 새 기능·옵션을 추가' },
  fix: { icon: Wrench, label: '버그 수정', desc: '문제 상황을 기술하고 수정 요청' },
  upgrade: { icon: Sparkles, label: '업그레이드', desc: '성능·UX·보안 개선' },
  explain: { icon: HelpCircle, label: '상세 설명', desc: '이 영역 코드·동작을 자세히 설명' },
};

function AiRequestDialog({
  ctx,
  onClose,
}: {
  ctx: { refId: string; shortCode: string; label: string } | null;
  onClose: () => void;
}) {
  const [intent, setIntent] = useState<AiIntent>('add');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (ctx) {
      setIntent('add');
      setDetail('');
    }
  }, [ctx]);

  if (!ctx) {
    return (
      <Dialog open={false} onOpenChange={() => onClose()}>
        <DialogContent />
      </Dialog>
    );
  }

  const prompt = buildAiPrompt(ctx, intent, detail);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success('프롬프트 복사됨', {
        description: 'AI 채팅에 그대로 붙여넣으세요',
      });
    } catch {
      toast.error('복사 실패');
    }
  };

  return (
    <Dialog open={!!ctx} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle>AI에게 요청하기</DialogTitle>
            <Badge variant="outline" className="font-mono text-[10px]">
              {ctx.shortCode}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            <span className="font-mono">{ctx.refId}</span> · {ctx.label}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 의도 선택 */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              ① 어떤 작업을 요청할지 선택
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(INTENT_DEFS) as AiIntent[]).map((k) => {
                const def = INTENT_DEFS[k];
                const Icon = def.icon;
                const active = intent === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setIntent(k)}
                    className={cn(
                      'flex items-start gap-2 rounded-md border p-2.5 text-left transition-colors',
                      active ? 'border-primary bg-primary/5' : 'hover:bg-muted/60 border-border',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 mt-0.5 shrink-0',
                        active ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{def.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{def.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 상세 입력 */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              ② 상세 요구사항 (선택)
            </p>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              placeholder={
                intent === 'add'
                  ? '예) 수집 주기를 분 단위로도 설정할 수 있게 해줘'
                  : intent === 'fix'
                    ? '예) 실행 중 상태가 가끔 Stalled로 잘못 표시됨'
                    : intent === 'upgrade'
                      ? '예) 진행률 표시에 예상 완료 시간을 추가해줘'
                      : '예) 이 부분 코드 흐름을 초심자도 이해할 수 있게 설명해줘'
              }
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* 프롬프트 미리보기 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ③ 생성된 프롬프트 (복사해서 AI 채팅에 붙여넣기)
              </p>
              <Button size="sm" variant="default" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                프롬프트 복사
              </Button>
            </div>
            <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs font-mono max-h-60 overflow-y-auto">
              {prompt}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildAiPrompt(
  ctx: { refId: string; shortCode: string; label: string },
  intent: AiIntent,
  detail: string,
): string {
  const header = `[대상 영역] ${ctx.shortCode}  (${ctx.refId})\n[영역 이름] ${ctx.label}`;
  const detailText = detail.trim() || '(상세 요구사항을 여기에 기술하세요)';

  switch (intent) {
    case 'add':
      return `${header}\n[작업 유형] 기능 추가\n\n위 영역에 다음 기능을 추가해줘:\n${detailText}\n\n진행 방식:\n1. 영향 받는 파일과 레이어를 먼저 조사\n2. 변경 계획 제안 (구현 전 합의)\n3. 의존성 방향(web → core → collectors)과 단일 책임 원칙 준수\n4. 구현 후 관련 테스트/lint 통과 확인`;
    case 'fix':
      return `${header}\n[작업 유형] 버그 수정\n\n다음 문제를 재현·수정해줘:\n${detailText}\n\n진행 방식:\n1. 근본 원인(root cause) 파악 — DB → API → Worker → Frontend 전 경로 확인\n2. 증상 대응이 아닌 원인 해결\n3. 재발 방지 방안 제시 (테스트, 가드)`;
    case 'upgrade':
      return `${header}\n[작업 유형] 업그레이드/개선\n\n다음 방향으로 개선해줘:\n${detailText}\n\n고려 사항:\n- 성능, UX, 보안, 유지보수성 중 어느 축이 주된 목표인지 명시\n- 변경 전후 비교 (before/after)\n- 기존 기능 회귀 없도록 확인`;
    case 'explain':
      return `${header}\n[작업 유형] 상세 설명 요청\n\n${detailText}\n\n설명 범위:\n- 관련 파일 경로와 주요 함수 시그니처\n- 데이터 흐름 (입력 → 처리 → 출력)\n- 실수하기 쉬운 부분과 주의사항\n- 수정하려면 어느 파일부터 손대야 하는지`;
  }
}

// ──────────────────────────────────────────────────────────────
// 핵심 설계 포인트
// ──────────────────────────────────────────────────────────────

interface Principle {
  no: string;
  title: string;
  desc: string;
  where: string;
  help: HelpBlock;
}

const DESIGN_PRINCIPLES: Principle[] = [
  {
    no: '01',
    title: '소스별 독립 실행',
    desc: '한 소스 실패가 다른 소스와 파이프라인에 영향 없음',
    where: 'Collector Worker catch 블록이 빈 배열 반환',
    help: {
      what: '각 수집기는 독립 실행되며, 실패 시 throw 대신 빈 배열을 반환합니다.',
      why: '불안정한 소스(예: fmkorea 안티봇) 때문에 전체 파이프라인이 중단되면 안 됩니다.',
      howToChange: ['새 수집기 작성 시 try-catch로 감싸고 empty 반환 패턴 준수'],
    },
  },
  {
    no: '02',
    title: 'TTL 기반 증분 수집',
    desc: '소스별 최근 items>0 성공 시각 기준으로 window 재계산',
    where: 'computeSourceStartBatch + collection_runs 조회',
    help: {
      what: '각 소스의 마지막 "의미 있는 수집 시각"을 독립 기준점으로 사용합니다.',
      why: '전체 lastRunAt 하나만 쓰면 한 소스가 연속 0건일 때 영구 0건 상태로 고착됩니다.',
      howToChange: ['overlap 비율 조정 → overlapMs 계산식 (기본 intervalHours × 15%)'],
    },
  },
  {
    no: '03',
    title: '중복 원천 차단',
    desc: '수집-정규화 양단에서 UNIQUE 제약 + ON CONFLICT',
    where: 'raw_items UNIQUE · articles ON CONFLICT DO NOTHING',
    help: {
      what: 'DB 수준에서 중복을 막아, 재수집·재시도해도 같은 데이터가 두 번 저장되지 않습니다.',
      why: '애플리케이션 레벨 체크는 race condition에 취약. DB 제약이 가장 신뢰 가능.',
      howToChange: ['새 테이블 추가 시 UNIQUE(source, sourceId, ...) 조합 반드시 정의'],
    },
  },
  {
    no: '04',
    title: 'Cooperative Cancel',
    desc: 'run_cancellations가 유일한 취소 플래그 (DB 직조작 금지)',
    where: '워커가 루프마다 isPipelineCancelled() 폴링',
    help: {
      what: 'BullMQ Job을 강제 킬하는 대신, DB 플래그로 워커가 스스로 멈추도록 합니다.',
      why: '강제 킬은 락 미해제, 정규화 중단 등 데이터 정합성 문제를 일으킵니다.',
      howToChange: ['새 취소 모드 추가 → run_cancellations.mode enum 확장'],
      cautions: ['DB에 직접 INSERT/DELETE 하지 말 것'],
    },
  },
  {
    no: '05',
    title: '개발·운영 큐 분리',
    desc: '같은 Redis를 써도 prefix 자동 분기로 섞이지 않음',
    where: 'getBullPrefix() → bull vs ais-dev',
    help: {
      what: 'NODE_ENV에 따라 BullMQ prefix를 자동 분기합니다.',
      why: '로컬 개발 중 수동 트리거가 운영 워커에서 실행되면 대형 사고.',
      howToChange: ['새 큐 추가 시에도 반드시 getBullMQOptions() 사용'],
    },
  },
  {
    no: '06',
    title: 'Flow 자동 연쇄',
    desc: 'persist 완료 → triggerClassify → triggerAnalysis 자동 진행',
    where: 'BullMQ FlowProducer + persist 완료 콜백',
    help: {
      what: '수집부터 분석까지 사용자 개입 없이 자동 연쇄됩니다.',
      why: '사용자가 단계마다 버튼을 눌러야 한다면 UX가 크게 손상됩니다.',
      howToChange: ['중간 단계 추가 → persist 완료 콜백에 새 triggerX() 삽입'],
    },
  },
  {
    no: '07',
    title: '진행률 하트비트',
    desc: 'DB progress JSONB + lastProgressAtMs로 UI 판정',
    where: '2초 폴링 + Live/Idle/Slow/Stalled 분류',
    help: {
      what: '단순 status가 아닌 "마지막 업데이트 시각" 기반으로 살아있는지 판단.',
      why: 'Job이 running인데 실제로는 hang된 상태를 구별해야 합니다.',
      howToChange: ['임계값 조정 → run-progress-inline.tsx의 HEARTBEAT_THRESHOLDS'],
    },
  },
  {
    no: '08',
    title: '프리셋 스냅샷',
    desc: '분석 시작 시점의 설정을 applied_preset JSONB에 보존',
    where: '감사·재현 가능',
    help: {
      what: '프리셋이 나중에 바뀌어도, 과거 실행은 당시 설정 그대로 남습니다.',
      why: '리포트 재현성과 감사 추적성을 보장하기 위해.',
      howToChange: ['프리셋 스키마 변경 → 하위 호환성 고려 (과거 JSONB 읽기 유지)'],
    },
  },
];

function DesignPrinciples({
  onOpenHelp,
  onOpenAi,
}: {
  onOpenHelp: (ctx: HelpContext) => void;
  onOpenAi: (ctx: { refId: string; shortCode: string; label: string }) => void;
}) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <Workflow className="h-4 w-4" />
        핵심 설계 포인트
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {DESIGN_PRINCIPLES.map((p) => {
          const refId = buildRef('principle', 'principle', p.no);
          const shortCode = `WF-P${p.no}`;
          return (
            <div
              key={p.no}
              className="group rounded-md border bg-background/60 px-3 py-2.5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-semibold text-sm">{p.title}</p>
                <RefBadge shortCode={shortCode} refId={refId} size="xs" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
              <p className="text-[11px] font-mono text-muted-foreground mt-1.5 border-t pt-1.5">
                {p.where}
              </p>
              <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <HelpButton
                  size="xs"
                  onClick={() =>
                    onOpenHelp({
                      title: p.title,
                      refId,
                      shortCode,
                      stageTitle: '핵심 설계 원칙',
                      help: p.help,
                    })
                  }
                />
                <AiButton
                  size="xs"
                  onClick={() => onOpenAi({ refId, shortCode, label: p.title })}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
