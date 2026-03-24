import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';

describe('db', () => {
  it('should export db client', async () => {
    const { db } = await import('../src/db');
    expect(db).toBeDefined();
  });

  it('should export all schema tables', async () => {
    const schema = await import('../src/db/schema');
    expect(schema.collectionJobs).toBeDefined();
    expect(schema.articles).toBeDefined();
    expect(schema.videos).toBeDefined();
    expect(schema.comments).toBeDefined();
  });

  it('should have correct table names', async () => {
    const schema = await import('../src/db/schema');
    // Drizzle getTableName API로 테이블명 검증
    expect(getTableName(schema.collectionJobs)).toBe('collection_jobs');
    expect(getTableName(schema.articles)).toBe('articles');
    expect(getTableName(schema.videos)).toBe('videos');
    expect(getTableName(schema.comments)).toBe('comments');
  });
});
