'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type Rule = Awaited<
  ReturnType<typeof trpcClient.manipulationAlerts.listBySubscription.query>
>[number];

interface Props {
  subscriptionId: number;
}

interface FormState {
  id?: number;
  name: string;
  enabled: boolean;
  scoreThreshold: number;
  cooldownMinutes: number;
  channelType: 'slack' | 'webhook';
  slackUrl: string;
  webhookUrl: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  enabled: true,
  scoreThreshold: 60,
  cooldownMinutes: 360,
  channelType: 'slack',
  slackUrl: '',
  webhookUrl: '',
};

export function AlertRulesCard({ subscriptionId }: Props) {
  const qc = useQueryClient();
  const queryKey = ['manipulation-alerts', 'list', subscriptionId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => trpcClient.manipulationAlerts.listBySubscription.query({ subscriptionId }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createMut = useMutation({
    mutationFn: (input: Parameters<typeof trpcClient.manipulationAlerts.create.mutate>[0]) =>
      trpcClient.manipulationAlerts.create.mutate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });
  const updateMut = useMutation({
    mutationFn: (input: Parameters<typeof trpcClient.manipulationAlerts.update.mutate>[0]) =>
      trpcClient.manipulationAlerts.update.mutate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });
  const deleteMut = useMutation({
    mutationFn: (ruleId: number) => trpcClient.manipulationAlerts.delete.mutate({ ruleId }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  function openNew() {
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(rule: Rule) {
    setForm({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      scoreThreshold: rule.scoreThreshold,
      cooldownMinutes: rule.cooldownMinutes,
      channelType: rule.channel.type,
      slackUrl: rule.channel.type === 'slack' ? rule.channel.webhookUrl : '',
      webhookUrl: rule.channel.type === 'webhook' ? rule.channel.url : '',
    });
    setOpen(true);
  }

  function handleSubmit() {
    const channel =
      form.channelType === 'slack'
        ? { type: 'slack' as const, webhookUrl: form.slackUrl }
        : { type: 'webhook' as const, url: form.webhookUrl };
    if (form.id) {
      updateMut.mutate({
        ruleId: form.id,
        patch: {
          name: form.name,
          enabled: form.enabled,
          scoreThreshold: form.scoreThreshold,
          cooldownMinutes: form.cooldownMinutes,
          channel,
        },
      });
    } else {
      createMut.mutate({
        subscriptionId,
        name: form.name,
        enabled: form.enabled,
        scoreThreshold: form.scoreThreshold,
        cooldownMinutes: form.cooldownMinutes,
        channel,
      });
    }
    setOpen(false);
  }

  return (
    <Card className="m-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">알림 규칙</CardTitle>
        <Button size="sm" onClick={openNew}>
          + 규칙 추가
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">로딩 중…</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            이 구독에 알림 규칙이 없습니다. 임계값을 정하면 점수가 그 이상일 때 Slack/webhook으로
            통보됩니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between rounded border p-2 text-sm"
              >
                <div>
                  <span className="font-medium">{rule.name}</span>
                  <span className="ml-3 text-muted-foreground">
                    점수 ≥ {rule.scoreThreshold} · 쿨다운 {rule.cooldownMinutes}분 ·{' '}
                    {rule.channel.type === 'slack' ? 'Slack' : 'Webhook'} ·{' '}
                    {rule.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>
                    편집
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`"${rule.name}" 규칙을 삭제하시겠습니까?`)) {
                        deleteMut.mutate(rule.id);
                      }
                    }}
                  >
                    삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? '규칙 편집' : '새 규칙'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>이름</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                />
                <Label>활성화</Label>
              </div>
              <div>
                <Label>점수 임계값 (0-100)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.scoreThreshold}
                  onChange={(e) => setForm({ ...form, scoreThreshold: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>쿨다운 (분, 1-10080)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10080}
                  value={form.cooldownMinutes}
                  onChange={(e) => setForm({ ...form, cooldownMinutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>채널</Label>
                <div className="flex gap-3 text-sm">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={form.channelType === 'slack'}
                      onChange={() => setForm({ ...form, channelType: 'slack' })}
                    />
                    Slack
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={form.channelType === 'webhook'}
                      onChange={() => setForm({ ...form, channelType: 'webhook' })}
                    />
                    Webhook
                  </label>
                </div>
              </div>
              {form.channelType === 'slack' ? (
                <div>
                  <Label>Slack webhook URL</Label>
                  <Input
                    placeholder="https://hooks.slack.com/services/..."
                    value={form.slackUrl}
                    onChange={(e) => setForm({ ...form, slackUrl: e.target.value })}
                  />
                </div>
              ) : (
                <div>
                  <Label>Webhook URL</Label>
                  <Input
                    placeholder="https://example.com/hook"
                    value={form.webhookUrl}
                    onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button onClick={handleSubmit}>{form.id ? '저장' : '추가'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
