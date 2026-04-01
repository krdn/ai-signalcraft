'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface CardHelpProps {
  title: string;
  description: string;
  details: readonly string[];
  source?: string;
  howToRead?: readonly string[];
  tips?: readonly string[];
  relatedModules?: readonly string[];
  limitations?: readonly string[];
}

export function CardHelp({
  title,
  description,
  details,
  source,
  howToRead,
  tips,
  relatedModules,
  limitations,
}: CardHelpProps) {
  const [activeSection, setActiveSection] = useState<'info' | 'read' | 'tips'>('info');

  const hasTabs = !!(howToRead?.length || tips?.length);

  return (
    <Popover>
      <PopoverTrigger
        className="rounded-full p-0.5 hover:bg-accent transition-colors"
        aria-label={`${title} 도움말`}
      >
        <Info className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-96 text-sm p-0" side="top" align="end">
        <div className="p-3 pb-2">
          <h4 className="font-semibold text-sm">{title}</h4>
          <p className="text-muted-foreground text-xs leading-relaxed mt-1">{description}</p>
        </div>

        {/* 탭 네비게이션 */}
        {hasTabs && (
          <div className="flex border-b px-3">
            <button
              type="button"
              onClick={() => setActiveSection('info')}
              className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                activeSection === 'info'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              설명
            </button>
            {howToRead?.length && (
              <button
                type="button"
                onClick={() => setActiveSection('read')}
                className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                  activeSection === 'read'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                읽는 법
              </button>
            )}
            {tips?.length && (
              <button
                type="button"
                onClick={() => setActiveSection('tips')}
                className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                  activeSection === 'tips'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                활용 팁
              </button>
            )}
          </div>
        )}

        <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
          {/* 설명 탭 */}
          {activeSection === 'info' && (
            <>
              <ul className="space-y-1">
                {details.map((detail, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-muted-foreground/60 shrink-0">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
              {limitations?.length && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">유의사항</p>
                    <ul className="space-y-0.5">
                      {limitations.map((item, i) => (
                        <li key={i} className="text-[10px] text-muted-foreground/80 flex gap-1.5">
                          <span className="text-amber-500 shrink-0">!</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </>
          )}

          {/* 읽는 법 탭 */}
          {activeSection === 'read' && howToRead?.length && (
            <ul className="space-y-1.5">
              {howToRead.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <Badge
                    variant="outline"
                    className="shrink-0 h-4 w-4 justify-center p-0 text-[9px]"
                  >
                    {i + 1}
                  </Badge>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          {/* 활용 팁 탭 */}
          {activeSection === 'tips' && tips?.length && (
            <ul className="space-y-1.5">
              {tips.map((tip, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-primary shrink-0">→</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 하단: 데이터 출처 + 관련 모듈 */}
        <div className="border-t px-3 py-2 space-y-1">
          {source && <p className="text-[10px] text-muted-foreground/60">데이터 출처: {source}</p>}
          {relatedModules?.length && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground/60">관련:</span>
              {relatedModules.map((mod) => (
                <Badge key={mod} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                  {mod}
                </Badge>
              ))}
            </div>
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
    description:
      '수집된 기사/댓글의 전체 감정 톤을 긍정/부정/중립으로 분류한 비율입니다. 도넛 차트로 전체 여론의 감정 분포를 한눈에 파악할 수 있습니다.',
    details: [
      '긍정: 호의적 표현, 지지, 칭찬, 기대감이 포함된 콘텐츠',
      '부정: 비판, 불만, 우려, 반대 의견이 포함된 콘텐츠',
      '중립: 사실 보도, 객관적 정보 전달, 특정 감정 없는 콘텐츠',
      '비율은 전체 수집 데이터의 AI 분석 결과 기반',
      '도넛 중앙에 가장 높은 비율의 감성이 표시됨',
    ],
    howToRead: [
      '녹색 영역이 클수록 긍정 여론이 우세합니다',
      '빨간 영역이 30% 이상이면 부정 여론이 상당한 수준입니다',
      '중립이 50% 이상이면 여론이 아직 형성 중이거나 관심도가 낮을 수 있습니다',
      '긍정-부정 비율이 비슷하면 여론이 양극화되어 있을 가능성이 높습니다',
    ],
    tips: [
      '부정 비율이 높으면 아래 리스크 분석 카드를 함께 확인하세요',
      '시계열 트렌드와 함께 보면 감정 변화의 원인을 추적할 수 있습니다',
      '소스별 감성 비교와 교차 분석하면 어떤 플랫폼에서 부정 여론이 집중되는지 파악 가능',
      '비교 분석 기능으로 이전 분석과 감성 비율 변화를 추적하세요',
    ],
    limitations: [
      'AI 감정 분석은 100% 정확하지 않으며, 풍자나 반어법을 오분류할 수 있음',
      '수집 데이터 양이 적을 경우 비율의 대표성이 낮을 수 있음',
    ],
    source: '감정 프레이밍 모듈 (GPT-4o-mini)',
    relatedModules: ['시계열 트렌드', '소스별 감성 비교'],
  },
  trend: {
    title: '시계열 트렌드',
    description:
      '날짜별 언급량과 감성 분포의 변화 추이를 보여줍니다. 4개 라인(전체/긍정/부정/중립)으로 여론의 흐름과 변곡점을 시간축으로 파악할 수 있습니다.',
    details: [
      '전체 언급(파란색): 해당 날짜에 수집된 전체 콘텐츠 수',
      '긍정(초록색): 긍정 감정으로 분류된 콘텐츠 추정 건수',
      '부정(빨간색): 부정 감정으로 분류된 콘텐츠 추정 건수',
      '중립(회색): 중립으로 분류된 콘텐츠 추정 건수',
      '수직 점선 마커: AI가 감지한 주요 이벤트/변곡점 (마우스 오버로 설명 확인)',
    ],
    howToRead: [
      '전체 언급량의 급등: 특정 이벤트 발생으로 관심이 폭발적으로 증가한 시점',
      '부정 라인이 긍정 라인 위로 올라가는 시점이 위기의 시작점일 수 있음',
      '수직 마커가 있는 날짜는 여론 변화의 트리거 이벤트 — 클릭하면 상세 설명',
      '라인이 수렴하면 여론이 안정화되는 추세, 발산하면 양극화 진행',
      '기간 말미의 추세(상승/하강)가 현재 여론 방향을 나타냄',
    ],
    tips: [
      '급등/급락 지점의 날짜를 기자회견, 발언, 뉴스 보도 일정과 대조해보세요',
      '이벤트 중심 모드로 분석했다면 이벤트 날짜 전후의 변화가 핵심 인사이트',
      'AI 리포트의 "거시 분석" 섹션에서 트렌드 해석을 더 자세히 확인 가능',
      '비교 분석으로 이전 기간과 언급량 추이를 비교하면 성장/하락 추세 파악',
    ],
    limitations: [
      '일별 데이터이므로 시간 단위 변화는 반영되지 않음',
      '수집 한도(기사 1,000건 등)로 인해 실제 전체 언급량과 차이가 있을 수 있음',
    ],
    source: '거시 분석 모듈 (GPT-4o-mini)',
    relatedModules: ['감성 비율', 'KPI 카드'],
  },
  keywords: {
    title: '키워드 / 연관어',
    description:
      '수집 데이터에서 AI가 추출한 핵심 키워드 TOP 20을 워드 클라우드로 시각화합니다. 글자 크기와 굵기로 출현 빈도를 직관적으로 확인할 수 있습니다.',
    details: [
      '글자 크기: 출현 빈도에 비례 (14px~42px, 클수록 자주 언급)',
      '글자 굵기: 빈도 상위 50%는 Bold 처리',
      '색상: 5단계 Blue 그래디언트로 빈도 순위 표현',
      '각 키워드에는 감성(긍정/부정/중립) 태그가 함께 분류됨',
      'AI가 불용어(조사, 접속사 등)를 제거하고 의미 있는 단어만 추출',
    ],
    howToRead: [
      '가장 큰 키워드가 현재 여론의 핵심 관심사입니다',
      '부정 감성 키워드가 상위에 있으면 부정 여론의 주 원인을 나타냄',
      '예상치 못한 키워드가 상위에 있다면 새로운 이슈 등장의 신호일 수 있음',
      '관련 키워드끼리 묶어보면 여론의 주요 프레임을 파악할 수 있음',
    ],
    tips: [
      '상위 키워드를 기반으로 대응 메시지의 핵심 단어를 선정하세요',
      '부정 키워드와 연결된 맥락을 수집 데이터 탭에서 원문으로 확인해보세요',
      '시간 경과에 따른 키워드 변화는 비교 분석에서 확인 가능 (새로 등장/사라진 키워드)',
      'AI 리포트의 "메시지 임팩트" 섹션에서 키워드별 영향력 분석 확인',
    ],
    limitations: [
      '동음이의어(예: "사과"가 과일인지 사과인지) 구분이 제한적일 수 있음',
      '줄임말, 신조어는 AI가 인식하지 못할 수 있음',
    ],
    source: '감정 프레이밍 모듈 (GPT-4o-mini)',
    relatedModules: ['감성 비율', '리스크 분석'],
  },
  platform: {
    title: '소스별 감성 비교',
    description:
      '수집 플랫폼(네이버 뉴스, 유튜브, DC갤러리, 에펨코리아, 클리앙)별로 감성 분포를 스택형 막대 차트로 비교합니다. 플랫폼마다 여론 성향이 다르므로 교차 분석이 중요합니다.',
    details: [
      '각 막대의 길이: 해당 플랫폼에서 수집된 전체 볼륨(건수)',
      '초록색 영역: 긍정 감성 비율',
      '빨간색 영역: 부정 감성 비율',
      '회색 영역: 중립 감성 비율',
      '플랫폼마다 사용자 성향이 달라 감성 분포가 상이할 수 있음',
    ],
    howToRead: [
      '막대가 긴 플랫폼이 가장 많은 데이터가 수집된 곳 (대표성 높음)',
      '특정 플랫폼만 부정이 높으면 해당 플랫폼 사용자층의 반발을 의미',
      '모든 플랫폼에서 부정이 높으면 전방위적 여론 악화 신호',
      '네이버 뉴스는 일반 대중, 커뮤니티는 특정 집단 여론을 더 잘 반영',
      '유튜브는 팬덤/안티 양극화 경향이 있어 극단적 결과가 나올 수 있음',
    ],
    tips: [
      '부정 여론이 집중된 플랫폼을 우선 대응 채널로 설정하세요',
      '각 플랫폼별 주요 논점이 다를 수 있으므로 수집 데이터 탭에서 원문 비교 추천',
      '커뮤니티 여론이 뉴스 댓글로 확산되는 패턴을 주시하면 이슈 확산 예측 가능',
      '플랫폼별 타겟 메시지를 다르게 설정하는 전략적 판단에 활용',
    ],
    limitations: [
      '소스를 1~2개만 선택했다면 비교가 제한적임',
      '볼륨 기반 추정이므로 실제 감성 분포와 차이가 있을 수 있음',
      '특정 플랫폼의 수집량이 극히 적으면 통계적 의미가 낮음',
    ],
    source: '세그멘테이션 모듈 (GPT-4o-mini)',
    relatedModules: ['감성 비율', '시계열 트렌드'],
  },
  risk: {
    title: '리스크 분석',
    description:
      '현재 여론에서 AI가 식별한 잠재적 위협 요인을 긴급도(Critical/High/Medium/Low)별로 정렬하여 카드 형태로 표시합니다. 영향도 프로그레스 바와 확산 확률로 우선순위를 판단할 수 있습니다.',
    details: [
      'Critical (빨강): 즉시 대응 필요, 이미 확산 중이거나 큰 영향',
      'High (주황): 빠른 대응 권장, 확산 가능성이 높은 위험 요인',
      'Medium (파랑): 모니터링 필요, 상황 악화 시 대응 준비',
      'Low (초록): 현재 영향 적으나 장기적으로 관찰할 사항',
      '영향도 바: 해당 리스크가 여론에 미치는 예상 파급력 (0~100%)',
      '확산 확률: AI가 추정한 이슈 확산 가능성',
    ],
    howToRead: [
      'Critical/High 리스크가 있다면 최우선으로 확인하세요',
      '영향도가 높고 확산 확률도 높은 항목이 가장 위험합니다',
      '각 리스크의 트리거 조건(발생 조건)을 확인하여 선제 대응 가능',
      '리스크 개수 자체가 많다면 전반적 위기 국면일 수 있음',
      '시간이 지나면 리스크 구성이 바뀌므로 반복 분석으로 추적',
    ],
    tips: [
      'Critical 리스크는 즉시 팀에 공유하고 대응 회의를 소집하세요',
      '각 리스크의 설명에서 구체적 키워드를 파악하여 모니터링 알림 설정',
      'AI 리포트의 "위기 시나리오" 섹션에서 리스크별 대응 시나리오 확인',
      '기회 분석과 함께 보면 위기를 기회로 전환할 수 있는 포인트 발견 가능',
      '비교 분석으로 이전 분석 대비 리스크 변화를 추적하세요',
    ],
    limitations: [
      'AI 추정 기반이므로 실제 리스크의 심각도와 차이가 있을 수 있음',
      '수집되지 않은 플랫폼(비공개 커뮤니티, SNS DM 등)의 리스크는 반영되지 않음',
      '확산 확률은 과거 데이터 패턴 기반 추정이며, 외부 변수를 완전히 반영하지 못함',
    ],
    source: '리스크 맵 모듈 (Claude Sonnet)',
    relatedModules: ['기회 분석', '위기 시나리오(고급)'],
  },
  opportunity: {
    title: '기회 분석',
    description:
      '여론 데이터에서 AI가 발견한 활용 가능한 긍정 요소와 전략적 기회를 실현가능성(High/Medium/Low)별로 정렬합니다. 각 기회에 대한 구체적 활용 추천이 포함됩니다.',
    details: [
      'High (빨강): 즉시 활용 가능하고 확장성이 높은 기회',
      'Medium (파랑): 적절한 전략 수립 시 활용 가능한 기회',
      'Low (초록): 장기적 관점에서 잠재 가치가 있는 기회',
      '영향도 바: 해당 기회 활용 시 예상되는 여론 개선 효과',
      '각 카드에 구체적 활용 추천(recommendation)이 포함됨',
      '현재 활용도와 확장 가능성을 함께 평가한 결과',
    ],
    howToRead: [
      'High 등급 기회를 우선 확인하여 즉시 실행 계획을 수립하세요',
      '영향도가 높은 항목이 실행 시 가장 큰 효과를 기대할 수 있음',
      '추천 내용에 구체적 행동 지침이 포함되어 있으므로 실행 계획에 바로 활용',
      '현재 활용도가 낮고 확장성이 높은 항목이 가장 잠재력 있는 기회',
    ],
    tips: [
      'High 기회와 전략 제안(AI 리포트)을 결합하여 실행 계획을 구체화하세요',
      '리스크와 기회를 매칭하면 "위기를 기회로" 전환하는 전략 수립 가능',
      '기회에 언급된 긍정 키워드를 커뮤니케이션 메시지에 적극 활용',
      '반복 분석으로 기회가 지속되는지, 새로운 기회가 등장하는지 추적',
      '기회 분석은 전략 제안 모듈의 입력이 되므로, AI 리포트에서 종합 전략 확인',
    ],
    limitations: [
      'AI가 발견한 기회가 실제 실행 가능한지는 현장 판단이 필요',
      '경쟁 상대의 전략이나 외부 환경 변수는 반영되지 않음',
    ],
    source: '기회 발굴 모듈 (Claude Sonnet)',
    relatedModules: ['리스크 분석', '전략 제안(고급)'],
  },
  kpi: {
    title: 'KPI 지표 카드',
    description:
      '분석 결과의 핵심 지표 4가지를 숫자 한눈에 요약합니다. 총 수집량, 주요 감성, 핵심 키워드, 여론 방향을 빠르게 파악할 수 있습니다.',
    details: [
      '총 수집량: 분석 기간 동안 수집된 전체 기사+댓글 건수',
      '주요 감성: 전체 데이터에서 가장 비율이 높은 감정(긍정/부정/중립)',
      '핵심 키워드: 출현 빈도가 가장 높은 단일 키워드',
      '여론 방향: AI가 판단한 전체 여론의 방향(긍정적/부정적/혼합)',
    ],
    howToRead: [
      '수집량이 많을수록 분석 결과의 대표성과 신뢰도가 높음',
      '여론 방향이 "부정적"이면 리스크 카드를 우선 확인',
      '여론 방향이 "혼합"이면 양극화 가능성이 높으므로 세그멘테이션 확인',
      '핵심 키워드가 예상과 다르면 새로운 이슈의 등장 가능성',
    ],
    tips: [
      '비교 분석 활성화 시 이전 분석 대비 각 KPI의 변화량(↑↓)이 표시됨',
      '여론 방향과 감성 비율을 함께 보면 전체적인 상황을 빠르게 판단 가능',
    ],
    source: '거시 분석 + 감정 프레이밍 모듈',
    relatedModules: ['감성 비율', '시계열 트렌드'],
  },
  insight: {
    title: 'AI 핵심 인사이트',
    description:
      '모든 분석 모듈의 결과를 종합한 AI의 핵심 요약입니다. 한 줄 요약, 현재 상황 분석, 그리고 우선순위별 중요 조치 사항 3가지를 제공합니다.',
    details: [
      '한 줄 요약: 전체 여론 상황을 하나의 문장으로 압축',
      '현황: 현재 여론의 전반적 상태, 감정, 핵심 요인 분석',
      '중요 조치 3가지: 우선순위별 즉시 행동 사항과 예상 효과',
      '각 조치에는 실행 타임라인이 함께 제공됨',
    ],
    howToRead: [
      '한 줄 요약으로 전체 상황을 빠르게 파악하세요',
      '조치 사항의 우선순위 1번이 가장 시급한 행동입니다',
      '타임라인이 "즉시"인 항목은 24시간 내 실행 권장',
      '예상 효과(expectedImpact)로 투입 대비 효과를 판단할 수 있음',
    ],
    tips: [
      '이 요약을 팀 브리핑의 핵심 슬라이드로 활용하세요',
      '조치 사항을 실행한 후 반복 분석으로 효과를 추적',
      'AI 리포트에서 더 상세한 종합 분석을 확인할 수 있습니다',
    ],
    source: '종합 요약 모듈 (Claude Sonnet)',
    relatedModules: ['리스크 분석', '기회 분석', '전략 제안'],
  },
  compare: {
    title: '비교 분석',
    description:
      '두 시점의 분석 결과를 나란히 비교하여 여론의 변화를 정량적으로 파악합니다. KPI 변화량, 감성 비율 변화, 키워드 변화를 자동으로 계산합니다.',
    details: [
      'KPI 변화량: 4개 핵심 지표의 증감을 ↑↓ 화살표로 표시',
      '감성 비율 변화: 긍정/부정/중립 각각의 비율 변화',
      '키워드 변화: 새로 등장한 키워드와 사라진 키워드 식별',
      '과거 완료된 분석 중 비교 대상을 선택 (최근 10건)',
    ],
    howToRead: [
      '긍정 비율 ↑ + 부정 비율 ↓ = 여론 개선 추세',
      '새로 등장한 부정 키워드가 있다면 새로운 리스크의 신호',
      '사라진 키워드는 해당 이슈가 소멸되고 있다는 의미',
      '총 수집량 변화가 크면 관심도 자체가 변화하고 있음',
    ],
    tips: [
      '대응 전략 실행 전후를 비교하면 전략의 효과를 정량 측정 가능',
      '정기 분석(주간/격주)으로 여론 변화 추이를 모니터링하세요',
      '이벤트(기자회견 등) 전후를 비교하면 이벤트 영향력을 정확히 파악',
    ],
    source: '이전 분석 결과 자동 비교',
    relatedModules: ['KPI 카드', '감성 비율', '키워드'],
  },
} as const;
