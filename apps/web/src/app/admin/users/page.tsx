'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  leader: '팀장',
  sales: '영업',
  partner: '파트너',
  member: '멤버',
  demo: '데모',
};

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  leader: 'default',
  sales: 'secondary',
  partner: 'secondary',
  member: 'secondary',
  demo: 'outline',
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string | null;
    email: string;
  } | null>(null);
  const [toggleTarget, setToggleTarget] = useState<{
    id: string;
    name: string | null;
    email: string;
    isActive: boolean;
  } | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    userId: string;
    userName: string | null;
    userEmail: string;
    currentRole: string;
    newRole: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search, roleFilter],
    queryFn: () =>
      trpcClient.admin.users.list.query({
        page,
        pageSize: 20,
        search: search || undefined,
        role: roleFilter === 'all' ? undefined : (roleFilter as 'admin' | 'member' | 'demo'),
      }),
  });

  const updateRole = useMutation({
    mutationFn: (input: {
      userId: string;
      role: 'admin' | 'leader' | 'sales' | 'partner' | 'member' | 'demo';
    }) => trpcClient.admin.users.updateRole.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('역할이 변경되었습니다');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: (input: { userId: string; isActive: boolean }) =>
      trpcClient.admin.users.toggleActive.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('상태가 변경되었습니다');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => trpcClient.admin.users.deleteUser.mutate({ userId }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(`${result.deletedEmail} 계정이 삭제되었습니다`);
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteTarget(null);
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">사용자 관리</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle as="h2" className="text-base">
              사용자 목록 {data && `(${data.total}명)`}
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="이름 또는 이메일 검색"
                  className="pl-8 w-56"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={(v) => {
                  setRoleFilter(v ?? 'all');
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="leader">팀장</SelectItem>
                  <SelectItem value="sales">영업</SelectItem>
                  <SelectItem value="partner">파트너</SelectItem>
                  <SelectItem value="member">멤버</SelectItem>
                  <SelectItem value="demo">데모</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <caption className="sr-only">사용자 목록</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(role) =>
                            setRoleChangeTarget({
                              userId: user.id,
                              userName: user.name,
                              userEmail: user.email,
                              currentRole: user.role,
                              newRole: role ?? user.role,
                            })
                          }
                        >
                          <SelectTrigger
                            className="w-24 h-7 text-xs"
                            aria-label={`${user.name ?? user.email} 역할 변경`}
                          >
                            <Badge variant={ROLE_VARIANTS[user.role]}>
                              {ROLE_LABELS[user.role]}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">관리자</SelectItem>
                            <SelectItem value="leader">팀장</SelectItem>
                            <SelectItem value="sales">영업</SelectItem>
                            <SelectItem value="partner">파트너</SelectItem>
                            <SelectItem value="member">멤버</SelectItem>
                            <SelectItem value="demo">데모</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'secondary' : 'outline'}>
                          {user.isActive ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() =>
                              setToggleTarget({
                                id: user.id,
                                name: user.name,
                                email: user.email,
                                isActive: user.isActive,
                              })
                            }
                          >
                            {user.isActive ? '비활성화' : '활성화'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setDeleteTarget({ id: user.id, name: user.name, email: user.email })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    이전
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사용자 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name ?? deleteTarget?.email}</strong> 계정을 삭제합니다. 관련된
              세션, 팀 멤버십, 데모 쿼터가 삭제되며, 분석 작업 기록은 보존됩니다. 이 작업은 되돌릴
              수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => deleteTarget && deleteUser.mutate(deleteTarget.id)}
            >
              {deleteUser.isPending ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 활성/비활성 전환 확인 다이얼로그 */}
      <AlertDialog
        open={toggleTarget !== null}
        onOpenChange={(open) => {
          if (!open) setToggleTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.isActive ? '사용자 비활성화' : '사용자 활성화'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.isActive
                ? `${toggleTarget?.name ?? toggleTarget?.email} 계정을 비활성화하시겠습니까? 비활성화된 계정은 로그인할 수 없습니다.`
                : `${toggleTarget?.name ?? toggleTarget?.email} 계정을 활성화하시겠습니까?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={toggleActive.isPending}
              onClick={() =>
                toggleTarget &&
                toggleActive.mutate({
                  userId: toggleTarget.id,
                  isActive: !toggleTarget.isActive,
                })
              }
            >
              {toggleTarget?.isActive ? '비활성화' : '활성화'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 역할 변경 확인 다이얼로그 */}
      <AlertDialog
        open={roleChangeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRoleChangeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>역할 변경 확인</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{roleChangeTarget?.userName ?? roleChangeTarget?.userEmail}</strong>의 역할을{' '}
              <Badge variant={ROLE_VARIANTS[roleChangeTarget?.currentRole ?? '']}>
                {ROLE_LABELS[roleChangeTarget?.currentRole ?? '']}
              </Badge>{' '}
              에서{' '}
              <Badge variant={ROLE_VARIANTS[roleChangeTarget?.newRole ?? '']}>
                {ROLE_LABELS[roleChangeTarget?.newRole ?? '']}
              </Badge>{' '}
              로 변경하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateRole.isPending}
              onClick={() =>
                roleChangeTarget &&
                updateRole.mutate({
                  userId: roleChangeTarget.userId,
                  role: roleChangeTarget.newRole as
                    | 'admin'
                    | 'leader'
                    | 'sales'
                    | 'partner'
                    | 'member'
                    | 'demo',
                })
              }
            >
              {updateRole.isPending ? '변경 중...' : '변경'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
