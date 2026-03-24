import { z } from 'zod';

export const CollectionOptionsSchema = z.object({
  keyword: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  maxItems: z.number().optional(),
  maxComments: z.number().optional(),
});
export type CollectionOptions = z.infer<typeof CollectionOptionsSchema>;

export interface CollectionResult<T> {
  source: string;
  items: T[];
  totalCollected: number;
  errors: Error[];
  metadata: {
    startedAt: Date;
    completedAt: Date;
    pagesFetched: number;
  };
}

// 모든 수집기가 구현하는 인터페이스
export interface Collector<T = unknown> {
  readonly source: string;
  collect(options: CollectionOptions): AsyncGenerator<T[], void, unknown>;
  // AsyncGenerator로 청크 단위 yield -- 메모리 효율 + 진행률 추적
}
