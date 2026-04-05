import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import {
  db,
  users,
  accounts,
  sessions,
  verificationTokens,
  demoQuotas,
} from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { authConfig } from './auth.config';
import { DEMO_DEFAULTS } from './trpc/shared/demo-config';

// Google OAuth는 환경변수가 설정된 경우에만 활성화
const providers = [
  Credentials({
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, credentials.email as string))
        .limit(1);
      if (!user[0]?.hashedPassword) return null;
      // 비활성화된 계정은 로그인 거부
      if (user[0].isActive === false) return null;
      const valid = await bcrypt.compare(credentials.password as string, user[0].hashedPassword);
      if (!valid) return null;
      return {
        id: user[0].id,
        email: user[0].email,
        name: user[0].name,
        role: user[0].role,
      };
    },
  }),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : []),
];

// DB 의존 프로바이더로 오버라이드 (미들웨어용 auth.config.ts의 프로바이더 대체)
const nextAuth = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  events: {
    async createUser({ user }) {
      // Google OAuth 신규 사용자: 데모 쿠키 있으면 demo 설정
      if (!user.id) return;
      const cookieStore = await cookies();
      const isDemoSignup = cookieStore.get('demo_signup')?.value === '1';

      if (isDemoSignup) {
        await db.update(users).set({ role: 'demo' }).where(eq(users.id, user.id));
        await db.insert(demoQuotas).values({
          userId: user.id,
          dailyLimit: DEMO_DEFAULTS.dailyLimit,
          todayUsed: 0,
          totalUsed: 0,
          allowedModules: DEMO_DEFAULTS.allowedModules,
          maxCollectionLimits: DEMO_DEFAULTS.maxCollectionLimits,
          expiresAt: new Date(Date.now() + DEMO_DEFAULTS.expiryDays * 24 * 60 * 60 * 1000),
        });
        // 쿠키 삭제
        cookieStore.delete('demo_signup');
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Google OAuth 신규 사용자: 데모 쿠키 없으면 /demo로 안내
      if (account?.provider === 'google' && user.email) {
        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (!existing) {
          // 신규 사용자 — demo_signup 쿠키 확인
          const cookieStore = await cookies();
          const isDemoSignup = cookieStore.get('demo_signup')?.value === '1';

          if (!isDemoSignup) {
            // /login에서 온 신규 사용자 → 데모 가입 안내
            return '/demo?error=signup_required';
          }
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, account }) {
      if (user) {
        token.role = user.role;
      }
      // Google OAuth 로그인 또는 세션 갱신 시 DB에서 최신 role 반영
      if (token.sub && (account?.provider === 'google' || trigger === 'update')) {
        const [dbUser] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, token.sub))
          .limit(1);
        if (dbUser) token.role = dbUser.role;
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
});

export const handlers: typeof nextAuth.handlers = nextAuth.handlers;
export const auth: typeof nextAuth.auth = nextAuth.auth;
export const signIn: typeof nextAuth.signIn = nextAuth.signIn;
export const signOut: typeof nextAuth.signOut = nextAuth.signOut;
