// 수집기 레지스트리 초기화 -- 모든 수집기를 등록
import { registerCollector } from './adapters/registry';
import { NaverNewsCollector } from './adapters/naver-news';
import { NaverCommentsCollector } from './adapters/naver-comments';
import { YoutubeVideosCollector } from './adapters/youtube-videos';
import { YoutubeCommentsCollector } from './adapters/youtube-comments';
import { DCInsideCollector } from './adapters/dcinside';
import { FMKoreaCollector } from './adapters/fmkorea';
import { ClienCollector } from './adapters/clien';

registerCollector(new NaverNewsCollector());
registerCollector(new NaverCommentsCollector());
registerCollector(new YoutubeVideosCollector());
registerCollector(new YoutubeCommentsCollector());
registerCollector(new DCInsideCollector());
registerCollector(new FMKoreaCollector());
registerCollector(new ClienCollector());
