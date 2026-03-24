'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';

export function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: (input: { email: string; role: 'admin' | 'member' }) =>
      trpcClient.team.invite.mutate(input),
    onSuccess: () => {
      toast.success('초대 이메일을 발송했습니다');
      setEmail('');
      setRole('member');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: [['team', 'getMembers']] });
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '초대 발송에 실패했습니다');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    inviteMutation.mutate({ email: email.trim(), role });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            팀원 초대
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>팀원 초대</DialogTitle>
          <DialogDescription>
            이메일로 팀원을 초대합니다. 초대 링크는 7일 후 만료됩니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">이메일</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="초대할 이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={inviteMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>역할</Label>
            <Select
              value={role}
              onValueChange={(val) => setRole(val as 'admin' | 'member')}
              disabled={inviteMutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">멤버</SelectItem>
                <SelectItem value="admin">관리자</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={inviteMutation.isPending || !email.trim()}
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  발송 중...
                </>
              ) : (
                '초대 발송'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
