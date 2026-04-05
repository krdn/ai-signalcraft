'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Activity, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';

export default function DemoSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. 데모 계정 생성
      const result = await trpcClient.demoAuth.signup.mutate({ email, name });

      // 2. 자동 로그인 (임시 비밀번호 사용)
      const signInResult = await signIn('credentials', {
        email: result.email,
        password: result.tempPassword,
        redirect: false,
      });

      if (signInResult?.ok) {
        router.push('/dashboard');
      } else {
        setError('자동 로그인에 실패했습니다. 로그인 페이지에서 다시 시도해 주세요.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '데모 가입에 실패했습니다';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        {/* 로고 */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-primary">SignalCraft</span>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">무료 체험 시작하기</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              이메일만 입력하면 바로 AI 여론 분석을 체험할 수 있습니다
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

            {/* 체험 안내 */}
            <div className="mt-6 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p>- 비밀번호 없이 바로 체험 가능</p>
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
    </div>
  );
}
