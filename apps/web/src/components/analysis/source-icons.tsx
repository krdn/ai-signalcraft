import { Newspaper, CirclePlay, MessageSquareMore, Monitor, Users } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// 소스별 아이콘·라벨·색상 매핑
export const SOURCE_META: Record<string, {
  label: string;
  icon: typeof Newspaper;
  color: string;
}> = {
  naver: {
    label: '네이버',
    icon: Newspaper,
    color: 'text-green-500',
  },
  youtube: {
    label: '유튜브',
    icon: CirclePlay,
    color: 'text-red-500',
  },
  dcinside: {
    label: 'DC갤러리',
    icon: Monitor,
    color: 'text-blue-500',
  },
  fmkorea: {
    label: '에펨코리아',
    icon: Users,
    color: 'text-orange-500',
  },
  clien: {
    label: '클리앙',
    icon: MessageSquareMore,
    color: 'text-sky-500',
  },
};

// progress JSONB에서 소스 키 목록 추출
type ProgressData = Record<string, { status: string; posts?: number; articles?: number; videos?: number; comments: number }>;

export function extractSources(progress: unknown): string[] {
  if (!progress || typeof progress !== 'object') return [];
  const p = progress as Record<string, unknown>;
  const known = Object.keys(SOURCE_META);
  return known.filter((key) => key in p);
}

// 수집 건수 합산 (기사/영상/게시글 + 댓글)
export function summarizeCounts(progress: unknown): { items: number; comments: number } {
  if (!progress || typeof progress !== 'object') return { items: 0, comments: 0 };
  const p = progress as ProgressData;
  let items = 0;
  let comments = 0;
  for (const val of Object.values(p)) {
    if (val && typeof val === 'object') {
      items += (val.articles ?? 0) + (val.videos ?? 0) + (val.posts ?? 0);
      comments += val.comments ?? 0;
    }
  }
  return { items, comments };
}

// 소스 아이콘 배지 (Tooltip 포함)
export function SourceBadges({ sources }: { sources: string[] }) {
  if (sources.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {sources.map((key) => {
        const meta = SOURCE_META[key];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <Tooltip key={key}>
            <TooltipTrigger>
              <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {meta.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// 소요 시간 계산 (createdAt → updatedAt)
export function formatDuration(createdAt: string | Date, updatedAt: string | Date): string {
  const start = new Date(createdAt).getTime();
  const end = new Date(updatedAt).getTime();
  const diff = Math.max(0, end - start);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  if (minutes < 60) return `${minutes}분 ${remainSec}초`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}시간 ${remainMin}분`;
}
