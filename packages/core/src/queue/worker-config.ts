// Worker 프로세스 공통 설정 -- env 로드, API 키 검증, 수집기 등록
import { resolve } from 'path';
import { existsSync } from 'fs';
import { config } from 'dotenv';
import {
  NaverNewsCollector,
  NaverCommentsCollector,
  YoutubeVideosCollector,
  YoutubeCommentsCollector,
  DCInsideCollector,
  FMKoreaCollector,
  ClienCollector,
  registerCollector,
} from '@ai-signalcraft/collectors';
import { startExpirePausedCron } from '../pipeline/expire-paused';
import type { CommunitySource } from '../pipeline/normalize';
// 모노리포 루트 탐색 -- pnpm-workspace.yaml이 있는 디렉토리
export function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return startDir; // 폴백: 시작 디렉토리
}

// dotenv 로드: apps/web/.env.local이 시스템 환경변수보다 우선
export function initEnv(): void {
  const root = findMonorepoRoot(process.cwd());
  config({ path: resolve(root, 'apps/web/.env.local'), override: true });
  config({ path: resolve(root, '.env') });
}

// AI API 키 검증 -- DB provider_keys 기반 설정 시 환경변수 불필요 (no-op)
// proxy CLI(claude-cli, gemini-cli) 등 DB 기반 프로바이더 사용 시 환경변수 검증 스킵
export function validateApiKeys(): void {
  // 모델 설정은 DB provider_keys/model_settings에서 관리됨
  // 환경변수 API 키는 선택적 폴백 — 경고 생략
}

// 수집기 등록
export function registerAllCollectors(): void {
  registerCollector(new NaverNewsCollector());
  registerCollector(new NaverCommentsCollector());
  registerCollector(new YoutubeVideosCollector());
  registerCollector(new YoutubeCommentsCollector());
  registerCollector(new DCInsideCollector());
  registerCollector(new FMKoreaCollector());
  registerCollector(new ClienCollector());
}

// 커뮤니티 소스 목록 (normalize/persist에서 공통 처리)
export const COMMUNITY_SOURCES: CommunitySource[] = ['dcinside', 'fmkorea', 'clien'];

// 소스별 수집 건수 카운트 유틸리티
export function countBySourceType(source: string, items: unknown[]): Record<string, number> {
  const count = items.length;
  if (source === 'naver-news') return { articles: count, comments: 0 };
  if (source === 'youtube-videos') return { videos: count, comments: 0 };
  if (source === 'youtube-comments') return { comments: count };
  // 동적 소스 (RSS/HTML) — 댓글 수집 없음, 기사만 카운트
  if (source === 'rss' || source === 'html') return { articles: count, comments: 0 };
  // 커뮤니티 소스: 게시글 수 + 내장 댓글 수
  const posts = count;
  const commentCount = items.reduce<number>(
    (sum, item: any) => sum + (item?.comments?.length ?? 0),
    0,
  );
  return { posts, comments: commentCount };
}

// progress JSONB 키 매핑 (소스명 -> progress 키)
// dataSourceId가 제공되면 동적 소스의 고유 키(ds_<short>)로 반환 — 여러 RSS/HTML 소스가
// 같은 trigger 안에서 독립적으로 progress 추적 가능.
export function progressKey(source: string, dataSourceId?: string): string {
  if (dataSourceId) return `ds_${dataSourceId.slice(0, 8)}`;
  if (source === 'naver-news') return 'naver';
  if (source === 'youtube-videos' || source === 'youtube-comments') return 'youtube';
  return source; // dcinside, fmkorea, clien
}

/**
 * 워커 프로세스 보호 — uncaughtException/unhandledRejection 핸들러,
 * graceful SIGTERM, expire-paused cron 부트스트랩
 */
export function setupWorkerProcess() {
  process.on('uncaughtException', (err) => {
    console.error('[worker] FATAL uncaughtException:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (err) => {
    console.error('[worker] FATAL unhandledRejection:', err);
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    console.log('[worker] SIGTERM 수신 — graceful shutdown');
    setTimeout(() => process.exit(0), 5000);
  });

  startExpirePausedCron();
}
