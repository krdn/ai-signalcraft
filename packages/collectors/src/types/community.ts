// 커뮤니티(DC갤러리, 에펨코리아, 클리앙) 수집 공통 타입

/** 커뮤니티 게시글 */
export interface CommunityPost {
  sourceId: string; // 게시글 고유 ID (예: 'dc_123456')
  url: string; // 게시글 URL
  title: string; // 제목
  content: string; // 본문 텍스트
  author: string; // 작성자 닉네임
  boardName: string; // 갤러리/게시판 이름
  publishedAt: Date; // 작성일시
  viewCount: number; // 조회수
  commentCount: number; // 댓글 수
  likeCount: number; // 추천 수
  rawData: Record<string, unknown>; // 원본 데이터
  comments: CommunityComment[]; // 수집된 댓글
}

/** 커뮤니티 댓글 */
export interface CommunityComment {
  sourceId: string; // 댓글 고유 ID
  parentId: string | null; // 대댓글인 경우 부모 댓글 ID
  content: string; // 댓글 내용
  author: string; // 작성자
  likeCount: number; // 추천
  dislikeCount: number; // 비추천
  publishedAt: Date; // 작성일시
  rawData: Record<string, unknown>;
}
