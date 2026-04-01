'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Users } from 'lucide-react';
import { InviteDialog } from './invite-dialog';
import { MemberList } from './member-list';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TeamSettings() {
  const queryClient = useQueryClient();
  const [teamName, setTeamName] = useState('');

  const { data: team, isLoading } = useQuery({
    queryKey: [['team', 'getMyTeam']],
    queryFn: () => trpcClient.team.getMyTeam.query(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => trpcClient.team.create.mutate({ name }),
    onSuccess: () => {
      toast.success('팀이 생성되었습니다');
      queryClient.invalidateQueries({ queryKey: [['team', 'getMyTeam']] });
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '팀 생성에 실패했습니다');
    },
  });

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    createMutation.mutate(teamName.trim());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        불러오는 중...
      </div>
    );
  }

  // 팀이 없는 경우: 팀 생성 폼
  if (!team) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5" />팀 생성
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">팀 이름</Label>
              <Input
                id="team-name"
                placeholder="팀 이름을 입력하세요"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                maxLength={100}
                disabled={createMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending || !teamName.trim()}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                '팀 생성'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const isAdmin = team.myRole === 'admin';

  return (
    <div className="space-y-6">
      {/* 팀 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{team.name}</h2>
        {isAdmin && <InviteDialog />}
      </div>

      {/* 팀원 목록 */}
      <MemberList isAdmin={isAdmin} />
    </div>
  );
}
