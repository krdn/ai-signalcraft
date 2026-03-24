// 에펨코리아 수집기 -- TDD RED 스텁
import type { Collector, CollectionOptions } from './base';
import type { CommunityPost } from '../types/community';

export class FMKoreaCollector implements Collector<CommunityPost> {
  readonly source = 'fmkorea';

  async *collect(_options: CollectionOptions): AsyncGenerator<CommunityPost[], void, unknown> {
    // TODO: 구현
    throw new Error('Not implemented');
  }
}
