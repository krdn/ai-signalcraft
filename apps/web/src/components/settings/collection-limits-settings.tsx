'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function CollectionLimitsSettings() {
  const queryClient = useQueryClient();

  const { data: limits, isLoading } = useQuery({
    queryKey: ['settings', 'collectionLimits'],
    queryFn: () => trpcClient.settings.collectionLimits.get.query(),
  });

  const [naverArticles, setNaverArticles] = useState(500);
  const [youtubeVideos, setYoutubeVideos] = useState(50);
  const [communityPosts, setCommunityPosts] = useState(50);
  const [commentsPerItem, setCommentsPerItem] = useState(500);

  useEffect(() => {
    if (limits) {
      setNaverArticles(limits.naverArticles);
      setYoutubeVideos(limits.youtubeVideos);
      setCommunityPosts(limits.communityPosts);
      setCommentsPerItem(limits.commentsPerItem);
    }
  }, [limits]);

  const updateMutation = useMutation({
    mutationFn: (input: {
      naverArticles?: number;
      youtubeVideos?: number;
      communityPosts?: number;
      commentsPerItem?: number;
    }) => trpcClient.settings.collectionLimits.update.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'collectionLimits'] });
      toast.success('수집 한도 기본값이 저장되었습니다');
    },
    onError: (err) => {
      toast.error(`저장 실패: ${err.message}`);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      naverArticles,
      youtubeVideos,
      communityPosts,
      commentsPerItem,
    });
  };

  const hasChanges =
    limits &&
    (naverArticles !== limits.naverArticles ||
      youtubeVideos !== limits.youtubeVideos ||
      communityPosts !== limits.communityPosts ||
      commentsPerItem !== limits.commentsPerItem);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        분석 실행 시 트리거 폼의 기본 수집 한도를 설정합니다. 개별 실행 시 변경할 수 있습니다.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sl-naver" className="text-sm">
            네이버 뉴스 (최대 기사수)
          </Label>
          <Input
            id="sl-naver"
            type="number"
            min={10}
            max={5000}
            step={10}
            value={naverArticles}
            onChange={(e) => setNaverArticles(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">10 ~ 5,000건</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sl-youtube" className="text-sm">
            유튜브 영상
          </Label>
          <Input
            id="sl-youtube"
            type="number"
            min={5}
            max={500}
            step={5}
            value={youtubeVideos}
            onChange={(e) => setYoutubeVideos(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">5 ~ 500건</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sl-community" className="text-sm">
            커뮤니티 게시글
          </Label>
          <Input
            id="sl-community"
            type="number"
            min={5}
            max={500}
            step={5}
            value={communityPosts}
            onChange={(e) => setCommunityPosts(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">5 ~ 500건</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sl-comments" className="text-sm">
            항목당 댓글
          </Label>
          <Input
            id="sl-comments"
            type="number"
            min={10}
            max={2000}
            step={10}
            value={commentsPerItem}
            onChange={(e) => setCommentsPerItem(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">10 ~ 2,000건</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending} size="sm">
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          저장
        </Button>
      </div>
    </div>
  );
}
