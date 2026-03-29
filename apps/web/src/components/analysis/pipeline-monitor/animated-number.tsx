'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, useTransform } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  /** 스프링 감쇠 지속시간 (ms). 기본 400 */
  duration?: number;
  /** 숫자 포맷 함수. 기본은 toLocaleString */
  format?: (n: number) => string;
  className?: string;
}

const defaultFormat = (n: number) => n.toLocaleString('ko-KR');

export function AnimatedNumber({
  value,
  duration = 400,
  format = defaultFormat,
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration, bounce: 0 });
  const display = useTransform(spring, (v) => format(Math.round(v)));

  // value 변경 시 스프링 목표값 갱신
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  // DOM 직접 업데이트 (리렌더 없이 60fps)
  useEffect(() => {
    const unsub = display.on('change', (v) => {
      if (ref.current) ref.current.textContent = v;
    });
    return unsub;
  }, [display]);

  return (
    <span ref={ref} className={className}>
      {format(Math.round(value))}
    </span>
  );
}
