'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Activity, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { trpcClient } from '@/lib/trpc';

export default function DemoSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'signup_required') {
      setError('가입되지 않은 계정입니다. 아래에서 먼저 가입해 주세요.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다');
      setLoading(false);
      return;
    }

    try {
      // 1. 데모 계정 생성
      await trpcClient.demoAuth.signup.mutate({ email, name, password });

      // 2. 바로 로그인
      const loginResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        setError(
          '가입은 완료되었지만 자동 로그인에 실패했습니다. 로그인 페이지에서 시도해 주세요.',
        );
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '데모 가입에 실패했습니다';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      aria-label="데모 회원가입"
      className="min-h-screen flex items-center justify-center bg-background px-4"
    >
      <div className="w-full max-w-md space-y-6">
        {/* 로고 */}
        <header className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-primary">SignalCraft</span>
          </Link>
        </header>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">무료 체험 시작하기</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              간단한 가입으로 바로 AI 여론 분석을 체험할 수 있습니다
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="8자 이상 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    가입 중...
                  </>
                ) : (
                  <>
                    무료 체험 시작
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="relative my-4">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                또는
              </span>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                document.cookie = 'demo_signup=1; path=/; max-age=300; samesite=lax';
                signIn('google', { callbackUrl: '/dashboard' });
              }}
              disabled={loading}
            >
              Google로 체험 시작
            </Button>

            {/* 체험 안내 */}
            <div className="mt-6 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p>- 가입 후 바로 체험 가능</p>
              <p>- AI 분석 3회, 7일간 무료 제공</p>
              <p>- 핵심 분석 모듈 3개 이용 가능</p>
              <p>- 체험 후 정식 가입으로 전환 가능</p>
            </div>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-primary hover:underline">
                로그인
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
