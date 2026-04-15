import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom에서 ResizeObserver polyfill
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// 각 테스트 후 DOM 정리 (vitest globals가 없을 때도 자동 cleanup 보장)
afterEach(() => {
  cleanup();
});
