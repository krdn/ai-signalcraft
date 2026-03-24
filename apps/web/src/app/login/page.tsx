import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: '로그인 - AI SignalCraft',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Suspense fallback={<div className="h-[400px] w-full max-w-sm" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
