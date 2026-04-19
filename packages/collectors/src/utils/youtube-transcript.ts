const INNERTUBE_PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const ANDROID_CLIENT_VERSION = '20.10.38';
const ANDROID_USER_AGENT = `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 14)`;

const SEGMENT_REGEX = /<p [^>]*>([^<]*(?:<[^/][^>]*>[^<]*<\/[^>]*>)*[^<]*)<\/p>/g;

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

    if (!resp.ok) return null;

    const data = await resp.json();
    const tracks: Array<{ languageCode: string; baseUrl: string }> =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!tracks?.length) return null;

    const koTrack = tracks.find((t) => t.languageCode === 'ko');
    const selected = koTrack ?? tracks[0];

    const xmlResp = await fetch(selected.baseUrl);
    if (!xmlResp.ok) return null;

    const xml = await xmlResp.text();
    const texts: string[] = [];

    for (const match of xml.matchAll(SEGMENT_REGEX)) {
      const raw = match[1].replace(/<[^>]*>/g, '').trim();
      if (raw) texts.push(decodeEntities(raw));
    }

    if (texts.length === 0) return null;

    return {
      text: texts.join(' '),
      lang: selected.languageCode === 'ko' ? 'ko' : selected.languageCode,
    };
  } catch {
    return null;
  }
}
