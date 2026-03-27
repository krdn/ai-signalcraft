// X(Twitter) 수집 데이터 타입

export interface Tweet {
  sourceId: string;
  url: string;
  content: string;
  author: string;
  authorHandle: string;
  publishedAt: Date | null;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  rawData: Record<string, unknown>;
  replies: TweetReply[];
}

export interface TweetReply {
  sourceId: string;
  parentId: string;
  content: string;
  author: string;
  authorHandle: string;
  publishedAt: Date | null;
  likeCount: number;
  rawData: Record<string, unknown>;
}
