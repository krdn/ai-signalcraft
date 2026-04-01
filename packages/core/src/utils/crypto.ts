// AES-256-GCM 기반 API 키 암호화/복호화 유틸리티
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const _AUTH_TAG_LENGTH = 16;

/**
 * 암호화 키 조회
 * 환경변수 ENCRYPTION_KEY 사용, 없으면 SHA-256 해시로 폴백 생성
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    // 32바이트로 맞추기 위해 SHA-256 해시
    return createHash('sha256').update(envKey).digest();
  }

  // 폴백: 경고 출력 후 고정 시드 기반 키 생성 (개발용)
  console.warn(
    '[crypto] ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. 기본 폴백 키를 사용합니다. 프로덕션에서는 반드시 ENCRYPTION_KEY를 설정하세요.',
  );
  return createHash('sha256').update('ai-signalcraft-default-dev-key').digest();
}

/**
 * AES-256-GCM 암호화
 * @returns "iv:authTag:encrypted" 형태의 문자열
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * AES-256-GCM 복호화
 * @param text "iv:authTag:encrypted" 형태의 문자열
 */
export function decrypt(text: string): string {
  const key = getEncryptionKey();
  const parts = text.split(':');
  if (parts.length !== 3) {
    throw new Error('잘못된 암호화 형식입니다');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * API 키 마스킹 (표시용)
 * 예: "sk-abc123def456" → "sk-...f456"
 */
export function maskKey(key: string): string {
  if (!key || key.length < 8) return '****';

  const prefix = key.slice(0, 3);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}
