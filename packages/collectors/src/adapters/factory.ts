import type { Collector } from './base';
import { RssCollector } from './rss';
import { HtmlCollector, type HtmlSelectors } from './html';

export type DynamicAdapterType = 'rss' | 'html';

/**
 * DB의 data_sources 행에서 BullMQ job.data로 직렬화되는 스냅샷.
 * 워커는 이 스냅샷을 factory에 넘겨 Collector 인스턴스를 생성한다 —
 * BullMQ 재실행 시 일관성 유지 + 워커의 DB 의존성 최소화.
 */
export interface DataSourceSnapshot {
  id: string;
  name: string;
  adapterType: DynamicAdapterType;
  url: string;
  config: Record<string, unknown> | null;
  defaultLimit: number;
}

export function buildDynamicCollector(src: DataSourceSnapshot): Collector {
  switch (src.adapterType) {
    case 'rss':
      return new RssCollector({
        feedUrl: src.url,
        maxItems: src.defaultLimit,
      });
    case 'html': {
      const selectors = (src.config?.selectors ?? null) as HtmlSelectors | null;
      if (!selectors || !selectors.item || !selectors.title || !selectors.link) {
        throw new Error(
          `HTML 소스 '${src.name}' (${src.id})는 config.selectors.{item,title,link}가 필요합니다.`,
        );
      }
      return new HtmlCollector({
        pageUrl: src.url,
        selectors,
        maxItems: src.defaultLimit,
      });
    }
    default: {
      const exhaustive: never = src.adapterType;
      throw new Error(`지원하지 않는 adapterType: ${String(exhaustive)}`);
    }
  }
}
