import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * yt-dlp로 YouTube 영상의 오디오 트랙만 다운로드.
 *
 * bestaudio[ext=m4a] → faster-whisper가 ffmpeg로 디코딩 가능하므로 변환 불필요.
 * PO token 보호가 강한 자막 엔드포인트(api/timedtext)와 달리 오디오 스트림은
 * 현재(2026-04) 쿠키 없이도 다운로드 가능함이 192.168.0.5에서 검증됨.
 */
export async function downloadAudio(
  videoId: string,
  workDir: string,
): Promise<{ path: string; sizeBytes: number }> {
  await mkdir(workDir, { recursive: true });
  const outPath = join(workDir, `${videoId}.m4a`);

  // 존재 시 재다운로드 회피 (재시도 안전)
  try {
    const s = await stat(outPath);
    if (s.size > 0) return { path: outPath, sizeBytes: s.size };
  } catch {
    // 파일 없음 — 정상
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const args = [
    '-f',
    'bestaudio[ext=m4a]/bestaudio',
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '-o',
    outPath,
    url,
  ];

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

  const s = await stat(outPath);
  if (s.size === 0) throw new Error(`downloaded audio is empty: ${outPath}`);
  return { path: outPath, sizeBytes: s.size };
}
