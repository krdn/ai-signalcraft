'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, CheckCircle2, Handshake, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpcClient } from '@/lib/trpc';

export default function PartnerApplyPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState<'individual' | 'corporation'>('individual');
  const [program, setProgram] = useState<'reseller' | 'partner'>('reseller');
  const [salesArea, setSalesArea] = useState('');
  const [introduction, setIntroduction] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await trpcClient.partner.submitApplication.mutate({
        name,
        email,
        phone: phone || undefined,
        businessType,
        program,
        salesArea: salesArea || undefined,
        introduction: introduction || undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '신청에 실패했습니다';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
            <h2 className="mb-2 text-xl font-bold">신청이 접수되었습니다</h2>
            <p className="mb-6 text-muted-foreground">
              담당자가 검토 후 입력하신 이메일로 연락드리겠습니다.
              <br />
              보통 1~3 영업일 내에 회신드립니다.
            </p>
            <Link href="/">
              <Button variant="outline">홈으로 돌아가기</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-2 flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            <span className="text-lg font-bold">AI SignalCraft</span>
          </Link>
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Handshake className="size-5" />
            파트너 신청
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            파트너로 등록하고 AI SignalCraft를 영업하세요
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">이름 *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일 *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partner@example.com"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">연락처</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                />
              </div>
              <div className="space-y-2">
                <Label>사업자 유형 *</Label>
                <Select
                  value={businessType}
                  onValueChange={(v) => {
                    if (v) setBusinessType(v as 'individual' | 'corporation');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">개인 사업자</SelectItem>
                    <SelectItem value="corporation">법인 사업자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>관심 프로그램 *</Label>
              <Select
                value={program}
                onValueChange={(v) => {
                  if (v) setProgram(v as 'reseller' | 'partner');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reseller">리셀러 (수수료 10~20%)</SelectItem>
                  <SelectItem value="partner">사업 파트너 (수수료 10~50%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salesArea">주요 영업 분야</Label>
              <Input
                id="salesArea"
                value={salesArea}
                onChange={(e) => setSalesArea(e.target.value)}
                placeholder="예: 정치 컨설팅, PR 에이전시, 기업 홍보"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="introduction">자기소개</Label>
              <Textarea
                id="introduction"
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                placeholder="경력, 영업 네트워크, 관심 분야 등을 자유롭게 작성해주세요"
                rows={4}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  신청 중...
                </>
              ) : (
                '파트너 신청하기'
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            이미 파트너 계정이 있으신가요?{' '}
            <Link href="/login" className="text-primary hover:underline">
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
