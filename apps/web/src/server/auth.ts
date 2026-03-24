import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db, users } from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';

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
      const valid = await bcrypt.compare(
        credentials.password as string,
        user[0].hashedPassword,
      );
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
  adapter: DrizzleAdapter(db),
  providers,
});

export const handlers: typeof nextAuth.handlers = nextAuth.handlers;
export const auth: typeof nextAuth.auth = nextAuth.auth;
export const signIn: typeof nextAuth.signIn = nextAuth.signIn;
export const signOut: typeof nextAuth.signOut = nextAuth.signOut;
