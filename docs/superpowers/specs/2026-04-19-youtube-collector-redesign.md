# YouTube 수집기 재설계 — 완전한 스크래핑 + 다른 소스와 일관성 확보

**날짜**: 2026-04-19
**브랜치**: feat/youtube
**상태**: 설계 승인 대기

---

## 1. 배경 및 목표

### 현재 상태

YouTube 수집기는 Data API v3 기반으로 기본 동작하지만, 다른 소스(네이버뉴스, 커뮤니티)와 비교해 여러 갭이 존재한다:

| 갭 | 설명 |
|----|------|
| 댓글 분리 구조 | 다른 소스는 본문+댓글 일체형, YouTube만 별도 수집기 |
| 대댓글 잘림 | `commentThreads.list`는 대댓글 5개까지만 반환, 추가 호출 없음 |
| CollectionStats 미구현 | 종료 사유, 일자별 분포 등 통계 없음 |
| 쿼터 관리 없음 | 10,000유닛 초과 시 무조건 실패 |
| 자막 미수집 | 영상 내용 텍스트 분석 불가 |
| 댓글 정렬 고정 | `relevance`만 지원, 시간순 불가 |

### 목표

1. 다른 소스와 동일한 일체형 수집 패턴 (영상 + 댓글 + 자막)
2. 대댓글 완전 수집 + 댓글 정렬 옵션
3. CollectionStats 완전 구현 (endReason, perDayCount 등)
4. API 쿼터 추적 + youtubei.js 자동 fallback
5. 기존 파이프라인(normalize → persist) 호환성 유지

---

## 2. 아키텍처 결정

### 2.1 수집 엔진: Data API v3 주력 + youtubei.js fallback

```
YoutubeCollector
├── [주력] YouTube Data API v3 (googleapis)
│   ├── search.list (100유닛/요청) — 영상 검색
│   ├── videos.list (1유닛/50건) — 상세 정보
│   ├── commentThreads.list (1유닛/요청) — 댓글
│   └── comments.list (1유닛/요청) — 대댓글 보강
│
└── [fallback] youtubei.js (InnerTube API)
    ├── innertube.search() — 쿼터 소진 시 검색 대체
    ├── innertube.getComments() — 쿼터 소진 시 댓글 대체
    └── 자동 전환 조건: QuotaTracker.isExhausted() === true
```

**전환 로직**: API 호출마다 소모 유닛을 누적 추적하고, 잔여 쿼터가 임계치(기본 500유닛) 이하이면 경고 로그 출력 후 youtubei.js로 자동 전환. 세션 내에서 한 번 전환되면 해당 수집 세션 동안 유지.

### 2.2 댓글 통합: 하이브리드 일체형

- **기본**: 영상 수집 시 댓글도 함께 수집 (다른 소스와 동일)
- **재수집**: `refetchCommentsFor` URL 목록이 있으면 CommentsCollector를 별도 호출
- `YoutubeVideo` 타입에 `comments: YoutubeComment[]` 필드 추가
- `YoutubeVideo` 타입에 `transcript: string | null` 필드 추가

### 2.3 댓글 수집 품질

- 대댓글 완전 수집: `totalReplyCount > 5`일 때 `comments.list` 추가 호출
- 댓글 정렬: `relevance`(기본) / `time` 선택 가능 (CollectionOptions 확장)
- 자막(transcript): `youtube-transcript` 패키지로 수집

### 2.4 운영 안정성

- CollectionStats 완전 구현 (다른 수집기와 동일)
- QuotaTracker: API 호출별 유닛 추적 + 임계치 경고 + 자동 전환

---

## 3. 데이터 모델 변경

### 3.1 YoutubeVideo 타입 확장

```typescript
// packages/collectors/src/adapters/youtube-videos.ts
export interface YoutubeVideo {
  // 기존 필드 (변경 없음)
  sourceId: string;
  url: string;
  title: string;
  description: string | null;
  channelId: string;
  channelTitle: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: Date | null;
  rawData: Record<string, unknown>;

  // 신규 필드
  comments: YoutubeComment[];       // 일체형 댓글
  transcript: string | null;         // 자막 텍스트 (없으면 null)
}
```

### 3.2 CollectionOptions 확장

```typescript
// packages/collectors/src/adapters/base.ts
export interface CollectionOptions {
  // 기존 필드 (변경 없음)
  keyword: string;
  startDate: string | Date;
  endDate: string | Date;
  maxItems?: number;
  maxComments?: number;
  maxItemsPerDay?: number;
  reusePlan?: {
    skipUrls: string[];
    refetchCommentsFor: string[];
  };

  // 신규 필드
  commentOrder?: 'relevance' | 'time';   // 댓글 정렬 (기본: 'relevance')
  collectTranscript?: boolean;            // 자막 수집 여부 (기본: true)
}
```

### 3.3 DB 스키마 변경

```typescript
// packages/core/src/db/schema/collections.ts — videos 테이블에 추가
transcript: text('transcript'),                    // 자막 텍스트
transcriptLang: text('transcript_lang'),           // 자막 언어 ('ko', 'en', 'auto')
```

---

## 4. 컴포넌트 설계

### 4.1 QuotaTracker — API 쿼터 추적기

```
파일: packages/collectors/src/utils/youtube-quota.ts
```

| 메서드 | 설명 |
|--------|------|
| `track(operation, cost)` | API 호출 후 유닛 소모 기록 |
| `getUsed()` | 현재 세션 누적 사용량 |
| `getRemaining()` | 추정 잔여 쿼터 (일일 한도 - 사용량) |
| `isExhausted(threshold?)` | 잔여가 threshold(기본 500) 이하인지 |
| `reset()` | 일일 리셋 (PT 자정 기준) |

```typescript
const QUOTA_COSTS = {
  'search.list': 100,
  'videos.list': 1,
  'commentThreads.list': 1,
  'comments.list': 1,
} as const;

const DAILY_QUOTA = 10_000;
const EXHAUSTION_THRESHOLD = 500;

export class QuotaTracker {
  private used = 0;

  track(operation: keyof typeof QUOTA_COSTS, count = 1): void {
    this.used += QUOTA_COSTS[operation] * count;
  }

  isExhausted(threshold = EXHAUSTION_THRESHOLD): boolean {
    return this.getRemaining() <= threshold;
  }

  getRemaining(): number {
    return Math.max(0, DAILY_QUOTA - this.used);
  }

  getUsed(): number {
    return this.used;
  }
}
```

### 4.2 InnerTube Fallback Client

```
파일: packages/collectors/src/utils/youtube-innertube.ts
```

youtubei.js 래퍼. API 쿼터 소진 시 자동 전환 대상.

```typescript
import { Innertube } from 'youtubei.js';

let innertubeClient: Innertube | null = null;

export async function getInnertubeClient(): Promise<Innertube> {
  if (!innertubeClient) {
    innertubeClient = await Innertube.create({
      lang: 'ko',
      location: 'KR',
    });
  }
  return innertubeClient;
}
```

### 4.3 YoutubeCollector — 통합 수집기 (재설계 핵심)

```
파일: packages/collectors/src/adapters/youtube-collector.ts (신규)
```

기존 `YoutubeVideosCollector` + `YoutubeCommentsCollector`를 통합한 일체형 수집기.

```typescript
export class YoutubeCollector implements Collector<YoutubeVideo> {
  readonly source = 'youtube';

  private quotaTracker = new QuotaTracker();
  private stats: CollectionStats | null = null;
  private usingFallback = false;

  async *collect(options: CollectionOptions): AsyncGenerator<YoutubeVideo[], void, unknown> {
    const maxItems = options.maxItems ?? 50;
    const days = splitIntoDaysKst(options.startDate, options.endDate);
    const perDayLimit = options.maxItemsPerDay ?? Math.max(1, Math.floor(maxItems / days.length));
    const skipUrlSet = new Set(options.reusePlan?.skipUrls ?? []);
    const refetchSet = new Set(options.reusePlan?.refetchCommentsFor ?? []);
    const commentOrder = options.commentOrder ?? 'relevance';
    const collectTranscript = options.collectTranscript ?? true;

    // 통계 초기화
    const perDayCount: Record<string, number> = {};
    let totalCollected = 0;
    let perDayCapSkip = 0;
    let outOfRange = 0;
    let endReason: CollectionStats['endReason'] = 'noMoreResults';
    const globalSeenIds = new Set<string>();

    for (const day of days) {
      const dayStr = kstDayKey(day);
      perDayCount[dayStr] = 0;
      let collectedThisDay = 0;

      // === Phase 1: 영상 검색 ===
      const searchResults = await this.searchVideos(options.keyword, day, perDayLimit, skipUrlSet, globalSeenIds);

      for (const video of searchResults) {
        // KST 일자 검증
        if (!isInKstDay(video.publishedAt, day)) {
          outOfRange++;
          continue;
        }

        // perDay cap 검사
        if (collectedThisDay >= perDayLimit) {
          perDayCapSkip++;
          continue;
        }

        // === Phase 2: 댓글 수집 (일체형) ===
        video.comments = await this.collectComments(
          video.sourceId,
          options.maxComments ?? 500,
          commentOrder,
        );

        // === Phase 3: 자막 수집 ===
        if (collectTranscript) {
          video.transcript = await this.collectTranscript(video.sourceId);
        }

        collectedThisDay++;
        totalCollected++;
        perDayCount[dayStr] = collectedThisDay;

        yield [video];

        if (totalCollected >= maxItems) {
          endReason = 'maxItemsReached';
          break;
        }
      }

      if (endReason === 'maxItemsReached') break;
    }

    // === refetchCommentsFor 처리 ===
    // 본문은 이미 DB에 있고, 댓글만 재수집이 필요한 영상
    if (refetchSet.size > 0) {
      yield* this.refetchCommentsOnly(refetchSet, options.maxComments ?? 500, commentOrder);
    }

    this.stats = {
      endReason,
      lastPage: -1,
      perDayCount,
      perDayCapSkip,
      outOfRange,
      quotaUsed: this.quotaTracker.getUsed(),
      quotaRemaining: this.quotaTracker.getRemaining(),
      usedFallback: this.usingFallback,
    };
  }

  getLastRunStats(): CollectionStats | null {
    return this.stats;
  }

  // --- 내부 메서드 ---

  private async searchVideos(...): Promise<YoutubeVideo[]> {
    if (this.shouldUseFallback()) {
      return this.searchViaInnertube(...);
    }
    return this.searchViaApi(...);
  }

  private async collectComments(
    videoId: string,
    maxComments: number,
    order: 'relevance' | 'time',
  ): Promise<YoutubeComment[]> {
    if (this.shouldUseFallback()) {
      return this.collectCommentsViaInnertube(videoId, maxComments);
    }
    return this.collectCommentsViaApi(videoId, maxComments, order);
  }

  private async collectTranscript(videoId: string): Promise<string | null> {
    // youtube-transcript 패키지 사용
    // 실패 시 null 반환 (자막 없는 영상)
  }

  private shouldUseFallback(): boolean {
    if (this.usingFallback) return true;
    if (this.quotaTracker.isExhausted()) {
      this.usingFallback = true;
      console.warn(`[youtube] API 쿼터 임계치 도달 (${this.quotaTracker.getUsed()}유닛 사용) — youtubei.js로 전환`);
      return true;
    }
    return false;
  }
}
```

### 4.4 API 기반 댓글 수집 (대댓글 완전 수집)

```typescript
private async collectCommentsViaApi(
  videoId: string,
  maxComments: number,
  order: 'relevance' | 'time',
): Promise<YoutubeComment[]> {
  const youtube = getYoutubeClient()!;
  const comments: YoutubeComment[] = [];
  let nextPageToken: string | undefined;

  while (comments.length < maxComments) {
    try {
      const response = await youtube.commentThreads.list({
        part: ['snippet', 'replies'],
        videoId,
        maxResults: Math.min(maxComments - comments.length, 100),
        order,
        pageToken: nextPageToken,
      });
      this.quotaTracker.track('commentThreads.list');

      const items = response.data.items;
      if (!items || items.length === 0) break;

      for (const thread of items) {
        // 최상위 댓글
        const top = thread.snippet?.topLevelComment;
        if (top?.snippet) {
          comments.push(this.mapComment(top, null, videoId));
        }

        // 대댓글 처리
        const totalReplies = thread.snippet?.totalReplyCount ?? 0;
        const inlineReplies = thread.replies?.comments ?? [];

        if (totalReplies > 5) {
          // ⚠️ 대댓글 5개 초과 — comments.list로 전량 수집
          const allReplies = await this.fetchAllReplies(top?.id ?? '', videoId, totalReplies);
          comments.push(...allReplies);
        } else {
          // 인라인 대댓글 사용 (5개 이하)
          for (const reply of inlineReplies) {
            if (!reply.snippet) continue;
            comments.push(this.mapComment(reply, top?.id ?? null, videoId));
          }
        }
      }

      nextPageToken = response.data.nextPageToken ?? undefined;
      if (!nextPageToken) break;
    } catch (err: unknown) {
      const error = err as { code?: number };
      if (error.code === 403) break; // 댓글 비활성화
      throw err;
    }
  }

  return comments.slice(0, maxComments);
}

private async fetchAllReplies(
  parentId: string,
  videoId: string,
  expectedCount: number,
): Promise<YoutubeComment[]> {
  const youtube = getYoutubeClient()!;
  const replies: YoutubeComment[] = [];
  let nextPageToken: string | undefined;

  while (replies.length < expectedCount) {
    const response = await youtube.comments.list({
      part: ['snippet'],
      parentId,
      maxResults: 100,
      pageToken: nextPageToken,
    });
    this.quotaTracker.track('comments.list');

    const items = response.data.items;
    if (!items || items.length === 0) break;

    for (const reply of items) {
      if (!reply.snippet) continue;
      replies.push(this.mapComment(reply, parentId, videoId));
    }

    nextPageToken = response.data.nextPageToken ?? undefined;
    if (!nextPageToken) break;
  }

  return replies;
}
```

### 4.5 youtubei.js Fallback 구현

```typescript
private async searchViaInnertube(
  keyword: string,
  day: Date,
  limit: number,
  skipUrlSet: Set<string>,
  globalSeenIds: Set<string>,
): Promise<YoutubeVideo[]> {
  const innertube = await getInnertubeClient();
  const results = await innertube.search(keyword, {
    type: 'video',
    upload_date: 'today',  // 일자별 분할은 호출 측에서 처리
    sort_by: 'upload_date',
  });

  const videos: YoutubeVideo[] = [];
  for (const item of results.results ?? []) {
    if (item.type !== 'Video') continue;
    const videoId = item.id;
    if (!videoId || globalSeenIds.has(videoId)) continue;
    if (skipUrlSet.has(`https://www.youtube.com/watch?v=${videoId}`)) continue;
    globalSeenIds.add(videoId);

    // 상세 정보 조회
    const info = await innertube.getInfo(videoId);
    videos.push({
      sourceId: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: info.basic_info.title ?? '',
      description: info.basic_info.short_description ?? null,
      channelId: info.basic_info.channel_id ?? '',
      channelTitle: info.basic_info.author ?? '',
      viewCount: info.basic_info.view_count ?? 0,
      likeCount: 0, // InnerTube에서 like 추출 제한적
      commentCount: 0,
      publishedAt: parseInnertubeDate(item.published?.text),
      rawData: {},
      comments: [],
      transcript: null,
    });

    if (videos.length >= limit) break;
  }

  return videos;
}

private async collectCommentsViaInnertube(
  videoId: string,
  maxComments: number,
): Promise<YoutubeComment[]> {
  const innertube = await getInnertubeClient();
  const comments: YoutubeComment[] = [];

  try {
    const thread = await innertube.getComments(videoId);
    for (const comment of thread.contents ?? []) {
      if (comments.length >= maxComments) break;

      comments.push({
        sourceId: comment.comment_id ?? '',
        parentId: null,
        videoSourceId: videoId,
        content: comment.content?.text ?? '',
        author: comment.author?.name ?? '',
        likeCount: parseInt(comment.vote_count?.text ?? '0', 10) || 0,
        publishedAt: parseInnertubeDate(comment.published?.text),
        rawData: {},
      });

      // 대댓글
      if (comment.reply_count && comment.reply_count > 0) {
        const replies = await comment.getReplies();
        for (const reply of replies?.contents ?? []) {
          if (comments.length >= maxComments) break;
          comments.push({
            sourceId: reply.comment_id ?? '',
            parentId: comment.comment_id ?? null,
            videoSourceId: videoId,
            content: reply.content?.text ?? '',
            author: reply.author?.name ?? '',
            likeCount: parseInt(reply.vote_count?.text ?? '0', 10) || 0,
            publishedAt: parseInnertubeDate(reply.published?.text),
            rawData: {},
          });
        }
      }
    }

    // continuation으로 추가 페이지 수집
    let continuation = thread;
    while (comments.length < maxComments && continuation.has_continuation) {
      continuation = await continuation.getContinuation();
      for (const comment of continuation.contents ?? []) {
        if (comments.length >= maxComments) break;
        comments.push({
          sourceId: comment.comment_id ?? '',
          parentId: null,
          videoSourceId: videoId,
          content: comment.content?.text ?? '',
          author: comment.author?.name ?? '',
          likeCount: parseInt(comment.vote_count?.text ?? '0', 10) || 0,
          publishedAt: parseInnertubeDate(comment.published?.text),
          rawData: {},
        });
      }
    }
  } catch {
    // 댓글 비활성화 등 — 빈 배열 반환
  }

  return comments.slice(0, maxComments);
}
```

### 4.6 자막 수집기

```typescript
// packages/collectors/src/utils/youtube-transcript.ts
import { YoutubeTranscript } from 'youtube-transcript';

export async function fetchTranscript(videoId: string): Promise<{
  text: string;
  lang: string;
} | null> {
  try {
    // 한국어 자막 우선 시도
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' });
    if (segments.length > 0) {
      return {
        text: segments.map((s) => s.text).join(' '),
        lang: 'ko',
      };
    }
  } catch {
    // 한국어 자막 없음 — 기본 언어 시도
  }

  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (segments.length > 0) {
      return {
        text: segments.map((s) => s.text).join(' '),
        lang: 'auto',
      };
    }
  } catch {
    // 자막 없음
  }

  return null;
}
```

---

## 5. CollectionStats 확장

```typescript
// 기존 CollectionStats에 YouTube 전용 필드 추가
export interface CollectionStats {
  // 기존 공통 필드
  endReason: 'maxItemsReached' | 'consecutiveOldThreshold' | 'noMoreResults'
    | 'quotaExhausted' | 'pageEmptyOrBlocked';
  lastPage: number;
  perDayCount: Record<string, number>;
  perDayCapSkip?: number;
  outOfRange?: number;

  // YouTube 전용 (optional)
  quotaUsed?: number;           // API 쿼터 사용량
  quotaRemaining?: number;      // 추정 잔여 쿼터
  usedFallback?: boolean;       // youtubei.js fallback 사용 여부
}
```

---

## 6. 파이프라인 변경

### 6.1 flows.ts 변경

기존 `collect-youtube-videos` + `normalize-youtube`(내부 댓글 수집) 2단계를 `collect-youtube` 1단계로 단순화.

**변경 전**:
```
normalize-youtube (pipeline 큐)
  └─ collect-youtube-videos (collectors 큐)
       → 영상만 수집
  normalize 단계에서 영상별 댓글 병렬 수집 (3개씩)
```

**변경 후**:
```
normalize-youtube (pipeline 큐)
  └─ collect-youtube (collectors 큐)
       → 영상 + 댓글 + 자막 일체 수집
  normalize 단계에서는 결과를 그대로 전달 (댓글 재수집 불필요)
```

```typescript
// flows.ts 변경
if (enabledSources.includes('youtube')) {
  children.push({
    name: 'normalize-youtube',
    queueName: 'pipeline',
    data: {
      source: 'youtube',
      flowId, dbJobId,
      startDate: params.startDate,
      endDate: params.endDate,
    },
    children: [
      {
        name: 'collect-youtube',
        queueName: 'collectors',
        data: {
          ...params,
          source: 'youtube',                    // 'youtube-videos' → 'youtube'
          maxItems: effective.youtubeVideos,
          maxItemsPerDay: perDayLimits?.youtubeVideos,
          maxComments: limits.commentsPerItem,   // 영상당 댓글 한도
          commentOrder: 'relevance',             // 기본값
          collectTranscript: true,               // 자막 수집
          flowId, dbJobId, reusePlan,
        },
      },
    ],
  });
}
```

### 6.2 pipeline-worker.ts 변경

`normalize-youtube` 단계에서 별도 댓글 수집 로직을 제거하고, 수집 결과를 그대로 전달.

**변경 전**: normalize 단계에서 영상별 `YoutubeCommentsCollector` 호출 (병렬 3개)
**변경 후**: 수집기가 이미 댓글을 포함하므로 comments를 분리만 수행

```typescript
if (job.name === 'normalize-youtube' && results['youtube']) {
  const videos = results['youtube'].items as YoutubeVideo[];

  // 영상에서 댓글 분리 (persist 단계를 위해)
  const allComments: YoutubeComment[] = [];
  for (const video of videos) {
    allComments.push(...video.comments);
    video.comments = []; // persist 시 중복 방지
  }

  results['youtube-videos'] = {
    source: 'youtube-videos',
    items: videos,
    count: videos.length,
  };

  if (allComments.length > 0) {
    results['youtube-comments'] = {
      source: 'youtube-comments',
      items: allComments,
      count: allComments.length,
    };
  }
}
```

### 6.3 persist 변경

`normalizeYoutubeVideo`에 `transcript`, `transcriptLang` 매핑 추가.

```typescript
export function normalizeYoutubeVideo(video: YoutubeVideo): typeof videos.$inferInsert {
  return {
    // 기존 필드 (변경 없음)
    source: 'youtube',
    sourceId: video.sourceId,
    url: video.url,
    title: video.title,
    description: video.description,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    publishedAt: toDate(video.publishedAt),
    rawData: video.rawData,
    // 신규 필드
    transcript: video.transcript,
    transcriptLang: video.transcript ? 'ko' : null, // 실제 lang은 수집 시 결정
  };
}
```

### 6.4 collector-worker.ts 변경

소스명 `'youtube-videos'` → `'youtube'`로 매핑 추가. stats 로깅에 쿼터 정보 포함.

```typescript
// countBySourceType 함수에 youtube 타입 추가
function countBySourceType(source: string, items: unknown[]): Record<string, number> {
  if (source === 'youtube') {
    const videos = items as YoutubeVideo[];
    const totalComments = videos.reduce((sum, v) => sum + v.comments.length, 0);
    return { videos: videos.length, comments: totalComments };
  }
  // ... 기존 로직
}

// stats 로깅
if (stats) {
  const quotaInfo = stats.quotaUsed != null
    ? ` quota=${stats.quotaUsed}/${stats.quotaUsed + (stats.quotaRemaining ?? 0)}`
    : '';
  const fallbackInfo = stats.usedFallback ? ' [innertube-fallback]' : '';
  appendJobEvent(dbJobId, 'info',
    `[${source}] 종료: reason=${stats.endReason}${quotaInfo}${fallbackInfo} 분포=${JSON.stringify(stats.perDayCount)}`
  );
}
```

### 6.5 워커 등록 변경

```typescript
// worker-config.ts
export function registerAllCollectors(): void {
  // 기존
  registerCollector(new NaverNewsCollector());
  registerCollector(new NaverCommentsCollector());
  registerCollector(new DCInsideCollector());
  registerCollector(new FMKoreaCollector());
  registerCollector(new ClienCollector());

  // YouTube — 통합 수집기로 교체
  registerCollector(new YoutubeCollector());
  // YoutubeCommentsCollector는 유지 (refetchCommentsFor 전용)
  registerCollector(new YoutubeCommentsCollector());
}
```

---

## 7. 새 의존성

| 패키지 | 버전 | 용도 | 크기 |
|--------|------|------|------|
| `youtubei.js` | ^17.x | InnerTube API fallback | ~2.5MB |
| `youtube-transcript` | ^1.3.x | 자막 추출 | ~50KB |

설치: `pnpm add youtubei.js youtube-transcript -F @ai-signalcraft/collectors`

---

## 8. 파일 변경 목록

### 신규 파일
| 파일 | 설명 |
|------|------|
| `packages/collectors/src/adapters/youtube-collector.ts` | 통합 수집기 (핵심) |
| `packages/collectors/src/utils/youtube-quota.ts` | QuotaTracker |
| `packages/collectors/src/utils/youtube-innertube.ts` | youtubei.js 래퍼 |
| `packages/collectors/src/utils/youtube-transcript.ts` | 자막 수집 유틸 |

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `packages/collectors/src/adapters/youtube-videos.ts` | `YoutubeVideo` 타입에 `comments`, `transcript` 필드 추가 |
| `packages/collectors/src/adapters/youtube-comments.ts` | 대댓글 완전 수집 로직 추가 (refetchCommentsFor 전용) |
| `packages/collectors/src/adapters/base.ts` | `CollectionOptions`에 `commentOrder`, `collectTranscript` 추가; `CollectionStats`에 쿼터 필드 추가 |
| `packages/core/src/queue/flows.ts` | YouTube flow 소스명 변경 + 옵션 전달 |
| `packages/core/src/queue/pipeline-worker.ts` | normalize-youtube 댓글 수집 로직 제거, 댓글 분리 로직으로 대체 |
| `packages/core/src/queue/collector-worker.ts` | youtube 소스 카운트 + stats 쿼터 로깅 |
| `packages/core/src/queue/worker-config.ts` | YoutubeCollector 등록 |
| `packages/core/src/db/schema/collections.ts` | videos 테이블에 transcript, transcriptLang 컬럼 추가 |
| `packages/core/src/pipeline/normalize.ts` | normalizeYoutubeVideo에 transcript 매핑 |
| `packages/core/src/pipeline/persist.ts` | transcript upsert 처리 |

### 삭제 없음
- `YoutubeVideosCollector`, `YoutubeCommentsCollector`는 삭제하지 않음
- `YoutubeCommentsCollector`는 `refetchCommentsFor` 전용으로 유지
- `YoutubeVideosCollector`는 deprecated 마킹 후 향후 제거

---

## 9. 쿼터 예산 분석

### 수집 시나리오: 50건 영상 + 영상당 500 댓글

**API 단독 (현행)**:
| 호출 | 유닛/회 | 횟수 | 소계 |
|------|---------|------|------|
| search.list | 100 | 1 | 100 |
| videos.list | 1 | 1 | 1 |
| commentThreads.list | 1 | 50 × 5페이지 | 250 |
| **합계** | | | **351** |

**API + 대댓글 보강 (개선)**:
| 호출 | 유닛/회 | 횟수 (최악) | 소계 |
|------|---------|-------------|------|
| search.list | 100 | 1 | 100 |
| videos.list | 1 | 1 | 1 |
| commentThreads.list | 1 | 250 | 250 |
| comments.list (대댓글) | 1 | ~50 (대댓글 많은 영상) | 50 |
| **합계** | | | **~401** |

일일 10,000유닛으로 약 **25회 수집** 가능. 쿼터 소진 시 youtubei.js fallback 자동 전환.

---

## 10. 에러 처리

| 에러 | 처리 |
|------|------|
| API 키 미설정 (`YOUTUBE_API_KEY` 없음) | 경고 로그 + youtubei.js로 즉시 전환 |
| 403 (댓글 비활성화) | 해당 영상 댓글 건너뛰기, 영상 메타데이터는 유지 |
| 403 (쿼터 초과) | QuotaTracker가 감지 → youtubei.js 전환 |
| 자막 없음 | `transcript: null`로 설정, 에러 아님 |
| youtubei.js 실패 | 경고 로그 + 해당 영상 건너뛰기 (부분 실패 허용) |
| 네트워크 타임아웃 | 3회 재시도 후 건너뛰기 |

---

## 11. 테스트 계획

| 테스트 | 검증 사항 |
|--------|-----------|
| 일자별 분할 수집 | 10일 기간, perDay 모드 → 각 일자 cap 미초과 확인 |
| 대댓글 완전 수집 | totalReplyCount > 5인 스레드 → comments.list로 전량 수집 |
| 쿼터 추적 | 100회 search.list 후 isExhausted() === true |
| youtubei.js fallback | 쿼터 소진 후 자동 전환 → 수집 계속 |
| 자막 수집 | 한국어 자막 우선 → 없으면 기본 언어 → 없으면 null |
| 댓글 비활성화 영상 | 403 → graceful skip, 영상 데이터는 유지 |
| CollectionStats | endReason, perDayCount, quotaUsed 정확성 |
| reusePlan | skipUrls → 스킵, refetchCommentsFor → 댓글만 재수집 |
| 정규화 → persist | transcript 컬럼 upsert 확인 |

---

## 12. 마이그레이션 전략

1. **DB 마이그레이션**: videos 테이블에 `transcript`, `transcript_lang` 컬럼 추가 (`pnpm db:push`)
2. **의존성 설치**: `pnpm add youtubei.js youtube-transcript -F @ai-signalcraft/collectors`
3. **수집기 교체**: `YoutubeCollector` 등록, 기존 `YoutubeVideosCollector` deprecated
4. **flows.ts 업데이트**: 소스명 `'youtube-videos'` → `'youtube'` 전환
5. **pipeline-worker.ts 업데이트**: normalize 단계 댓글 수집 로직 제거
6. **기존 데이터 호환**: videos 테이블의 기존 행은 `transcript = null`로 유지 (자연스러운 NULL)
