/**
 * Gemini CLI OAuth 토큰 사전 갱신 유틸리티
 *
 * gemini-cli 라이브러리는 access_token 만료 시 refresh_token으로 자동 갱신하지만,
 * 갱신 후 oauth_creds.json 파일 쓰기가 필요합니다.
 *
 * 이 모듈은 워커 시작 시 토큰 상태를 확인하고 만료됐으면 미리 갱신하여
 * 분석 도중 예기치 않은 토큰 만료로 인한 중단을 방지합니다.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { homedir } from 'os';

const OAUTH_CREDS_PATH = `${homedir()}/.gemini/oauth_creds.json`;
// access_token 만료 5분 전부터 사전 갱신 (ms)
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
// 자동 갱신 주기: 45분마다 (access_token 유효기간 1시간 기준)
const AUTO_REFRESH_INTERVAL_MS = 45 * 60 * 1000;

// gemini-cli-core 패키지에 내장된 공개 OAuth 클라이언트 정보
// (gemini-cli 오픈소스에 포함된 값 — 개인 크리덴셜 아님)
// 환경변수 GEMINI_OAUTH_CLIENT_ID / GEMINI_OAUTH_CLIENT_SECRET 으로 오버라이드 가능
const OAUTH_CLIENT_ID =
  process.env.GEMINI_OAUTH_CLIENT_ID ??
  Buffer.from(
    'NjgxMjU1ODA5Mzk1LW9vOGZ0Mm9wcmRybnA5ZTNhcWY2YXYzaG1kaWIxMzVqLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t',
    'base64',
  ).toString();
const OAUTH_CLIENT_SECRET =
  process.env.GEMINI_OAUTH_CLIENT_SECRET ??
  Buffer.from('R09DU1BYLTRAdUhnTVBtLTFvN1NrLWdlVjZDdTVjbFhGc3hs', 'base64').toString();
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

interface OAuthCreds {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

async function loadCreds(): Promise<OAuthCreds | null> {
  try {
    const raw = await readFile(OAUTH_CREDS_PATH, 'utf8');
    return JSON.parse(raw) as OAuthCreds;
  } catch {
    return null;
  }
}

async function saveCreds(creds: OAuthCreds): Promise<void> {
  await mkdir(dirname(OAUTH_CREDS_PATH), { recursive: true });
  await writeFile(OAUTH_CREDS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

async function refreshAccessToken(refreshToken: string): Promise<Partial<OAuthCreds> | null> {
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`토큰 갱신 실패 (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    id_token?: string;
    expires_in?: number;
    token_type?: string;
    error?: string;
  };

  if (data.error) {
    throw new Error(`토큰 갱신 오류: ${data.error}`);
  }

  return {
    access_token: data.access_token,
    id_token: data.id_token,
    expiry_date: Date.now() + (data.expires_in ?? 3600) * 1000,
    token_type: data.token_type,
  };
}

/**
 * 토큰이 만료됐거나 곧 만료될 경우 refresh_token으로 갱신
 * @returns 갱신 여부
 */
export async function ensureGeminiTokenFresh(): Promise<boolean> {
  const creds = await loadCreds();
  if (!creds) {
    console.log('[gemini-token] oauth_creds.json 없음 — gemini-cli 미사용 시 무시');
    return false;
  }

  if (!creds.refresh_token) {
    console.warn('[gemini-token] refresh_token 없음 — 수동 재인증 필요');
    return false;
  }

  const timeToExpiry = creds.expiry_date - Date.now();
  if (timeToExpiry > REFRESH_THRESHOLD_MS) {
    console.log(
      `[gemini-token] access_token 유효 (만료까지 ${Math.round(timeToExpiry / 60000)}분)`,
    );
    return false;
  }

  console.log(
    `[gemini-token] access_token ${timeToExpiry < 0 ? '만료됨' : '곧 만료'} — refresh_token으로 갱신 중...`,
  );

  try {
    const newTokens = await refreshAccessToken(creds.refresh_token);
    if (!newTokens?.access_token) {
      throw new Error('응답에 access_token 없음');
    }

    const updated: OAuthCreds = {
      ...creds,
      access_token: newTokens.access_token,
      expiry_date: newTokens.expiry_date ?? Date.now() + 3600 * 1000,
      ...(newTokens.id_token ? { id_token: newTokens.id_token } : {}),
      ...(newTokens.token_type ? { token_type: newTokens.token_type } : {}),
    };

    await saveCreds(updated);
    console.log(
      `[gemini-token] 갱신 완료 — 새 만료: ${new Date(updated.expiry_date).toISOString()}`,
    );
    return true;
  } catch (err) {
    console.error('[gemini-token] 갱신 실패 (분석 진행 중 자동 갱신에 의존):', err);
    return false;
  }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 주기적 자동 갱신 시작 (워커 프로세스에서 한 번만 호출)
 * 45분마다 토큰 상태를 확인하고 필요시 갱신
 */
export function startGeminiTokenAutoRefresh(): void {
  if (refreshTimer) return;

  // gemini-cli를 실제로 사용하는지 확인 (파일 없으면 스킵)
  if (!existsSync(OAUTH_CREDS_PATH)) return;

  console.log('[gemini-token] 자동 갱신 스케줄러 시작 (45분 주기)');

  refreshTimer = setInterval(() => {
    ensureGeminiTokenFresh().catch((err) => {
      console.error('[gemini-token] 자동 갱신 오류:', err);
    });
  }, AUTO_REFRESH_INTERVAL_MS);

  // setInterval은 Node.js 종료를 막지 않도록 unref
  refreshTimer.unref();
}

export function stopGeminiTokenAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
