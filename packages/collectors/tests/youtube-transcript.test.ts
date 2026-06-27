import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTranscript } from '../src/utils/youtube-transcript';

// player API 정상 응답(자막 트랙 1개) 헬퍼
function playerOkResponse(baseUrl: string) {
  return {
    ok: true,
    json: async () => ({
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ languageCode: 'ko', baseUrl }],
        },
      },
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTranscript 반환 신호 분류', () => {
  it('정상 자막은 ok:true와 text/lang을 반환', async () => {
    const xml = '<p start="0">안녕하세요</p><p start="1">반갑습니다</p>';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(playerOkResponse('https://timedtext.example/ko'))
        .mockResolvedValueOnce({ ok: true, text: async () => xml }),
    );
    const result = await fetchTranscript('vid1');
    expect(result).toEqual({ ok: true, text: '안녕하세요 반갑습니다', lang: 'ko' });
  });

  it('captions fetch 429는 ok:false, blocked:true', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(playerOkResponse('https://timedtext.example/ko'))
        .mockResolvedValueOnce({ ok: false, status: 429 }),
    );
    const result = await fetchTranscript('vid2');
    expect(result).toEqual({ ok: false, blocked: true });
  });

  it('captions fetch 403도 blocked:true', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(playerOkResponse('https://timedtext.example/ko'))
        .mockResolvedValueOnce({ ok: false, status: 403 }),
    );
    const result = await fetchTranscript('vid3');
    expect(result).toEqual({ ok: false, blocked: true });
  });

  it('자막 없는 영상(no_tracks)은 blocked:false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ captions: undefined }),
      }),
    );
    const result = await fetchTranscript('vid4');
    expect(result).toEqual({ ok: false, blocked: false });
  });

  it('player API 429는 blocked:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 429 }));
    const result = await fetchTranscript('vid5');
    expect(result).toEqual({ ok: false, blocked: true });
  });
});
