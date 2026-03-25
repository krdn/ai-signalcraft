'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Trash2,
  TestTube,
  Pencil,
  Check,
  X,
  Key,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  PlusCircle,
} from 'lucide-react';

// 프로바이더 정의
const PROVIDERS = [
  { type: 'openai', name: 'OpenAI (ChatGPT)', color: 'bg-green-500' },
  { type: 'anthropic', name: 'Anthropic (Claude)', color: 'bg-orange-500' },
  { type: 'gemini', name: 'Google (Gemini)', color: 'bg-blue-500' },
  { type: 'deepseek', name: 'DeepSeek', color: 'bg-purple-500' },
  { type: 'ollama', name: 'Ollama (Local)', color: 'bg-gray-500' },
  { type: 'xai', name: 'xAI (Grok)', color: 'bg-red-500' },
  { type: 'openrouter', name: 'OpenRouter', color: 'bg-cyan-500' },
  { type: 'custom', name: 'Custom (OpenAI Compatible)', color: 'bg-zinc-500' },
] as const;

type ProviderKeyItem = {
  id: number;
  providerName: string;
  providerType: string;
  name: string;
  maskedKey: string | null;
  baseUrl: string | null;
  selectedModel: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

// 프로바이더 타입별 색상 뱃지
function ProviderBadge({ type }: { type: string }) {
  const provider = PROVIDERS.find((p) => p.type === type);
  return (
    <Badge variant="secondary" className="text-[10px]">
      {provider?.name ?? type}
    </Badge>
  );
}

// 프로바이더 선택 그리드
function ProviderGrid({
  onSelect,
}: {
  onSelect: (type: string, name: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PROVIDERS.map((p) => (
        <button
          key={p.type}
          onClick={() => onSelect(p.type, p.name)}
          className="flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50"
        >
          <div className={`h-2.5 w-2.5 rounded-full ${p.color}`} />
          <span className="font-medium">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

// 키 추가 폼
function AddKeyForm({
  providerType,
  providerName,
  onCancel,
  onAdded,
}: {
  providerType: string;
  providerName: string;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const needsKey = providerType !== 'ollama';
  const needsUrl = ['ollama', 'custom', 'openrouter'].includes(providerType);

  const addMutation = useMutation({
    mutationFn: (input: Parameters<typeof trpcClient.settings.providerKeys.add.mutate>[0]) =>
      trpcClient.settings.providerKeys.add.mutate(input),
    onSuccess: () => {
      toast.success('API 키가 추가되었습니다');
      onAdded();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? 'API 키 추가에 실패했습니다');
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('이름을 입력해주세요');
      return;
    }
    if (needsKey && !apiKey.trim()) {
      toast.error('API 키를 입력해주세요');
      return;
    }
    addMutation.mutate({
      name: name.trim(),
      providerType: providerType as 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'deepseek' | 'xai' | 'openrouter' | 'custom',
      providerName,
      key: apiKey.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" />
          {providerName} 키 추가
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="이름 (예: Production Key)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {needsKey && (
          <Input
            type="password"
            placeholder="API 키"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        )}
        {needsUrl && (
          <Input
            placeholder={providerType === 'ollama' ? 'http://localhost:11434' : 'Base URL'}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            취소
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={addMutation.isPending}>
            {addMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            추가
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// LLM Playground (채팅 테스트)
function Playground({ keyId, providerType, selectedModel }: { keyId: number; providerType: string; selectedModel: string | null }) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [usedModel, setUsedModel] = useState('');

  const chatMutation = useMutation({
    mutationFn: (input: { id: number; prompt: string }) =>
      trpcClient.settings.providerKeys.chat.mutate(input),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
        setResponse('');
      } else {
        setResponse(data.response);
        setUsedModel(data.model);
      }
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '채팅 오류');
    },
  });

  const handleSend = () => {
    if (!prompt.trim()) return;
    setResponse('');
    chatMutation.mutate({ id: keyId, prompt: prompt.trim() });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MessageSquare className="h-3 w-3" />
        <span>모델: <strong className="text-foreground">{selectedModel || '기본값'}</strong></span>
      </div>
      <Textarea
        rows={3}
        placeholder="테스트 프롬프트를 입력하세요 (예: 안녕하세요, 어떤 모델이신가요?)"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="resize-none text-sm"
      />
      <Button
        size="sm"
        onClick={handleSend}
        disabled={chatMutation.isPending || !prompt.trim()}
        className="gap-1"
      >
        {chatMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Send className="h-3 w-3" />
        )}
        전송
      </Button>
      {response && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
          {usedModel && (
            <div className="mb-2 text-[10px] text-muted-foreground">
              응답 모델: {usedModel}
            </div>
          )}
          {response}
        </div>
      )}
    </div>
  );
}

// 수정 폼
function EditForm({
  item,
  onCancel,
  onSaved,
}: {
  item: ProviderKeyItem;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(item.baseUrl ?? '');

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof trpcClient.settings.providerKeys.update.mutate>[0]) =>
      trpcClient.settings.providerKeys.update.mutate(input),
    onSuccess: () => {
      toast.success('수정되었습니다');
      onSaved();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '수정에 실패했습니다');
    },
  });

  const handleSave = () => {
    const data: Parameters<typeof trpcClient.settings.providerKeys.update.mutate>[0] = { id: item.id };
    if (name.trim() !== item.name) data.name = name.trim();
    if (apiKey.trim()) data.key = apiKey.trim();
    if (baseUrl !== (item.baseUrl ?? '')) data.baseUrl = baseUrl.trim();
    updateMutation.mutate(data);
  };

  return (
    <div className="space-y-2 border-t pt-3 mt-3">
      <Input
        placeholder="이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="text-sm"
      />
      <Input
        type="password"
        placeholder="새 API 키 (변경하지 않으려면 비워두세요)"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        className="text-sm"
      />
      <Input
        placeholder="Base URL"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        className="text-sm"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          취소
        </Button>
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          저장
        </Button>
      </div>
    </div>
  );
}

// 단일 키 카드
function KeyCard({
  item,
  onDeleted,
  onUpdated,
}: {
  item: ProviderKeyItem;
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [showModels, setShowModels] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPlayground, setShowPlayground] = useState(false);
  const [customModel, setCustomModel] = useState('');

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      trpcClient.settings.providerKeys.delete.mutate({ id }),
    onSuccess: () => {
      toast.success('API 키가 삭제되었습니다');
      onDeleted();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '삭제에 실패했습니다');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: number; selectedModel?: string }) =>
      trpcClient.settings.providerKeys.update.mutate(input),
    onSuccess: () => {
      toast.success('모델이 선택되었습니다');
      onUpdated();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '업데이트에 실패했습니다');
    },
  });

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await trpcClient.settings.providerKeys.test.mutate({ id: item.id });
      if (result.success) {
        toast.success(`연결 성공! ${result.models.length}개 모델 발견`);
        setModels(result.models);
        setShowModels(true);
      } else {
        toast.error(result.error ?? '연결 테스트 실패');
      }
    } catch {
      toast.error('연결 테스트 중 오류 발생');
    } finally {
      setTesting(false);
    }
  };

  const handleModelSelect = (model: string | null) => {
    if (!model) return;
    updateMutation.mutate({ id: item.id, selectedModel: model });
    setShowModels(false);
  };

  const handleAddCustomModel = () => {
    const trimmed = customModel.trim();
    if (!trimmed) return;
    if (!models.includes(trimmed)) {
      setModels((prev) => [trimmed, ...prev]);
    }
    setCustomModel('');
    toast.success(`모델 "${trimmed}" 추가됨`);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ProviderBadge type={item.providerType} />
              {item.maskedKey && (
                <code className="text-xs text-muted-foreground">{item.maskedKey}</code>
              )}
            </div>
            {item.selectedModel && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="h-3 w-3 text-green-500" />
                <span>{item.selectedModel}</span>
              </div>
            )}
            {item.baseUrl && (
              <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                {item.baseUrl}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowPlayground(!showPlayground)}
              title="LLM 테스트"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleTest}
              disabled={testing}
              title="연결 테스트 & 모델 조회"
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TestTube className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setEditing(!editing)}
              title="수정"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm('이 API 키를 삭제하시겠습니까?')) {
                  deleteMutation.mutate(item.id);
                }
              }}
              disabled={deleteMutation.isPending}
              title="삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* 수정 폼 */}
        {editing && (
          <EditForm
            item={item}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              onUpdated();
            }}
          />
        )}

        {/* 모델 선택 (테스트 성공 후) */}
        {showModels && models.length > 0 && (
          <div className="mt-3 border-t pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              기본 모델을 선택하세요 ({models.length}개 발견):
            </p>
            <Select onValueChange={handleModelSelect}>
              <SelectTrigger className="w-full" size="sm">
                <SelectValue placeholder="모델 선택..." />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 모델 직접 추가 */}
            <div className="flex gap-2">
              <Input
                placeholder="모델명 직접 입력 (예: gpt-4o)"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomModel()}
                className="text-xs h-8"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1"
                onClick={handleAddCustomModel}
                disabled={!customModel.trim()}
              >
                <PlusCircle className="h-3 w-3" />
                추가
              </Button>
            </div>
          </div>
        )}

        {/* LLM 테스트 Playground */}
        {showPlayground && (
          <div className="mt-3 border-t pt-3">
            <Playground
              keyId={item.id}
              providerType={item.providerType}
              selectedModel={item.selectedModel}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 메인 컴포넌트
export function ProviderKeys() {
  const queryClient = useQueryClient();
  const [addingProvider, setAddingProvider] = useState<{
    type: string;
    name: string;
  } | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: [['settings', 'providerKeys', 'list']],
    queryFn: () => trpcClient.settings.providerKeys.list.query(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: [['settings', 'providerKeys', 'list']],
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        불러오는 중...
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[70vh]">
      <div className="space-y-4 pr-4">
        {/* 등록된 키 목록 */}
        {keys && keys.length > 0 && (
          <div className="space-y-2">
            {keys.map((item) => (
              <KeyCard
                key={item.id}
                item={item}
                onDeleted={invalidate}
                onUpdated={invalidate}
              />
            ))}
          </div>
        )}

        {/* 키가 없을 때 안내 */}
        {(!keys || keys.length === 0) && !addingProvider && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            등록된 API 키가 없습니다. 아래에서 프로바이더를 선택하세요.
          </div>
        )}

        {/* 추가 폼 or 프로바이더 선택 */}
        {addingProvider ? (
          <AddKeyForm
            providerType={addingProvider.type}
            providerName={addingProvider.name}
            onCancel={() => setAddingProvider(null)}
            onAdded={() => {
              setAddingProvider(null);
              invalidate();
            }}
          />
        ) : (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              프로바이더 선택
            </p>
            <ProviderGrid
              onSelect={(type, name) => setAddingProvider({ type, name })}
            />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
