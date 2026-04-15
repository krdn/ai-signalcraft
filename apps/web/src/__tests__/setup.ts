import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// 각 테스트 후 DOM 정리 (vitest globals가 없을 때도 자동 cleanup 보장)
afterEach(() => {
  cleanup();
});
