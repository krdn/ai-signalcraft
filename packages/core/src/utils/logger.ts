// 구조화 로거 팩토리
// 모듈별 prefix를 자동 부여하여 일관된 로그 포맷 제공

interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * 모듈별 로거 생성
 * @param moduleName 로그에 표시할 모듈명 (예: 'runner', 'worker')
 * @returns info/warn/error 메서드를 가진 로거 객체
 */
export function createLogger(moduleName: string): Logger {
  const prefix = `[${moduleName}]`;
  return {
    info: (...args: unknown[]) => console.log(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}

/** .catch(() => {}) 대신 사용하는 에러 로깅 유틸 */
export function logError(context: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[${context}] ${msg}`);
}
