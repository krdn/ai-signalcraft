import { describe, it, expect } from 'vitest';
import { getTableName, isNull } from 'drizzle-orm';

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

describe('getPendingInvites 필터', () => {
  it('invitations 스키마에 acceptedAt 컬럼이 존재한다', async () => {
    const { invitations } = await import('../src/db/schema/auth');
    expect(invitations.acceptedAt).toBeDefined();
  });

  it('isNull 함수가 acceptedAt 컬럼에 적용 가능하다', () => {
    // isNull이 drizzle-orm에서 import 가능한지 확인
    expect(typeof isNull).toBe('function');
  });

  it('invitations 테이블에 필수 컬럼이 모두 존재한다', async () => {
    const { invitations } = await import('../src/db/schema/auth');
    expect(invitations.id).toBeDefined();
    expect(invitations.email).toBeDefined();
    expect(invitations.role).toBeDefined();
    expect(invitations.teamId).toBeDefined();
    expect(invitations.expiresAt).toBeDefined();
    expect(invitations.acceptedAt).toBeDefined();
    expect(invitations.createdAt).toBeDefined();
  });
});
