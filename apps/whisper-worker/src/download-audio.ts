import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * 세그먼트 지정 — yt-dlp `--download-sections` 문법 "*start-end" (초).
 * undefined면 전체 영상 다운로드.
 */
export interface AudioSegment {
  /** 파일명에 붙을 라벨(head, tail 등) */
  label: string;
  /** 시작 초 */
  startSec: number;
  /** 종료 초 */
  endSec: number;
}

export interface DownloadedSegment {
  label: string;
  path: string;
  sizeBytes: number;
  durationSec: number; // 요청한 길이 (endSec - startSec)
}

/**
 * yt-dlp로 YouTube 영상의 오디오를 (선택적으로 세그먼트만) 다운로드.
 *
 * 전략 분기:
 * - segments가 비어있거나 undefined → 전체 영상 다운로드 (기존 동작)
 * - segments가 1개 이상 → 각 세그먼트별로 별도 파일 다운로드
 *
 * 왜 세그먼트를 개별 파일로 받는가:
 *   `--download-sections '*0-300,*3764-3884'`로 한 번에 두 구간을 지정하면
 *   ffmpeg가 하나의 concatenated 파일을 만드는데, seam에서 말이 잘려
 *   Whisper 텍스트가 어색해진다. 세그먼트별 독립 파일 → 독립 Whisper 호출 후
 *   텍스트 join이 fidelity가 높고 디버깅이 쉬움.
 *
 * ffmpeg가 yt-dlp 컨테이너에 설치되어 있어야 함 (Dockerfile의 apt-get 의존).
 */
export async function downloadAudio(
  videoId: string,
  workDir: string,
  segments?: AudioSegment[],
): Promise<DownloadedSegment[]> {
  await mkdir(workDir, { recursive: true });
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // 세그먼트 지정 없으면 전체 영상 1파일
  if (!segments || segments.length === 0) {
    const outPath = join(workDir, `${videoId}.m4a`);
    await runYtDlp(url, outPath);
    const s = await stat(outPath);
    if (s.size === 0) throw new Error(`downloaded audio is empty: ${outPath}`);
    return [
      {
        label: 'full',
        path: outPath,
        sizeBytes: s.size,
        durationSec: 0, // 전체 — 실제 길이는 whisper가 info.duration으로 반환
      },
    ];
  }

  // 세그먼트별 개별 다운로드
  const results: DownloadedSegment[] = [];
  for (const seg of segments) {
    const outPath = join(workDir, `${videoId}.${seg.label}.m4a`);
    const section = `*${seg.startSec}-${seg.endSec}`;
    await runYtDlp(url, outPath, section);
    const s = await stat(outPath);
    if (s.size === 0) {
      throw new Error(`downloaded segment is empty: ${outPath} (${seg.label})`);
    }
    results.push({
      label: seg.label,
      path: outPath,
      sizeBytes: s.size,
      durationSec: seg.endSec - seg.startSec,
    });
  }
  return results;
}

async function runYtDlp(url: string, outPath: string, section?: string): Promise<void> {
  const args = [
    '-f',
    'bestaudio[ext=m4a]/bestaudio',
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '-o',
    outPath,
  ];
  if (section) {
    args.push('--download-sections', section, '--force-keyframes-at-cuts');
  }
  args.push(url);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exit ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}
