#!/usr/bin/env python3
"""
faster-whisper로 오디오 파일을 전사해 JSON 결과를 stdout으로 출력한다.

Node 프로세스(index.ts)가 subprocess로 호출한다.

사용:
  python3 transcribe.py <audio_path> [--model=small] [--language=ko]

출력 (stdout, JSON):
  {"text": "...", "lang": "ko", "duration": 123.4, "elapsed": 45.6}

모델은 첫 호출 시 HuggingFace에서 다운로드하고, 이후 호출은 캐시 사용.
"""
import argparse
import json
import sys
import time


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('audio', help='오디오 파일 경로')
    parser.add_argument('--model', default='small', help='Whisper 모델 크기 (tiny/base/small/medium)')
    parser.add_argument('--language', default='ko', help='언어 코드 (ko/en/...)')
    parser.add_argument('--threads', type=int, default=8, help='CPU 스레드 수')
    parser.add_argument('--beam-size', type=int, default=1, help='Beam search 크기')
    args = parser.parse_args()

    # 지연 import로 argparse 에러 시 무거운 라이브러리 로드 회피
    from faster_whisper import WhisperModel

    t0 = time.time()
    model = WhisperModel(
        args.model,
        device='cpu',
        compute_type='int8',
        cpu_threads=args.threads,
    )
    load_elapsed = time.time() - t0

    t0 = time.time()
    segments, info = model.transcribe(
        args.audio,
        language=args.language,
        beam_size=args.beam_size,
        vad_filter=True,
        vad_parameters={'min_silence_duration_ms': 500},
    )

    chunks = []
    for seg in segments:
        text = seg.text.strip()
        if text:
            chunks.append(text)
    text = ' '.join(chunks)
    elapsed = time.time() - t0

    result = {
        'text': text,
        'lang': info.language,
        'language_probability': round(info.language_probability, 3),
        'duration': round(info.duration, 1),
        'elapsed': round(elapsed, 1),
        'load_elapsed': round(load_elapsed, 1),
        'chars': len(text),
        'model': args.model,
    }
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as e:
        # stderr에 에러 상세, stdout은 빈 JSON으로 — Node 측에서 parse 실패 시 에러로 처리
        print(f'transcribe.py error: {type(e).__name__}: {e}', file=sys.stderr)
        print(json.dumps({'error': str(e), 'text': '', 'lang': None}))
        sys.exit(1)
