const INNERTUBE_PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const ANDROID_CLIENT_VERSION = '20.10.38';
const ANDROID_USER_AGENT = `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 14)`;

const SEGMENT_REGEX = /<p [^>]*>([^<]*(?:<[^/][^>]*>[^<]*<\/[^>]*>)*[^<]*)<\/p>/g;

// YouTube가 2024–2025 사이 자막 엔드포인트(api/timedtext)에 BotGuard/PO token 보호를
// 확대하면서, 쿠키·PO token 없이는 장편 영상 자막이 HTTP 429로 거부된다.
// 현재 파이프라인에선 설명(description) 폴백으로 분석이 돌아가고 있으며(data-loader.ts:95),
// 이 모듈은 관측 로그만 남기고 향후 유료 API/bgutils-js 등으로 교체할 경우 내부만 바꾸면
// 되도록 인터페이스를 유지한다.
type FailReason =
  | 'player_http_error' // InnerTube player API 자체 실패
  | 'no_tracks' // 영상에 자막이 없음 (정상 케이스 포함)
  | 'captions_http_error' // baseUrl fetch 실패 — 대부분 429 (PO token)
  | 'parse_empty'; // XML은 받았지만 <p> 세그먼트 파싱 실패

function logFailure(videoId: string, reason: FailReason, detail?: string): void {
  // 운영 환경에서 구조화된 grep이 가능하도록 고정 prefix 사용.
  // 향후 재활성화 시도 시 reason별 빈도를 집계해 원인을 판별한다.
  const msg = detail
    ? `[transcript] ${videoId} reason=${reason} ${detail}`
    : `[transcript] ${videoId} reason=${reason}`;
  console.warn(msg);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

export async function fetchTranscript(
  videoId: string,
): Promise<{ text: string; lang: string } | null> {
  try {
    const resp = await fetch(INNERTUBE_PLAYER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ANDROID_USER_AGENT,
      },
      body: JSON.stringify({
        context: {
          client: { clientName: 'ANDROID', clientVersion: ANDROID_CLIENT_VERSION },
        },
        videoId,
      }),
    });

    if (!resp.ok) {
      logFailure(videoId, 'player_http_error', `status=${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const tracks: Array<{ languageCode: string; baseUrl: string }> =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!tracks?.length) {
      // 자막이 원래 없는 영상이 다수이므로 흔한 케이스 — 로그 남기되 집계는 의미 있음
      logFailure(videoId, 'no_tracks');
      return null;
    }

    const koTrack = tracks.find((t) => t.languageCode === 'ko');
    const selected = koTrack ?? tracks[0];

    const xmlResp = await fetch(selected.baseUrl);
    if (!xmlResp.ok) {
      logFailure(
        videoId,
        'captions_http_error',
        `status=${xmlResp.status} lang=${selected.languageCode}`,
      );
      return null;
    }

    const xml = await xmlResp.text();
    const texts: string[] = [];

    for (const match of xml.matchAll(SEGMENT_REGEX)) {
      const raw = match[1].replace(/<[^>]*>/g, '').trim();
      if (raw) texts.push(decodeEntities(raw));
    }

    if (texts.length === 0) {
      logFailure(videoId, 'parse_empty', `xml_bytes=${xml.length} lang=${selected.languageCode}`);
      return null;
    }

    return {
      text: texts.join(' '),
      lang: selected.languageCode === 'ko' ? 'ko' : selected.languageCode,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[transcript] ${videoId} reason=exception ${msg}`);
    return null;
  }
}
