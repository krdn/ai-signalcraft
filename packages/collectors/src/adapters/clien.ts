// 클리앙 수집기 -- TDD RED 스텁
import type { Collector, CollectionOptions } from './base';
import type { CommunityPost } from '../types/community';

export class ClienCollector implements Collector<CommunityPost> {
  readonly source = 'clien';

  async *collect(_options: CollectionOptions): AsyncGenerator<CommunityPost[], void, unknown> {
    // TODO: 구현
    throw new Error('Not implemented');
  }
}
