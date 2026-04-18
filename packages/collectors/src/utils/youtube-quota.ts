const QUOTA_COSTS = {
  'search.list': 100,
  'videos.list': 1,
  'commentThreads.list': 1,
  'comments.list': 1,
} as const;

type QuotaOperation = keyof typeof QUOTA_COSTS;

const DAILY_QUOTA = 10_000;
const DEFAULT_EXHAUSTION_THRESHOLD = 500;

export class QuotaTracker {
  private used = 0;

  track(operation: QuotaOperation, count = 1): void {
    this.used += QUOTA_COSTS[operation] * count;
  }

  isExhausted(threshold = DEFAULT_EXHAUSTION_THRESHOLD): boolean {
    return this.getRemaining() <= threshold;
  }

  getRemaining(): number {
    return Math.max(0, DAILY_QUOTA - this.used);
  }

  getUsed(): number {
    return this.used;
  }

  reset(): void {
    this.used = 0;
  }
}
