'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Info,
  Server,
  XCircle,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/* ─────────── 타입 정의 ─────────── */
type SupportLevel = 'full' | 'partial' | 'none';
type RecommendLevel = 'best' | 'good' | 'caution' | 'notfit';

interface PlatformConstraint {
  label: string;
  impact: string;
  level: 'critical' | 'warn' | 'info';
}

interface PlatformCost {
  item: string;
  monthly: string;
  note?: string;
}

interface PlatformSupport {
  web: SupportLevel;
  worker: SupportLevel;
  pgvector: SupportLevel;
  volume: SupportLevel;
  koreanRegion: SupportLevel;
}

interface Platform {
  id: string;
  name: string;
  tagline: string;
  recommend: RecommendLevel;
  recommendLabel: string;
  icon: string;
  summary: string;
  support: PlatformSupport;
  costs: PlatformCost[];
  totalMonthly: string;
  pros: string[];
  cons: string[];
  constraints: PlatformConstraint[];
  verdict: string;
}

/* ─────────── 데이터 ─────────── */
const PLATFORMS: Platform[] = [
  {
    id: 'homeserver',
    name: '홈 서버 (현행)',
    tagline: '192.168.0.5 Docker Compose',
    recommend: 'best',
    recommendLabel: '현재 최적',
    icon: '🏠',
    summary:
      '현재 운영 중인 온프레미스 홈 서버. Docker Compose 구성이 그대로 사용되며 소규모 팀(3~5명) 수동 트리거 워크플로우에 완벽히 부합합니다.',
    support: {
      web: 'full',
      worker: 'full',
      pgvector: 'full',
      volume: 'full',
      koreanRegion: 'full',
    },
    costs: [
      { item: '전기세 (서버)', monthly: '₩5,000~15,000' },
      { item: 'Cloudflare Tunnel', monthly: '무료', note: '외부 HTTPS 접근' },
      { item: '도메인', monthly: '~₩2,000', note: '연간 약 24,000원' },
    ],
    totalMonthly: '₩10,000~20,000',
    pros: [
      '비용 최저 — 전기세만 부담',
      'Docker Compose 그대로 사용 (이전 비용 0)',
      '모든 기술 제약 해결됨 (Playwright, pgvector, 볼륨)',
      '국내 네이버·DC인사이드 스크래핑 레이턴시 최소',
      'Xenova 모델 캐시 영구 보존',
    ],
    cons: [
      '하드웨어 장애 시 수동 복구 필요',
      '무정전 전원장치(UPS) 없으면 정전 위험',
      '인터넷 회선 장애 = 서비스 중단',
      '24/7 온콜 구조 없음',
    ],
    constraints: [
      {
        label: 'Cloudflare Tunnel 권장',
        impact: '포트포워딩 없이 외부 HTTPS — Zero Trust 보안 포함',
        level: 'info',
      },
      {
        label: 'GitHub Actions SSH 배포',
        impact: 'main 브랜치 push 시 자동 배포 설정 가능',
        level: 'info',
      },
    ],
    verdict:
      '소규모 팀, 수동 트리거 워크플로우, 국내 데이터 수집 중심인 현재 사용 패턴에 가장 적합합니다. 비용 대비 효율이 압도적으로 높습니다.',
  },
  {
    id: 'railway',
    name: 'Railway',
    tagline: 'PaaS — Docker 네이티브',
    recommend: 'good',
    recommendLabel: '이전 시 추천',
    icon: '🚂',
    summary:
      '홈 서버 불안정 또는 팀 확장 시 가장 먼저 검토할 옵션. Docker Compose와 거의 동일한 방식으로 web/worker를 각각 서비스로 분리 배포할 수 있습니다.',
    support: {
      web: 'full',
      worker: 'full',
      pgvector: 'partial',
      volume: 'full',
      koreanRegion: 'none',
    },
    costs: [
      { item: 'Web 서비스 (사용량 기반)', monthly: '$5~15' },
      { item: 'Worker 서비스 (상시 실행)', monthly: '$5~20' },
      { item: 'PostgreSQL (커스텀 이미지)', monthly: '$5', note: 'pgvector/pgvector:pg16' },
      { item: 'Redis', monthly: '$5' },
    ],
    totalMonthly: '$20~45 (약 ₩28,000~63,000)',
    pros: [
      'Docker Compose → Railway 서비스 구조 1:1 매핑',
      'Web/Worker 서비스 분리 배포 지원',
      '볼륨 마운트 지원 (Xenova 모델 캐시)',
      'GitHub 연동 자동 배포 간편',
      '환경변수 GUI 관리',
      '사용량 기반 과금 (트래픽 적을 때 저렴)',
    ],
    cons: [
      '한국 리전 없음 (US/EU)',
      'pgvector는 커스텀 이미지로 별도 설정 필요',
      '대용량 트래픽 시 비용 예측 어려움',
      '프리티어 없음 (최소 $5/월)',
    ],
    constraints: [
      {
        label: 'pgvector 커스텀 이미지',
        impact: 'railway.toml에서 pgvector/pgvector:pg16 이미지 지정 필요',
        level: 'warn',
      },
      {
        label: '한국 리전 미제공',
        impact: '네이버·DC인사이드 스크래핑 레이턴시 50~150ms 증가 가능',
        level: 'warn',
      },
    ],
    verdict:
      '홈 서버를 클라우드로 이전할 때 가장 마찰이 적은 경로입니다. Docker Compose 구성을 거의 그대로 이식할 수 있으며, 관리 오버헤드가 최소화됩니다.',
  },
  {
    id: 'flyio',
    name: 'Fly.io',
    tagline: 'Machines API — Docker 컨테이너',
    recommend: 'good',
    recommendLabel: '합리적 대안',
    icon: '✈️',
    summary:
      'Railway와 함께 Docker 친화적인 PaaS. Machines API로 Worker 장기 실행을 지원하며 비용도 합리적입니다. fly.toml 기반 멀티 서비스 구성.',
    support: {
      web: 'full',
      worker: 'full',
      pgvector: 'partial',
      volume: 'full',
      koreanRegion: 'none',
    },
    costs: [
      { item: 'Web (shared-cpu-1x, 512MB)', monthly: '$5' },
      { item: 'Worker (shared-cpu-2x, 2GB)', monthly: '$15' },
      { item: 'Fly Postgres (커스텀)', monthly: '$7' },
      { item: 'Upstash Redis (파트너)', monthly: '$10' },
    ],
    totalMonthly: '$37 (약 ₩52,000)',
    pros: [
      '합리적인 고정 비용 ($37/월)',
      'Machines API — Worker 컨테이너 장기 실행 완벽 지원',
      '볼륨 지원 (모델 캐시 영속화)',
      '글로벌 엣지 배포 지원',
      '멀티 리전 설정 가능',
    ],
    cons: [
      '한국 리전 없음',
      'pgvector 커스텀 설치 필요',
      'Railway 대비 설정 복잡도 약간 높음',
      'Upstash Redis는 HTTP 기반 — ioredis 호환 확인 필요',
    ],
    constraints: [
      {
        label: 'Upstash Redis 호환성',
        impact: 'ioredis 직접 연결이 아닌 HTTP 어댑터 필요할 수 있음',
        level: 'warn',
      },
    ],
    verdict:
      'Railway와 유사한 포지션이지만 설정 복잡도가 약간 높습니다. 비용은 비슷하며 Railway 서비스 한도에 걸릴 때 대안으로 검토합니다.',
  },
  {
    id: 'gcp',
    name: 'Google Cloud (GCP)',
    tagline: 'Cloud Run + GCE + Cloud SQL',
    recommend: 'caution',
    recommendLabel: '부분 제약',
    icon: '☁️',
    summary:
      'Cloud SQL PostgreSQL이 pgvector를 공식 지원합니다. 하지만 Worker를 Cloud Run에서 실행할 수 없어 GCE VM이 필수입니다. 비용 경쟁력은 있습니다.',
    support: {
      web: 'full',
      worker: 'partial',
      pgvector: 'full',
      volume: 'full',
      koreanRegion: 'full',
    },
    costs: [
      { item: 'Cloud Run Web (최소 1인스턴스)', monthly: '$12' },
      { item: 'GCE e2-small Worker (상시)', monthly: '$15' },
      { item: 'Cloud SQL PostgreSQL (db-f1-micro)', monthly: '$10' },
      { item: 'Memorystore Redis (basic M1)', monthly: '$21' },
    ],
    totalMonthly: '$58 (약 ₩82,000)',
    pros: [
      'Cloud SQL PostgreSQL → pgvector 15.3+ 공식 지원',
      '한국 리전 (asia-northeast3, 서울) 존재',
      'AWS 대비 상대적으로 저렴',
      'Cloud Run으로 Web 서버리스 처리',
    ],
    cons: [
      'Worker는 Cloud Run 불가 — GCE VM 별도 운영 필요',
      'GCE + Cloud Run 혼합 구성 — 관리 복잡도',
      'Memorystore Redis 비용이 높음 ($21)',
      '설정 복잡도 높음 (IAM, VPC, 서비스 어카운트)',
    ],
    constraints: [
      {
        label: 'Worker → GCE VM 전용',
        impact: 'Playwright 장기 실행이 Cloud Run 제한 초과 — GCE e2-small 별도 운영',
        level: 'warn',
      },
      {
        label: '혼합 아키텍처',
        impact: 'Cloud Run(Web) + GCE(Worker) 혼합 = 배포 파이프라인 이원화',
        level: 'warn',
      },
    ],
    verdict:
      '비용 효율은 준수하지만 Web과 Worker를 다른 플랫폼으로 나눠야 하는 아키텍처 분리가 관리 복잡도를 높입니다.',
  },
  {
    id: 'aws',
    name: 'AWS (ECS Fargate)',
    tagline: 'ECS + RDS + ElastiCache (서울 리전)',
    recommend: 'caution',
    recommendLabel: '엔터프라이즈용',
    icon: '🟠',
    summary:
      '완전 관리형 컨테이너 환경. 기능 완전성 최고이지만 비용과 운영 복잡도가 가장 높습니다. 데이터 규정 준수나 고가용성이 필수인 엔터프라이즈 고객 요구 시 검토합니다.',
    support: {
      web: 'full',
      worker: 'full',
      pgvector: 'full',
      volume: 'full',
      koreanRegion: 'full',
    },
    costs: [
      { item: 'ECS Fargate Web (0.5vCPU, 1GB)', monthly: '$12' },
      { item: 'ECS Fargate Worker (1vCPU, 2GB)', monthly: '$28' },
      { item: 'RDS PostgreSQL t3.micro', monthly: '$25' },
      { item: 'ElastiCache Redis t3.micro', monthly: '$17' },
      { item: 'ALB (Application Load Balancer)', monthly: '$20' },
      { item: 'EFS (Xenova 모델 캐시)', monthly: '$5' },
      { item: 'ECR + 데이터 전송', monthly: '$7' },
    ],
    totalMonthly: '$114 (약 ₩161,000)',
    pros: [
      '완전 관리형 — 모든 기능 지원',
      '한국 리전 (ap-northeast-2, 서울)',
      'pgvector RDS 지원',
      '엔터프라이즈급 SLA (99.9%+)',
      'EFS로 모델 캐시 공유 볼륨',
      'Auto Scaling, 고가용성 AZ 이중화',
    ],
    cons: [
      '비용 최고 ($114/월)',
      'IAM, VPC, 보안그룹, ALB 등 설정 복잡도 매우 높음',
      '소규모 팀에는 과도한 오버헤드',
      'Playwright Worker + Fargate = Chromium 레이어 관리 까다로움',
    ],
    constraints: [
      {
        label: 'Playwright Chromium 레이어',
        impact: 'Worker Docker 이미지 ~2GB — ECR 저장/전송 비용 및 콜드 스타트 지연',
        level: 'warn',
      },
      {
        label: '운영 복잡도',
        impact: '최소 AWS 전문 지식 필요 — 초기 셋업 2~3일 소요 예상',
        level: 'info',
      },
    ],
    verdict:
      '소규모 수동 트리거 워크플로우에는 과도하지만, 고객사 데이터 규정·SLA 요건이 생기면 이 구성이 유일한 선택지가 됩니다.',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    tagline: 'Serverless + Edge Functions',
    recommend: 'notfit',
    recommendLabel: '부적합',
    icon: '▲',
    summary:
      'Next.js Web 단독으로는 완벽하지만 BullMQ Worker와 Playwright가 Serverless 모델과 근본적으로 충돌합니다. Web만 올리고 Worker는 별도 VM에 두는 혼용 구성이 필요해 관리 복잡도만 증가합니다.',
    support: {
      web: 'full',
      worker: 'none',
      pgvector: 'partial',
      volume: 'none',
      koreanRegion: 'full',
    },
    costs: [
      { item: 'Vercel Pro', monthly: '$20' },
      { item: 'Neon Postgres (Starter)', monthly: '$19', note: 'pgvector 지원 확인 필요' },
      { item: 'Upstash Redis', monthly: '$10' },
      { item: 'Worker VM (별도 필요)', monthly: '+$15~30', note: '결국 혼용 구성' },
    ],
    totalMonthly: '$64~80 (불완전한 구성)',
    pros: [
      'Next.js 최적 배포 환경',
      '글로벌 CDN 엣지',
      '프리뷰 배포 (PR마다 미리보기)',
      '한국 엣지 PoP 존재',
    ],
    cons: [
      'BullMQ Worker — 상시 실행 프로세스 지원 불가 (Serverless 모델)',
      'Playwright Worker — 함수 실행 시간/메모리 초과',
      'Xenova 모델 캐시 볼륨 마운트 불가',
      '결국 Worker 전용 VM 추가 필요 = 혼용 구성',
      '혼용 시 배포 파이프라인 이원화 + 비용 증가',
    ],
    constraints: [
      {
        label: 'BullMQ Worker 실행 불가',
        impact: '시스템 핵심 기능(수집 파이프라인)의 70%가 동작하지 않음',
        level: 'critical',
      },
      {
        label: 'Playwright 실행 불가',
        impact: 'Chromium 브라우저 장기 실행이 Serverless 함수 제한 초과',
        level: 'critical',
      },
      {
        label: '볼륨 마운트 없음',
        impact: 'Xenova Transformers 모델 캐시 영속화 불가 → 재시작마다 재다운로드',
        level: 'critical',
      },
    ],
    verdict:
      'BullMQ Worker와 Playwright가 Serverless 아키텍처와 근본적으로 충돌합니다. Web 단독이라면 최적이지만 이 시스템에는 부적합합니다.',
  },
  {
    id: 'azure',
    name: 'Azure Container Apps',
    tagline: 'Microsoft Azure — 한국 중부 리전',
    recommend: 'caution',
    recommendLabel: '대안 가능',
    icon: '🔷',
    summary:
      'AWS와 비슷한 완전 관리형 구성. Azure Container Apps로 Web/Worker 모두 지원 가능하며 한국 리전(Korea Central)이 있습니다. 비용은 AWS보다 약간 낮습니다.',
    support: {
      web: 'full',
      worker: 'full',
      pgvector: 'partial',
      volume: 'full',
      koreanRegion: 'full',
    },
    costs: [
      { item: 'Container Apps Web', monthly: '$15' },
      { item: 'Container Apps Worker (상시)', monthly: '$25' },
      { item: 'Azure DB for PostgreSQL Flexible', monthly: '$35' },
      { item: 'Azure Cache for Redis (C0)', monthly: '$16' },
    ],
    totalMonthly: '$91 (약 ₩128,000)',
    pros: [
      '한국 리전 (Korea Central)',
      'Container Apps — Web/Worker 모두 지원',
      'AWS보다 약간 저렴',
      '기업 MS 계약 보유 시 크레딧 활용 가능',
    ],
    cons: [
      'pgvector — Azure DB Flexible에서 별도 확장 설치 필요',
      'AWS 대비 국내 레퍼런스 적음',
      '설정 복잡도 높음 (ARM 템플릿, RBAC)',
      'Container Apps 스케일-투-제로 — Worker는 상시 실행 필요',
    ],
    constraints: [
      {
        label: 'pgvector 확장 설치',
        impact: 'Azure PostgreSQL Flexible에서 pgvector 수동 설치/활성화 필요',
        level: 'warn',
      },
    ],
    verdict:
      'AWS와 비슷한 포지션이지만 국내 레퍼런스가 적습니다. 기업 Azure 계약이 이미 있는 경우에 한해 검토합니다.',
  },
];

/* ─────────── 상수 ─────────── */
const RECOMMEND_STYLES: Record<RecommendLevel, { badge: string; border: string; bg: string }> = {
  best: {
    badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/5',
  },
  good: {
    badge: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
    border: 'border-blue-500/30',
    bg: '',
  },
  caution: {
    badge: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
    border: 'border-border',
    bg: '',
  },
  notfit: {
    badge: 'bg-red-500/15 text-red-700 border-red-500/30',
    border: 'border-border',
    bg: '',
  },
};

const SUPPORT_ICONS: Record<SupportLevel, { icon: React.ElementType; cls: string; label: string }> =
  {
    full: { icon: CheckCircle2, cls: 'text-emerald-600', label: '완전 지원' },
    partial: { icon: AlertTriangle, cls: 'text-amber-500', label: '부분 지원' },
    none: { icon: XCircle, cls: 'text-red-500', label: '지원 불가' },
  };

const CONSTRAINT_STYLES = {
  critical: { icon: XCircle, cls: 'text-red-500', bg: 'bg-red-500/8 border-red-500/20' },
  warn: { icon: AlertTriangle, cls: 'text-amber-500', bg: 'bg-amber-500/8 border-amber-500/20' },
  info: { icon: Info, cls: 'text-blue-500', bg: 'bg-blue-500/8 border-blue-500/20' },
};

const SUPPORT_LABELS = {
  web: 'Web 서버',
  worker: 'BullMQ Worker',
  pgvector: 'pgvector',
  volume: '볼륨 마운트',
  koreanRegion: '한국 리전',
};

/* ─────────── 서브 컴포넌트 ─────────── */
function SupportCell({ level }: { level: SupportLevel }) {
  const { icon: Icon, cls, label } = SUPPORT_ICONS[level];
  return (
    <span className={cn('flex items-center gap-1', cls)}>
      <Icon className="size-4 shrink-0" />
      <span className="text-xs">{label}</span>
    </span>
  );
}

function PlatformCard({
  platform,
  isOpen,
  onToggle,
}: {
  platform: Platform;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const style = RECOMMEND_STYLES[platform.recommend];

  return (
    <Card className={cn('transition-all duration-200', style.border, style.bg)}>
      {/* 헤더 */}
      <CardHeader className="cursor-pointer select-none pb-3" onClick={onToggle}>
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">{platform.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <CardTitle className="text-base">{platform.name}</CardTitle>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                  style.badge,
                )}
              >
                {platform.recommendLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{platform.tagline}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold">{platform.totalMonthly}</div>
              <div className="text-xs text-muted-foreground">/월 예상</div>
            </div>
            {isOpen ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </div>
        </div>
        {/* 지원 현황 요약 — 항상 표시 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {(Object.entries(platform.support) as [keyof PlatformSupport, SupportLevel][]).map(
            ([key, level]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{SUPPORT_LABELS[key]}</span>
                <SupportCell level={level} />
              </div>
            ),
          )}
        </div>
      </CardHeader>

      {/* 상세 패널 */}
      {isOpen && (
        <CardContent className="pt-0 space-y-5">
          <div className="border-t pt-4" />

          {/* 요약 */}
          <p className="text-sm text-muted-foreground leading-relaxed">{platform.summary}</p>

          {/* 제약 사항 */}
          {platform.constraints.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                주요 제약 / 주의사항
              </h4>
              <div className="space-y-2">
                {platform.constraints.map((c, i) => {
                  const { icon: Icon, cls, bg } = CONSTRAINT_STYLES[c.level];
                  return (
                    <div key={i} className={cn('flex gap-2 rounded-md border px-3 py-2', bg)}>
                      <Icon className={cn('size-4 mt-0.5 shrink-0', cls)} />
                      <div>
                        <div className="text-xs font-medium">{c.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{c.impact}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 비용 명세 + 장단점 */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* 비용 */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                월 비용 명세
              </h4>
              <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
                {platform.costs.map((c, i) => (
                  <div key={i} className="flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground truncate">{c.item}</span>
                    <span className="font-medium shrink-0">{c.monthly}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-2 text-xs font-semibold border-t pt-1.5 mt-1.5">
                  <span>합계</span>
                  <span className="text-primary">{platform.totalMonthly}</span>
                </div>
              </div>
            </div>

            {/* 장점 */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                장점
              </h4>
              <ul className="space-y-1.5">
                {platform.pros.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-emerald-600" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 단점 */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-red-600">단점</h4>
              <ul className="space-y-1.5">
                {platform.cons.map((c, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <XCircle className="size-3.5 mt-0.5 shrink-0 text-red-500" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 최종 판정 */}
          <div className="rounded-lg bg-muted/50 border px-4 py-3">
            <div className="flex gap-2">
              <Zap className="size-4 mt-0.5 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed">
                <span className="font-semibold">판정 — </span>
                {platform.verdict}
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ─────────── 비교 매트릭스 탭 ─────────── */
function ComparisonMatrix() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wider w-36">
              플랫폼
            </th>
            {Object.values(SUPPORT_LABELS).map((l) => (
              <th
                key={l}
                className="text-center py-3 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider min-w-[80px]"
              >
                {l}
              </th>
            ))}
            <th className="text-right py-3 pl-4 font-medium text-muted-foreground text-xs uppercase tracking-wider min-w-[120px]">
              월 비용
            </th>
            <th className="text-center py-3 pl-4 font-medium text-muted-foreground text-xs uppercase tracking-wider min-w-[90px]">
              추천도
            </th>
          </tr>
        </thead>
        <tbody>
          {PLATFORMS.map((p) => {
            const style = RECOMMEND_STYLES[p.recommend];
            return (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span>{p.icon}</span>
                    <div>
                      <div className="font-medium text-xs">{p.name}</div>
                      <div className="text-xs text-muted-foreground hidden sm:block">
                        {p.tagline.split('—')[0].trim()}
                      </div>
                    </div>
                  </div>
                </td>
                {(Object.keys(SUPPORT_LABELS) as (keyof PlatformSupport)[]).map((key) => {
                  const { icon: Icon, cls } = SUPPORT_ICONS[p.support[key]];
                  return (
                    <td key={key} className="py-3 px-2 text-center">
                      <Icon className={cn('size-4 mx-auto', cls)} />
                    </td>
                  );
                })}
                <td className="py-3 pl-4 text-right">
                  <span className="text-xs font-medium">{p.totalMonthly}</span>
                </td>
                <td className="py-3 pl-4 text-center">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                      style.badge,
                    )}
                  >
                    {p.recommendLabel}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────── 의사결정 로드맵 ─────────── */
function DecisionRoadmap() {
  const steps = [
    {
      phase: '현재 (소규모 팀, 수동 트리거)',
      recommendation: '홈 서버 유지',
      cost: '₩10,000~20,000/월',
      action: 'Cloudflare Tunnel + GitHub Actions 자동 배포 추가',
      color: 'border-emerald-500 bg-emerald-500/5',
      badge: 'bg-emerald-500/15 text-emerald-700',
    },
    {
      phase: '홈 서버 불안정 / 팀 5~10명',
      recommendation: 'Railway 이전',
      cost: '$20~45/월',
      action: 'docker-compose.prod.yml → Railway 서비스 3개로 이식',
      color: 'border-blue-500 bg-blue-500/5',
      badge: 'bg-blue-500/15 text-blue-700',
    },
    {
      phase: '엔터프라이즈 고객 요구 / SLA 필요',
      recommendation: 'AWS ECS Fargate (서울)',
      cost: '$114/월',
      action: 'ECS + RDS + ElastiCache 풀 스택 구성',
      color: 'border-amber-500 bg-amber-500/5',
      badge: 'bg-amber-500/15 text-amber-700',
    },
  ];

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className={cn('rounded-lg border-l-4 p-4', step.color)}>
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-muted-foreground">{step.phase}</span>
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', step.badge)}>
              {step.recommendation}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 ml-7">
            <div>
              <div className="text-xs text-muted-foreground">예상 비용</div>
              <div className="text-sm font-semibold">{step.cost}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">다음 액션</div>
              <div className="text-sm">{step.action}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────── 메인 페이지 ─────────── */
export default function InfrastructurePage() {
  const [openId, setOpenId] = useState<string | null>('homeserver');

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cloud className="size-5 text-primary" />
            <h1 className="text-2xl font-bold">배포 플랫폼 분석</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            AI SignalCraft를 클라우드에 배포할 때 비용·기능·운영 복잡도를 고려한 플랫폼별 심층 분석
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(['best', 'good', 'caution', 'notfit'] as RecommendLevel[]).map((r) => (
            <span
              key={r}
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-1 font-medium',
                RECOMMEND_STYLES[r].badge,
              )}
            >
              {
                {
                  best: '현재 최적',
                  good: '이전 시 추천',
                  caution: '조건부 가능',
                  notfit: '부적합',
                }[r]
              }
            </span>
          ))}
        </div>
      </div>

      {/* 핵심 제약 배너 */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <Server className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-2">
                이 시스템의 핵심 기술 제약
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: 'BullMQ Worker', desc: '상시 실행 프로세스 필수 → Serverless 불가' },
                  { label: 'Playwright Chromium', desc: 'Worker 이미지 ~2GB → 장기 실행 필요' },
                  { label: 'pgvector', desc: 'PostgreSQL 확장 필요 → 일반 관리형 DB 제한' },
                  { label: 'Xenova 모델 캐시', desc: '볼륨 영속화 필수 → 파일시스템 바인드' },
                  { label: 'Gemini OAuth', desc: '~/.gemini 디렉토리 마운트 필요' },
                  { label: '국내 스크래핑', desc: '네이버·DC인사이드 → 한국 IP 레이턴시 민감' },
                ].map((item) => (
                  <div key={item.label} className="flex gap-2 text-xs">
                    <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-amber-600" />
                    <span>
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground"> — {item.desc}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 탭 */}
      <Tabs defaultValue="platforms">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="platforms">플랫폼별 분석</TabsTrigger>
          <TabsTrigger value="matrix">비교 매트릭스</TabsTrigger>
          <TabsTrigger value="roadmap">의사결정 로드맵</TabsTrigger>
        </TabsList>

        {/* 플랫폼별 상세 */}
        <TabsContent value="platforms" className="space-y-3 mt-4">
          {PLATFORMS.map((p) => (
            <PlatformCard
              key={p.id}
              platform={p}
              isOpen={openId === p.id}
              onToggle={() => toggle(p.id)}
            />
          ))}
        </TabsContent>

        {/* 비교 매트릭스 */}
        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">전체 비교 매트릭스</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonMatrix />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 의사결정 로드맵 */}
        <TabsContent value="roadmap" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">단계별 의사결정 로드맵</CardTitle>
            </CardHeader>
            <CardContent>
              <DecisionRoadmap />
            </CardContent>
          </Card>
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="py-4">
              <div className="flex gap-3">
                <XCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-semibold">Vercel은 이 시스템에 부적합합니다</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    BullMQ Worker(상시 실행 프로세스)와 Playwright(Chromium 장기 실행)가 Serverless
                    모델과 근본적으로 충돌합니다. Web만 Vercel에 올리고 Worker를 별도 VM에 두는 혼용
                    구성은 두 플랫폼을 동시에 관리해야 해 복잡도가 오히려 높아집니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
