import type { Collector } from './base';

const collectors = new Map<string, Collector>();

export function registerCollector(collector: Collector): void {
  collectors.set(collector.source, collector);
}

export function getCollector(source: string): Collector | undefined {
  return collectors.get(source);
}

export function getAllCollectors(): Collector[] {
  return Array.from(collectors.values());
}
