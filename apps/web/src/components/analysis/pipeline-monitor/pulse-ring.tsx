import type { ReactNode } from 'react';

interface PulseRingProps {
  active: boolean;
  /** 링 색상 클래스. 기본 bg-blue-400 */
  color?: string;
  children: ReactNode;
}

/** 활성 상태에서 외곽 ping 링을 보여주는 래퍼 */
export function PulseRing({ active, color = 'bg-blue-400', children }: PulseRingProps) {
  if (!active) return <>{children}</>;

  return (
    <span className="relative inline-flex">
      <span
        className={`absolute inset-0 rounded-[inherit] ${color} opacity-20 animate-ping`}
        style={{ animationDuration: '1.5s' }}
      />
      {children}
    </span>
  );
}
