import { getInnertubeClient } from './youtube-innertube';

export async function fetchTranscript(
  videoId: string,
): Promise<{ text: string; lang: string } | null> {
  try {
    const innertube = await getInnertubeClient();
    const info = await innertube.getInfo(videoId);
    const transcriptInfo = await info.getTranscript();

    const body = (transcriptInfo as any)?.content?.body;
    if (!body) return null;

    const segments: string[] = [];
    const items = body?.initial_segments ?? body?.segments ?? (body as any)?.content?.items ?? [];

    for (const seg of items) {
      const text = (seg as any)?.snippet?.text ?? (seg as any)?.segment_title?.text ?? '';
      if (text) segments.push(text);
    }

    if (segments.length === 0) return null;

    const lang =
      (transcriptInfo as any)?.content?.header?.language_menu?.sub_menu_items?.find(
        (i: any) => i.selected,
      )?.title ?? 'auto';

    return {
      text: segments.join(' '),
      lang: lang.includes('한국') ? 'ko' : lang.includes('English') ? 'en' : 'auto',
    };
  } catch {
    return null;
  }
}
