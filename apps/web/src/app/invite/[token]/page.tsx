'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AcceptStatus = 'loading' | 'success' | 'expired' | 'already_accepted' | 'error';

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const { status: authStatus } = useSession();
  const token = params.token as string;
  const [acceptStatus, setAcceptStatus] = useState<AcceptStatus>('loading');
  const [teamName, setTeamName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const acceptMutation = useMutation({
    mutationFn: () => trpcClient.team.acceptInvite.mutate({ token }),
    onSuccess: (data) => {
      setAcceptStatus('success');
      setTeamName(data.teamName);
    },
    onError: (error: { message?: string }) => {
      const msg = error.message ?? '';
      if (msg.includes('만료')) {
        setAcceptStatus('expired');
      } else if (msg.includes('이미 수락')) {
        setAcceptStatus('already_accepted');
      } else {
        setAcceptStatus('error');
        setErrorMessage(msg || '초대 수락에 실패했습니다');
      }
    },
  });

  // 미인증 시 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push(`/login?callbackUrl=/invite/${token}`);
    }
  }, [authStatus, router, token]);

  // 인증 완료 시 자동 수락
  useEffect(() => {
    if (authStatus === 'authenticated' && acceptStatus === 'loading') {
      acceptMutation.mutate();
    }
  }, [authStatus, acceptStatus]); // acceptMutation.mutate는 안정 참조

  // 로딩 중
  if (authStatus === 'loading' || acceptStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-muted-foreground">초대를 처리하고 있습니다...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">
            {acceptStatus === 'success' && '팀 합류 완료'}
            {acceptStatus === 'expired' && '초대 만료'}
            {acceptStatus === 'already_accepted' && '이미 수락된 초대'}
            {acceptStatus === 'error' && '오류 발생'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {acceptStatus === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-center">
                <strong>{teamName}</strong> 팀에 합류했습니다!
              </p>
              <Button onClick={() => router.push('/')} className="w-full">
                대시보드로 이동
              </Button>
            </>
          )}

          {acceptStatus === 'expired' && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-muted-foreground">
                초대 링크가 만료되었거나 유효하지 않습니다.
              </p>
              <p className="text-center text-sm text-muted-foreground">
                관리자에게 새로운 초대를 요청해 주세요.
              </p>
            </>
          )}

          {acceptStatus === 'already_accepted' && (
            <>
              <AlertTriangle className="h-12 w-12 text-yellow-500" />
              <p className="text-center text-muted-foreground">이미 수락된 초대입니다.</p>
              <Button variant="outline" onClick={() => router.push('/')} className="w-full">
                대시보드로 이동
              </Button>
            </>
          )}

          {acceptStatus === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-muted-foreground">{errorMessage}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
