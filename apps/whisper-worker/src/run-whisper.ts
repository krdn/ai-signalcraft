import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 배포 컨테이너에서는 dist/run-whisper.js → apps/whisper-worker/src/transcribe.py
// dev에서는 src/run-whisper.ts → src/transcribe.py 로 모두 같은 디렉토리에 위치시킨다.
const TRANSCRIBE_SCRIPT = resolve(__dirname, 'transcribe.py');

export interface TranscribeResult {
  text: string;
  lang: string | null;
  languageProbability: number;
  duration: number;
  elapsed: number;
  chars: number;
  model: string;
}

/**
 * transcribe.py를 subprocess로 실행해 오디오를 전사한다.
 *
 * Python 프로세스는 호출마다 새로 시작한다. 모델 로드(약 8초)가 매번 발생하지만
 * BullMQ 큐 처리 간격이 수십 초 이상이므로 상주 대비 복잡도를 감당할 만큼 성능
 * 이득이 크지 않다. 필요 시 zmq/socket으로 상주 프로세스 전환 가능.
 */
export async function runWhisper(
  audioPath: string,
  opts: { model?: string; language?: string; threads?: number } = {},
): Promise<TranscribeResult> {
  const args = [
    TRANSCRIBE_SCRIPT,
    audioPath,
    `--model=${opts.model ?? 'small'}`,
    `--language=${opts.language ?? 'ko'}`,
    `--threads=${opts.threads ?? 8}`,
  ];

  return new Promise<TranscribeResult>((resolve, reject) => {
    const proc = spawn('python3', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`transcribe.py exit ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      try {
        const data = JSON.parse(stdout.trim()) as {
          text?: string;
          lang?: string | null;
          language_probability?: number;
          duration?: number;
          elapsed?: number;
          chars?: number;
          model?: string;
          error?: string;
        };
        if (data.error) {
          reject(new Error(`transcribe.py error: ${data.error}`));
          return;
        }
        resolve({
          text: data.text ?? '',
          lang: data.lang ?? null,
          languageProbability: data.language_probability ?? 0,
          duration: data.duration ?? 0,
          elapsed: data.elapsed ?? 0,
          chars: data.chars ?? 0,
          model: data.model ?? 'unknown',
        });
      } catch (err) {
        reject(
          new Error(
            `transcribe.py JSON parse failed: ${err instanceof Error ? err.message : err}. stdout: ${stdout.slice(0, 300)}`,
          ),
        );
      }
    });
  });
}
