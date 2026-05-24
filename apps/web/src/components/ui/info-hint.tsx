import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

interface InfoHintProps {
  children: ReactNode;
  /** Tailwind width class. 기본값: w-80 */
  width?: string;
}

/**
 * 라벨 옆에 작은 ⓘ 아이콘을 배치하고, 호버(마우스 오버) 시 HoverCard로 도움말을 표시합니다.
 * 터치/모바일 환경이나 Dialog 내부에서는 HelpPopover(click 방식)를 사용하세요.
 */
export function InfoHint({ children, width = 'w-80' }: InfoHintProps) {
  return (
    <HoverCard>
      <HoverCardTrigger
        className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-help"
        aria-label="도움말"
      >
        <Info className="h-3.5 w-3.5" />
      </HoverCardTrigger>
      <HoverCardContent side="top" className={`${width} text-xs leading-relaxed`}>
        {children}
      </HoverCardContent>
    </HoverCard>
  );
}
