import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
};

export function HelpPopover({ children, side = 'right', className }: Props) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary">
        <HelpCircle className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent side={side} align="start" className={cn('w-72 p-4 text-sm', className)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
