import { customType } from 'drizzle-orm/pg-core';

/**
 * pgvector vector(384) 컬럼 타입 — multilingual-e5-small 임베딩 저장용
 */
export const vector384 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(384)';
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
});
