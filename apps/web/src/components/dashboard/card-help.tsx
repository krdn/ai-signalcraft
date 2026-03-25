'use client';

import { Info } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface CardHelpProps {
  title: string;
  description: string;
  details: readonly string[];
  source?: string; // 데이터 출처 모듈명
}

export function CardHelp({ title, description, details, source }: CardHelpProps) {
  return (
    <Popover>
      <PopoverTrigger
        className="rounded-full p-0.5 hover:bg-accent transition-colors"
        aria-label={`${title} 도움말`}
      >
        <Info className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm" side="top">
        <div className="space-y-2">
          <h4 className="font-semibold">{title}</h4>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {description}
          </p>
          <ul className="space-y-1">
            {details.map((detail, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                <span className="text-muted-foreground/60 shrink-0">•</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
          {source && (
            <p className="text-[10px] text-muted-foreground/60 border-t pt-1.5">
              데이터 출처: {source}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// 각 대시보드 카드의 도움말 상수
export const DASHBOARD_HELP = {
  sentiment: {
    title: '감성 비율',
    description: '수집된 기사/댓글의 전체 감정 톤을 긍정/부정/중립으로 분류한 비율입니다.',
    details: [
      '긍정: 호의적 표현, 지지, 칭찬, 기대감이 포함된 콘텐츠',
      '부정: 비판, 불만, 우려, 반대 의견이 포함된 콘텐츠',
      '중립: 사실 보도, 객관적 정보 전달, 특정 감정 없는 콘텐츠',
      '비율은 전체 수집 데이터의 AI 분석 결과 기반',
    ],
    source: '감정 프레이밍 모듈 (GPT-4o-mini)',
  },
  trend: {
    title: '시계열 트렌드',
    description: '날짜별 언급량과 감성 분포의 변화 추이를 보여줍니다. 여론의 흐름과 변곡점을 파악할 수 있습니다.',
    details: [
      '전체 언급: 해당 날짜에 수집된 전체 콘텐츠 수',
      '긍정/부정/중립: 각 감성별 추정 건수',
      '급격한 변화가 있는 날짜는 주요 이벤트 발생 시점',
      'AI가 수집 데이터를 분석하여 일별 감성 비율 추정',
    ],
    source: '거시 분석 모듈 (GPT-4o-mini)',
  },
  keywords: {
    title: '키워드 / 연관어',
    description: '수집 데이터에서 가장 많이 등장하는 키워드 TOP 20입니다. 글자 크기가 클수록 출현 빈도가 높습니다.',
    details: [
      '반복 등장하는 핵심 키워드를 AI가 추출',
      '각 키워드의 감성(긍정/부정/중립)도 함께 분류',
      '워드 클라우드에서 큰 글자일수록 자주 언급된 키워드',
      '여론의 핵심 관심사와 프레임을 파악하는 데 활용',
    ],
    source: '감정 프레이밍 모듈 (GPT-4o-mini)',
  },
  platform: {
    title: '소스별 감성 비교',
    description: '수집 플랫폼(네이버, 유튜브, 커뮤니티 등)별로 감성 분포가 어떻게 다른지 비교합니다.',
    details: [
      '플랫폼마다 사용자 성향이 달라 감성 분포가 상이',
      '네이버 뉴스: 기사 댓글 중심, 일반 대중 여론 반영',
      '유튜브: 영상 댓글 중심, 팬덤/안티 양극화 경향',
      '커뮤니티: 게시글+댓글, 특정 집단의 깊은 의견 반영',
      '볼륨(건수) 기반으로 감성을 추정 (AI 세그멘테이션)',
    ],
    source: '세그멘테이션 모듈 (GPT-4o-mini)',
  },
  risk: {
    title: '리스크 분석',
    description: '현재 여론에서 발견된 잠재적 위협 요인을 영향도/긴급도별로 정리합니다.',
    details: [
      'Critical/High: 즉시 대응이 필요한 고위험 리스크',
      'Medium: 모니터링하며 상황 변화에 대비할 리스크',
      'Low: 현재 영향은 적지만 장기적으로 관찰할 사항',
      '영향도 수치: 해당 리스크가 여론에 미치는 예상 파급력',
      '확산 확률: AI가 추정한 이슈 확산 가능성',
    ],
    source: '리스크 맵 모듈 (Claude Sonnet)',
  },
  opportunity: {
    title: '기회 분석',
    description: '여론 데이터에서 발견된 활용 가능한 긍정 요소와 전략적 기회입니다.',
    details: [
      'High: 즉시 활용 가능한 높은 확장성의 기회',
      'Medium: 적절한 전략으로 활용 가능한 기회',
      'Low: 장기적 관점에서 고려할 만한 기회',
      '각 기회에 대한 구체적 활용 추천 제공',
      '현재 활용도와 확장 가능성을 함께 평가',
    ],
    source: '기회 발굴 모듈 (Claude Sonnet)',
  },
} as const;
