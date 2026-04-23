'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Activity, CheckCircle2, Loader2, MailCheck, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

type VerifyState = 'verifying' | 'success' | 'expired' | 'error' | 'waiting';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'waiting');
  const [errorMessage, setErrorMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 쿨다운 타이머
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // 토큰이 있으면 자동 인증
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        await trpcClient.demoAuth.verifyEmail.mutate({ token });
        setState('success');
        setTimeout(() => router.push('/login'), 2500);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '인증에 실패했습니다';
        if (message.includes('만료')) {
          setState('expired');
        } else {
          setState('error');
        }
        setErrorMessage(message);
      }
    })();
  }, [token, router]);

  // 인증 메일 재발송
  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setResending(true);
    try {
      await trpcClient.demoAuth.resendCode.mutate({ email });
      setCooldown(60);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '재발송에 실패했습니다';
      setErrorMessage(message);
    } finally {
      setResending(false);
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
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {state === 'success' ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : state === 'error' || state === 'expired' ? (
                <XCircle className="h-6 w-6 text-destructive" />
              ) : (
                <MailCheck className="h-6 w-6 text-primary" />
              )}
            </div>
            <CardTitle className="text-xl">이메일 인증</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 인증 진행 중 */}
            {state === 'verifying' && (
              <div className="text-center py-6 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">이메일을 인증하는 중입니다...</p>
              </div>
            )}

            {/* 인증 성공 */}
            {state === 'success' && (
              <div className="text-center py-6 space-y-3">
                <p className="text-green-600 font-medium text-lg">인증이 완료되었습니다!</p>
                <p className="text-sm text-muted-foreground">
                  잠시 후 로그인 페이지로 이동합니다...
                </p>
              </div>
            )}

            {/* 링크 만료 */}
            {state === 'expired' && (
              <div className="text-center py-6 space-y-4">
                <p className="text-destructive font-medium">인증 링크가 만료되었습니다</p>
                <p className="text-sm text-muted-foreground">새 인증 메일을 요청해 주세요.</p>
                {email && (
                  <Button
                    variant="outline"
                    onClick={handleResend}
                    disabled={resending || cooldown > 0}
                  >
                    {resending
                      ? '발송 중...'
                      : cooldown > 0
                        ? `인증 메일 재발송 (${cooldown}초)`
                        : '인증 메일 재발송'}
                  </Button>
                )}
              </div>
            )}

            {/* 기타 에러 */}
            {state === 'error' && (
              <div className="text-center py-6 space-y-4">
                <p className="text-destructive font-medium">{errorMessage}</p>
                <Link href="/demo">
                  <Button variant="outline">다시 가입하기</Button>
                </Link>
              </div>
            )}

            {/* 이메일 확인 대기 (가입 직후 리다이렉트됨) */}
            {state === 'waiting' && (
              <div className="text-center py-6 space-y-4">
                <p className="text-muted-foreground">
                  {email ? (
                    <>
                      <strong>{email}</strong>으로 인증 메일을 발송했습니다.
                    </>
                  ) : (
                    '인증 메일을 확인해 주세요.'
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  메일함에서 <strong>[이메일 인증하기]</strong> 버튼을 클릭하면 인증이 완료됩니다.
                </p>

                {email && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-primary"
                    onClick={handleResend}
                    disabled={resending || cooldown > 0}
                  >
                    {resending
                      ? '발송 중...'
                      : cooldown > 0
                        ? `인증 메일 재발송 (${cooldown}초)`
                        : '메일을 못 받으셨나요? 재발송'}
                  </Button>
                )}

                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1 text-left">
                  <p>- 인증 링크는 10분간 유효합니다</p>
                  <p>- 이메일이 도착하지 않으면 스팸함을 확인해 주세요</p>
                  <p>- 재발송은 1분 간격으로 가능합니다</p>
                </div>
              </div>
            )}

            {/* 로그인 링크 */}
            {(state === 'waiting' || state === 'success') && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                이미 인증하셨나요?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  로그인
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
