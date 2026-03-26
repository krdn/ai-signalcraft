// 브라우저 기반 수집기 추상 클래스 -- 브라우저 라이프사이클(launch, context, close) 공통 관리
import { type Browser, type Page } from 'playwright';
import { launchBrowser, createBrowserContext } from '../utils/browser';
import type { Collector, CollectionOptions } from './base';

export interface BrowserCollectorConfig {
  pageDelay: { min: number; max: number };
  postDelay: { min: number; max: number };
  defaultMaxItems: number;
  maxSearchPages: number;
}

export abstract class BrowserCollector<T> implements Collector<T> {
  abstract readonly source: string;
  protected abstract readonly config: BrowserCollectorConfig;

  async *collect(options: CollectionOptions): AsyncGenerator<T[], void, unknown> {
    let browser: Browser | null = null;
    try {
      browser = await launchBrowser();
      const context = await createBrowserContext(browser);
      const page = await context.newPage();
      yield* this.doCollect(page, options);
    } finally {
      if (browser) await browser.close();
    }
  }

  protected abstract doCollect(
    page: Page,
    options: CollectionOptions,
  ): AsyncGenerator<T[], void, unknown>;
}
