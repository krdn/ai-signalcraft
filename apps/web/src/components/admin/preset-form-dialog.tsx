'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpcClient } from '@/lib/trpc';

// --- 상수 ---

const SOURCE_OPTIONS = [
  { key: 'naver', label: '네이버' },
  { key: 'youtube', label: '유튜브' },
  { key: 'dcinside', label: 'DC인사이드' },
  { key: 'fmkorea', label: 'FM코리아' },
  { key: 'clien', label: '클리앙' },
] as const;

const OPTIMIZATION_OPTIONS = [
  { value: 'none', label: '없음 (전체 데이터)' },
  { value: 'light', label: '가벼운 최적화' },
  { value: 'standard', label: '표준 최적화' },
  { value: 'aggressive', label: '공격적 최적화' },
] as const;

const ANALYSIS_MODULES = [
  { key: 'macroView', label: '거시 분석' },
  { key: 'segmentation', label: '세그먼트 분석' },
  { key: 'sentimentFraming', label: '감정/프레임 분석' },
  { key: 'messageImpact', label: '메시지 영향력' },
  { key: 'riskMap', label: '리스크 지도' },
  { key: 'opportunity', label: '기회 분석' },
  { key: 'strategy', label: '전략 도출' },
  { key: 'finalSummary', label: '최종 요약' },
  { key: 'approvalRating', label: '지지율 추정' },
  { key: 'frameWar', label: '프레임 전쟁' },
  { key: 'crisisScenario', label: '위기 시나리오' },
  { key: 'winSimulation', label: '승리 시뮬레이션' },
] as const;

const CATEGORY_OPTIONS = ['정치', '경제', '사회', '기술', '문화', '국제', '기타'] as const;

// --- 타입 ---

interface PresetEditData {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  highlight: string | null;
  sortOrder: number;
  sources: Record<string, boolean>;
  limits: {
    naverArticles: number;
    youtubeVideos: number;
    communityPosts: number;
    commentsPerItem: number;
  };
  optimization: string;
  skippedModules: string[];
  enableItemAnalysis: boolean;
  enabled: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData: PresetEditData | null;
}

// --- 기본값 ---

function getDefaults() {
  return {
    slug: '',
    title: '',
    description: '',
    category: '정치',
    icon: '📊',
    highlight: '',
    sortOrder: 0,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true } as Record<
      string,
      boolean
    >,
    limits: {
      naverArticles: 100,
      youtubeVideos: 30,
      communityPosts: 50,
      commentsPerItem: 100,
    },
    optimization: 'standard' as string,
    skippedModules: [] as string[],
    enableItemAnalysis: false,
  };
}

// --- 컴포넌트 ---

export function PresetFormDialog({ open, onOpenChange, editData }: Props) {
  const qc = useQueryClient();
  const isEdit = !!editData;

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('정치');
  const [icon, setIcon] = useState('📊');
  const [highlight, setHighlight] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [sources, setSources] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState(getDefaults().limits);
  const [optimization, setOptimization] = useState('standard');
  const [skippedModules, setSkippedModules] = useState<string[]>([]);
  const [enableItemAnalysis, setEnableItemAnalysis] = useState(false);

  // 다이얼로그 열림/닫힘 시 폼 상태 초기화 또는 편집 데이터 로드
  useEffect(() => {
    if (open) {
      if (editData) {
        setSlug(editData.slug);
        setTitle(editData.title);
        setDescription(editData.description);
        setCategory(editData.category);
        setIcon(editData.icon);
        setHighlight(editData.highlight ?? '');
        setSortOrder(editData.sortOrder);
        setSources(editData.sources);
        setLimits(editData.limits);
        setOptimization(editData.optimization);
        setSkippedModules(editData.skippedModules);
        setEnableItemAnalysis(editData.enableItemAnalysis);
      } else {
        const defaults = getDefaults();
        setSlug(defaults.slug);
        setTitle(defaults.title);
        setDescription(defaults.description);
        setCategory(defaults.category);
        setIcon(defaults.icon);
        setHighlight(defaults.highlight);
        setSortOrder(defaults.sortOrder);
        setSources(defaults.sources);
        setLimits(defaults.limits);
        setOptimization(defaults.optimization);
        setSkippedModules(defaults.skippedModules);
        setEnableItemAnalysis(defaults.enableItemAnalysis);
      }
    }
  }, [open, editData]);

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof trpcClient.admin.presets.create.mutate>[0]) =>
      trpcClient.admin.presets.create.mutate(data),
    onSuccess: () => {
      toast.success('프리셋이 추가되었습니다.');
      qc.invalidateQueries({ queryKey: ['admin', 'presets'] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof trpcClient.admin.presets.update.mutate>[0]) =>
      trpcClient.admin.presets.update.mutate(data),
    onSuccess: () => {
      toast.success('프리셋이 수정되었습니다.');
      qc.invalidateQueries({ queryKey: ['admin', 'presets'] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    const payload = {
      slug,
      title,
      description,
      category,
      icon,
      highlight: highlight || null,
      sortOrder,
      sources,
      limits,
      optimization: optimization as 'none' | 'light' | 'standard' | 'aggressive',
      skippedModules,
      enableItemAnalysis,
    };

    if (isEdit && editData) {
      updateMutation.mutate({ id: editData.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function toggleSource(key: string) {
    setSources((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleModule(key: string) {
    setSkippedModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  }

  const canSave =
    slug.trim().length > 0 && title.trim().length > 0 && description.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '프리셋 수정' : '프리셋 추가'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? '기존 프리셋의 설정을 수정합니다.'
              : '새 분석 프리셋을 생성합니다. 키워드 유형에 맞는 수집·분석 설정을 정의하세요.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* 기본 정보 */}
          <div className="grid gap-3">
            <div className="text-sm font-medium">기본 정보</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="preset-slug">슬러그 (slug)</Label>
                <Input
                  id="preset-slug"
                  placeholder="예: politics_general"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="preset-title">제목</Label>
                <Input
                  id="preset-title"
                  placeholder="예: 정치 일반"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="preset-description">설명</Label>
              <Textarea
                id="preset-description"
                placeholder="프리셋의 용도를 간략히 설명하세요"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="preset-category">카테고리</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="preset-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="preset-icon">아이콘</Label>
                <Input
                  id="preset-icon"
                  placeholder="📊"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="preset-sort-order">정렬 순서</Label>
                <Input
                  id="preset-sort-order"
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="preset-highlight">하이라이트 (선택)</Label>
              <Input
                id="preset-highlight"
                placeholder="예: 가장 많이 사용되는 프리셋"
                value={highlight}
                onChange={(e) => setHighlight(e.target.value)}
              />
            </div>
          </div>

          {/* 수집 소스 */}
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div className="text-sm font-medium">수집 소스</div>
            <div className="flex flex-wrap gap-4">
              {SOURCE_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={!!sources[key]} onCheckedChange={() => toggleSource(key)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* 수집 제한 */}
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div className="text-sm font-medium">수집 제한</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="limit-naver" className="text-xs">
                  네이버 기사 수
                </Label>
                <Input
                  id="limit-naver"
                  type="number"
                  min={10}
                  max={5000}
                  value={limits.naverArticles}
                  onChange={(e) =>
                    setLimits((prev) => ({ ...prev, naverArticles: Number(e.target.value) || 100 }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="limit-youtube" className="text-xs">
                  유튜브 영상 수
                </Label>
                <Input
                  id="limit-youtube"
                  type="number"
                  min={5}
                  max={500}
                  value={limits.youtubeVideos}
                  onChange={(e) =>
                    setLimits((prev) => ({ ...prev, youtubeVideos: Number(e.target.value) || 30 }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="limit-community" className="text-xs">
                  커뮤니티 게시글 수
                </Label>
                <Input
                  id="limit-community"
                  type="number"
                  min={5}
                  max={500}
                  value={limits.communityPosts}
                  onChange={(e) =>
                    setLimits((prev) => ({ ...prev, communityPosts: Number(e.target.value) || 50 }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="limit-comments" className="text-xs">
                  항목당 댓글 수
                </Label>
                <Input
                  id="limit-comments"
                  type="number"
                  min={10}
                  max={2000}
                  value={limits.commentsPerItem}
                  onChange={(e) =>
                    setLimits((prev) => ({
                      ...prev,
                      commentsPerItem: Number(e.target.value) || 100,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* 최적화 */}
          <div className="grid gap-1.5">
            <Label htmlFor="preset-optimization">최적화 수준</Label>
            <Select value={optimization} onValueChange={setOptimization}>
              <SelectTrigger id="preset-optimization">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPTIMIZATION_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 분석 모듈 */}
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div className="text-sm font-medium">분석 모듈</div>
            <p className="text-xs text-muted-foreground">체크 해제된 모듈은 분석 시 건너뜁니다.</p>
            <div className="grid grid-cols-2 gap-2">
              {ANALYSIS_MODULES.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={!skippedModules.includes(key)}
                    onCheckedChange={() => toggleModule(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* 개별 항목 분석 */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={enableItemAnalysis}
              onCheckedChange={(checked) => setEnableItemAnalysis(checked === true)}
            />
            개별 항목 분석 활성화 (enableItemAnalysis)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave || isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {isEdit ? '수정' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
