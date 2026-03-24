'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { useSession } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { MoreHorizontal, Shield, User, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: Date;
}

interface MemberListProps {
  isAdmin: boolean;
}

export function MemberList({ isAdmin }: MemberListProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: [['team', 'getMembers']],
    queryFn: () => trpcClient.team.getMembers.query(),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      trpcClient.team.removeMember.mutate({ userId }),
    onSuccess: () => {
      toast.success('팀원이 제거되었습니다');
      queryClient.invalidateQueries({ queryKey: [['team', 'getMembers']] });
      setRemovingId(null);
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '팀원 제거에 실패했습니다');
      setRemovingId(null);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: (input: { userId: string; role: 'admin' | 'member' }) =>
      trpcClient.team.updateRole.mutate(input),
    onSuccess: () => {
      toast.success('역할이 변경되었습니다');
      queryClient.invalidateQueries({ queryKey: [['team', 'getMembers']] });
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '역할 변경에 실패했습니다');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        팀원 없음
      </div>
    );
  }

  const isMe = (userId: string) => session?.user?.id === userId;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead>이메일</TableHead>
          <TableHead>역할</TableHead>
          <TableHead>가입일</TableHead>
          {isAdmin && <TableHead className="w-12" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {(members as unknown as TeamMember[]).map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-medium">
              {member.name ?? '-'}
              {isMe(member.id) && (
                <span className="ml-2 text-xs text-muted-foreground">(나)</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {member.email}
            </TableCell>
            <TableCell>
              <Badge
                variant={member.role === 'admin' ? 'default' : 'secondary'}
              >
                {member.role === 'admin' ? (
                  <><Shield className="mr-1 h-3 w-3" />관리자</>
                ) : (
                  <><User className="mr-1 h-3 w-3" />멤버</>
                )}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {format(new Date(member.joinedAt), 'yyyy-MM-dd')}
            </TableCell>
            {isAdmin && (
              <TableCell>
                {!isMe(member.id) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      {/* 역할 변경 */}
                      <DropdownMenuItem
                        onSelect={() =>
                          updateRoleMutation.mutate({
                            userId: member.id,
                            role:
                              member.role === 'admin' ? 'member' : 'admin',
                          })
                        }
                      >
                        {member.role === 'admin'
                          ? '멤버로 변경'
                          : '관리자로 변경'}
                      </DropdownMenuItem>
                      {/* 제거 -- AlertDialog 트리거 */}
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => setRemovingId(member.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        팀에서 제거
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>

      {/* 제거 확인 AlertDialog */}
      {removingId && (
        <AlertDialog
          open={!!removingId}
          onOpenChange={(open) => !open && setRemovingId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>팀원 제거</AlertDialogTitle>
              <AlertDialogDescription>
                정말{' '}
                {(members as unknown as TeamMember[]).find((m) => m.id === removingId)
                  ?.name ?? '이 팀원'}
                님을 팀에서 제거하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (removingId) removeMutation.mutate(removingId);
                }}
              >
                제거
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Table>
  );
}
