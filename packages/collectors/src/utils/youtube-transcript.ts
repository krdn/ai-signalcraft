import { YoutubeTranscript } from 'youtube-transcript';

export async function fetchTranscript(
  videoId: string,
): Promise<{ text: string; lang: string } | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' });
    if (segments.length > 0) {
      return {
        text: segments.map((s) => s.text).join(' '),
        lang: 'ko',
      };
    }
  } catch {
    // 한국어 자막 없음
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
