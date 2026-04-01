import NextAuth from 'next-auth';
import { authConfig } from '@/server/auth.config';

// 미들웨어용 경량 auth -- DB/Playwright 의존성 없이 JWT 토큰 검증만 수행
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico|icon.svg|manifest.json|icons/|sw.js).*)',
  ],
};
