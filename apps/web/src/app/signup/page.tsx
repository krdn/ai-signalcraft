'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Activity, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';

export default function SignupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const userRole = session?.user?.role;
  const isDemo = userRole === 'demo';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await trpcClient.demoAuth.upgrade.mutate({ password });
      // 세션 갱신을 위해 페이지 이동
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '전환에 실패했습니다';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      aria-label="회원가입"
      className="min-h-screen flex items-center justify-center bg-background px-4"
    >
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-primary">SignalCraft</span>
          </Link>
        </header>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {isDemo ? '정식 가입으로 전환' : '무료 체험 신청'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {isDemo
                ? '비밀번호를 설정하면 정식 회원으로 전환됩니다'
                : '무료 데모 체험을 통해 AI SignalCraft를 경험해 보세요'}
            </p>
          </CardHeader>
          <CardContent>
            {isDemo ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <p className="font-medium">{session?.user?.name}</p>
                  <p className="text-muted-foreground text-xs">{session?.user?.email}</p>
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
                <div className="space-y-2">
                  <Label htmlFor="confirm">비밀번호 확인</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="비밀번호 재입력"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      전환 중...
                    </>
                  ) : (
                    <>
                      정식 회원으로 전환
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>

                <div className="mt-4 rounded-md bg-primary/5 p-3 text-xs space-y-1">
                  <p className="font-medium text-primary">정식 회원 혜택</p>
                  <p>- 무제한 분석 실행</p>
                  <p>- 14개 전체 AI 분석 모듈 이용</p>
                  <p>- 전체 수집 한도 이용</p>
                  <p>- 종합 전략 리포트 생성</p>
                  <p>- 팀 협업 기능</p>
                </div>
              </form>
            ) : (
              <div className="text-center py-8 space-y-4">
                <p className="text-muted-foreground">
                  {session
                    ? '데모 계정에서만 전환이 가능합니다.'
                    : '먼저 데모 체험을 시작해 주세요.'}
                </p>
                <Link
                  href={session ? '/dashboard' : '/demo'}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {session ? '대시보드로' : '무료 체험 시작'}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
