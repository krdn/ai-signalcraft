import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export const SOURCE_LABEL_MAP: Record<string, string> = {
  'naver-news': '네이버',
  'naver-comments': '네이버 댓글',
  youtube: '유튜브',
  dcinside: 'DC',
  fmkorea: '에펨',
  clien: '클리앙',
};

export const SOURCE_COLOR_MAP: Record<string, string> = {
  'naver-news': '#03C75A',
  'naver-comments': '#4ADE80',
  youtube: '#FF0000',
  dcinside: '#1E3A5F',
  fmkorea: '#3B82F6',
  clien: '#8B5CF6',
};

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return '-';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko });
  } catch {
    return '-';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return '활성';
    case 'paused':
      return '정지';
    case 'error':
      return '오류';
    default:
      return status;
  }
}

export function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'active':
      return 'default';
    case 'paused':
      return 'secondary';
    case 'error':
      return 'destructive';
    default:
      return 'secondary';
  }
}
