import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(
  new URL('../packages/core/package.json', import.meta.url),
);
const pg = require('pg');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const OLD_FALLBACK_SEED = 'ai-signalcraft-default-dev-key';

function deriveKey(source) {
  return createHash('sha256').update(source).digest();
}

function decryptWithKey(text, key) {
  const parts = text.split(':');
  if (parts.length !== 3) throw new Error('잘못된 암호화 형식');
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptWithKey(text, key) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

const newKeyEnv = process.env.NEW_ENCRYPTION_KEY;
if (!newKeyEnv) {
  console.error('NEW_ENCRYPTION_KEY 환경변수를 설정하세요');
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL 환경변수를 설정하세요');
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

const oldKey = deriveKey(OLD_FALLBACK_SEED);
const newKey = deriveKey(newKeyEnv);

const { rows } = await client.query(
  'SELECT id, provider_name, name, encrypted_key FROM provider_keys WHERE encrypted_key IS NOT NULL',
);

console.log(`${rows.length}개 키 마이그레이션 시작...\n`);

for (const row of rows) {
  try {
    const plaintext = decryptWithKey(row.encrypted_key, oldKey);
    console.log(`[${row.id}] ${row.provider_name} / ${row.name}: 복호화 성공 (${plaintext.slice(0, 6)}...)`);

    const reEncrypted = encryptWithKey(plaintext, newKey);

    const verify = decryptWithKey(reEncrypted, newKey);
    if (verify !== plaintext) throw new Error('재암호화 검증 실패');

    await client.query('UPDATE provider_keys SET encrypted_key = $1, updated_at = NOW() WHERE id = $2', [
      reEncrypted,
      row.id,
    ]);
    console.log(`  → 재암호화 완료\n`);
  } catch (err) {
    console.error(`[${row.id}] ${row.provider_name} 실패:`, err.message);
  }
}

await client.end();
console.log('마이그레이션 완료');
