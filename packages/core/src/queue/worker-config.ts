// Worker 프로세스 공통 설정 -- env 로드, API 키 검증, 수집기 등록
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
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
import type { CommunitySource } from '../pipeline/normalize';
import { createLogger } from '../utils/logger';

const logger = createLogger('worker-config');

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

// AI API 키 검증 -- 분석 파이프라인에 필수
export function validateApiKeys(): void {
  const requiredApiKeys = [
    { name: 'OPENAI_API_KEY', prefix: 'sk-', usage: 'Stage 1 분석 (gpt-4o-mini)' },
    { name: 'ANTHROPIC_API_KEY', prefix: 'sk-ant-', usage: 'Stage 2~3 분석 + 리포트 생성 (Claude)' },
  ];
  for (const key of requiredApiKeys) {
    const value = process.env[key.name];
    if (!value) {
      logger.warn(`${key.name} 미설정 -- ${key.usage} 실패 예상. apps/web/.env.local에 추가하세요.`);
    } else if (key.prefix && !value.startsWith(key.prefix)) {
      logger.warn(`${key.name} 형식 의심 (${key.prefix}로 시작하지 않음) -- ${key.usage} 실패 가능`);
    }
  }
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
  // 커뮤니티 소스: 게시글 수 + 내장 댓글 수
  const posts = count;
  const commentCount = items.reduce<number>((sum, item: any) => sum + (item?.comments?.length ?? 0), 0);
  return { posts, comments: commentCount };
}

// progress JSONB 키 매핑 (소스명 -> progress 키)
export function progressKey(source: string): string {
  if (source === 'naver-news') return 'naver';
  if (source === 'youtube-videos' || source === 'youtube-comments') return 'youtube';
  return source; // dcinside, fmkorea, clien
}
