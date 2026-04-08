import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

// 미들웨어용 경량 설정 -- DB 의존성 없이 프로바이더만 정의
// authorize 로직은 auth.ts에서 완전한 버전으로 오버라이드됨
export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // 미들웨어에서는 authorize가 호출되지 않음 (JWT 토큰 검증만 수행)
      authorize: () => null,
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user;
      const isLoginPage = nextUrl.pathname.startsWith('/login');
      const isPublicPage =
        nextUrl.pathname === '/' ||
        nextUrl.pathname.startsWith('/landing') ||
        nextUrl.pathname.startsWith('/invite') ||
        nextUrl.pathname.startsWith('/demo') ||
        nextUrl.pathname.startsWith('/signup') ||
        nextUrl.pathname.startsWith('/verify-email') ||
        nextUrl.pathname.startsWith('/partner/apply') ||
        nextUrl.pathname.startsWith('/hardware') ||
        nextUrl.pathname.startsWith('/shared') ||
        nextUrl.pathname.startsWith('/showcase') ||
        nextUrl.pathname.startsWith('/whitepaper');
      const isAdminPage = nextUrl.pathname.startsWith('/admin');
      const isSalesPage = nextUrl.pathname.startsWith('/sales');
      const isPartnerPage =
        nextUrl.pathname.startsWith('/partner') && !nextUrl.pathname.startsWith('/partner/apply');

      // 공개 페이지는 인증 없이 접근 허용
      if (isPublicPage) return true;

      if (isLoginPage) {
        // 이미 로그인된 사용자가 /login 접근 시 대시보드로 리다이렉트
        if (isLoggedIn) return Response.redirect(new URL('/dashboard', nextUrl));
        return true;
      }

      // 어드민 페이지: 로그인 + role='admin' 필수
      if (isAdminPage) {
        if (!isLoggedIn) return false;
        const role = session?.user?.role;
        if (role !== 'admin') return Response.redirect(new URL('/dashboard', nextUrl));
        return true;
      }

      // 세일즈 페이지: 로그인 + admin/sales 역할 필수
      if (isSalesPage) {
        if (!isLoggedIn) return false;
        const role = session?.user?.role;
        if (!['admin', 'sales'].includes(role ?? ''))
          return Response.redirect(new URL('/dashboard', nextUrl));
        return true;
      }

      // 파트너 페이지: 로그인 + partner/sales/admin 역할 필수
      if (isPartnerPage) {
        if (!isLoggedIn) return false;
        const role = session?.user?.role;
        if (!['partner', 'sales', 'admin'].includes(role ?? ''))
          return Response.redirect(new URL('/dashboard', nextUrl));
        return true;
      }

      // 미인증 사용자는 /login으로 리다이렉트
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
