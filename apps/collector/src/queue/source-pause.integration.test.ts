import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { sourcePauseState } from '../db/schema';
import { pauseSource, resumeSource, isSourcePaused, listSourceStates } from './source-pause';

const SOURCE = 'naver-news';

async function clearAll() {
  await getDb().delete(sourcePauseState);
}

describe('source-pause', () => {
  beforeEach(clearAll);
  afterEach(clearAll);

  it('pauseSource는 row를 insert하고 isSourcePaused=true를 반환', async () => {
    await pauseSource(SOURCE, 'selector 점검', 'alice');
    expect(await isSourcePaused(SOURCE)).toBe(true);
  });

  it('resumeSource는 resumedAt을 설정하고 isSourcePaused=false', async () => {
    await pauseSource(SOURCE, null, 'alice');
    await resumeSource(SOURCE);
    expect(await isSourcePaused(SOURCE)).toBe(false);
    const [row] = await getDb()
      .select()
      .from(sourcePauseState)
      .where(eq(sourcePauseState.source, SOURCE));
    expect(row.resumedAt).not.toBeNull();
  });

  it('재-pause 시 동일 row를 갱신 (resumedAt=null, pausedAt 갱신)', async () => {
    await pauseSource(SOURCE, 'r1', 'alice');
    await resumeSource(SOURCE);
    await pauseSource(SOURCE, 'r2', 'bob');
    const [row] = await getDb()
      .select()
      .from(sourcePauseState)
      .where(eq(sourcePauseState.source, SOURCE));
    expect(row.reason).toBe('r2');
    expect(row.pausedBy).toBe('bob');
    expect(row.resumedAt).toBeNull();
  });

  it('listSourceStates는 모든 row 반환', async () => {
    await pauseSource('naver-news', null, 'alice');
    await pauseSource('youtube', null, 'alice');
    const states = await listSourceStates();
    expect(states.map((s) => s.source).sort()).toEqual(['naver-news', 'youtube']);
  });
});
