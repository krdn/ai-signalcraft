import { customType } from 'drizzle-orm/pg-core';

/**
 * pgvector vector(384) 컬럼 타입
 * multilingual-e5-small 임베딩(384차원) 저장용
 *
 * JS number[] ↔ pgvector 문자열 표현 간 변환 처리
 */
export const vector384 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(384)';
  },
  fromDriver(value: string): number[] {
    // pgvector가 '[0.1,0.2,...]' 형태로 반환
    return JSON.parse(value);
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
});
