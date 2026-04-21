import { describe, it, expect } from 'vitest';
import { buildItemAnalysisQueries } from '../item-analyzer';

describe('buildItemAnalysisQueries — 증분 쿼리', () => {
  it('articles 쿼리가 sentiment IS NULL 조건을 포함한다', () => {
    const { articleQuery } = buildItemAnalysisQueries(42);
    const sql = articleQuery.toSQL().sql.toLowerCase();
    // sentiment IS NULL이 WHERE 절에 있어야 함 (대소문자 불문)
    expect(sql).toMatch(/"articles"\.\s*"sentiment"\s+is\s+null|articles.*sentiment.*is null/);
  });

  it('comments 쿼리가 sentiment IS NULL 조건을 포함한다', () => {
    const { commentQuery } = buildItemAnalysisQueries(42);
    const sql = commentQuery.toSQL().sql.toLowerCase();
    expect(sql).toMatch(/"comments"\.\s*"sentiment"\s+is\s+null|comments.*sentiment.*is null/);
  });

  it('jobId 필터가 articleJobs/commentJobs 조인에 포함된다', () => {
    const { articleQuery, commentQuery } = buildItemAnalysisQueries(42);
    expect(articleQuery.toSQL().sql).toMatch(/article_jobs/i);
    expect(commentQuery.toSQL().sql).toMatch(/comment_jobs/i);
  });
});
