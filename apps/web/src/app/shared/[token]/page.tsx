'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Lock, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpcClient } from '@/lib/trpc';

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared', params.token, submittedPassword],
    queryFn: () =>
      trpcClient.sales.shareLinks.getByToken.query({
        token: params.token,
        password: submittedPassword,
      }),
    enabled: !!params.token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">리포트를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    const message = (error as { message?: string }).message ?? '리포트를 불러올 수 없습니다';
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive font-medium">{message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 비밀번호 필요
  if (data?.requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <Lock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <h2 className="text-lg font-semibold">비밀번호 필요</h2>
              <p className="text-sm text-muted-foreground">
                이 리포트는 비밀번호로 보호되어 있습니다
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmittedPassword(password);
              }}
              className="space-y-3"
            >
              <Input
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full">
                확인
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data || data.requiresPassword) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* 상단 바 */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.branding.customLogo ? (
              <img src={data.branding.customLogo} alt="" className="h-8" />
            ) : (
              <span className="text-lg font-semibold text-primary">SignalCraft</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-2" />
            PDF 다운로드
          </Button>
        </div>
      </header>

      {/* 리포트 본문 */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {data.report.oneLiner && (
          <div className="mb-6 p-4 bg-primary/5 border border-primary/10 rounded-lg">
            <p className="text-sm font-medium text-primary">{data.report.oneLiner}</p>
          </div>
        )}

        <article className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {data.report.markdownContent ?? ''}
          </ReactMarkdown>
        </article>

        {data.branding.watermark && (
          <div className="mt-12 pt-6 border-t text-center">
            <p className="text-xs text-muted-foreground">{data.branding.watermark}</p>
          </div>
        )}
      </div>
    </div>
  );
}
