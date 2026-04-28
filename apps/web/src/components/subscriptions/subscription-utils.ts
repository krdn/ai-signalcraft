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

export const SOURCE_FANOUT_CHILDREN: Record<string, string[]> = {
  'naver-news': ['naver-comments'],
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

/**
 * 새 구독 등록 폼을 여는 글로벌 이벤트.
 *
 * SUBS-002: layout.tsx의 isFormOpen 상태를 children인 subscription-table에서 호출하기 위해
 * window CustomEvent로 통신. 신규 파일·zustand 도입 없이 cross-component 트리거를 구현.
 */
export const OPEN_SUBSCRIPTION_FORM_EVENT = 'subscriptions:open-form';

export function dispatchOpenSubscriptionForm(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_SUBSCRIPTION_FORM_EVENT));
}
