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
  techNotes?: readonly string[];
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
  techNotes,
}: CardHelpProps) {
  const [activeSection, setActiveSection] = useState<'info' | 'read' | 'tips' | 'tech'>('info');

  const hasTabs = !!(howToRead?.length || tips?.length || techNotes?.length);

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
            {techNotes?.length && (
              <button
                type="button"
                onClick={() => setActiveSection('tech')}
                className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                  activeSection === 'tech'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                기술 정보
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

          {/* 기술 정보 탭 */}
          {activeSection === 'tech' && techNotes?.length && (
            <ul className="space-y-1.5">
              {techNotes.map((note, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-muted-foreground/60 shrink-0">▸</span>
                  <span>{note}</span>
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
      '5개 소스(네이버 뉴스, 유튜브, DC인사이드, 에펨코리아, 클리앙)별로 기사(포스트)와 댓글을 분리하여 긍정·부정·중립 감성 분포를 비교합니다. DB에 저장된 아이템별 실제 감성값을 집계하므로 AI 추정이 아닌 실측 데이터입니다. 같은 소스라도 기사 여론과 댓글 여론이 다를 수 있어 두 막대를 함께 보는 것이 핵심입니다.',
    details: [
      '각 소스마다 최대 2개 막대 — 왼쪽: 기사/포스트, 오른쪽: 댓글',
      '막대 높이(합계): 해당 소스에서 수집된 실제 건수 (AI 추정 아님)',
      '초록색(긍정): BERT 감성 분류기가 긍정으로 분류한 아이템 수',
      '빨간색(부정): BERT 감성 분류기가 부정으로 분류한 아이템 수',
      '회색(중립): 중립 또는 감성 판단이 어려운 아이템 수',
      'DC인사이드는 게시글만 수집(댓글 별도 없음) → 단일 막대로 표시',
      '유튜브는 댓글만 집계 (영상 자체는 별도 섹션에서 관리)',
      '플랫폼별 특성 — 네이버: 일반 대중·중장년 / 유튜브: 알고리즘 극단화 / DC: 20·30대 남성·풍자문화 / 에펨: 스포츠·IT / 클리앙: IT·진보 전문직',
    ],
    howToRead: [
      '같은 소스에서 기사 막대(좌)와 댓글 막대(우)의 색상 비율이 크게 다르면 — 미디어 보도와 실제 여론 사이에 괴리 존재',
      '댓글 막대가 훨씬 크고 부정 비율이 높음 → 기사는 중립적이나 독자 반응은 부정적인 "기사-댓글 괴리" 상황',
      '특정 소스만 부정 집중 → 해당 사용자층의 집중 반발, 타 소스 확산 여부 점검',
      '전 소스 부정 우세 → 전방위 여론 악화, 위기 대응 즉시 검토',
      '유튜브 긍정·부정 모두 높고 중립 낮음 → 팬덤/안티 양극화 에코챔버 형성',
      '커뮤니티(DC·에펨·클리앙) 부정 선행 → 이후 네이버 부정 증가 패턴 = 커뮤니티발 이슈 확산 신호',
    ],
    tips: [
      '댓글 부정이 기사 부정보다 훨씬 높은 소스 = 가장 빠르게 대응이 필요한 채널',
      '"수집 데이터" 탭에서 해당 소스의 원문을 직접 확인해 감성 분류의 맥락을 파악하세요',
      '볼륨이 적은 소스(막대가 짧음)는 표본이 적어 통계적 의미가 낮을 수 있습니다',
      '소스별 사용자층 성향을 감안한 메시지 차별화 전략에 활용하세요',
    ],
    limitations: [
      '감성 분류는 BERT 기반 자동 분류로, 풍자·반어 등 맥락적 표현에서 오류 가능',
      '수집량이 10건 미만인 소스는 감성 비율 신뢰도가 낮음',
      '분석 설정에서 제외된 소스는 막대가 표시되지 않음',
      '공개 페이지(쇼케이스 모드)에서는 이 차트가 표시되지 않을 수 있음',
    ],
    source: 'DB 실측 감성 컬럼 집계 (BERT 분류기 기반)',
    relatedModules: ['감성 비율', '집단별 반응 분석', '리스크 분석'],
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
  keywordNetwork: {
    title: '키워드 네트워크',
    description:
      '키워드 간의 동시출현 관계를 인터랙티브 Force-directed 그래프로 시각화합니다. 단순 빈도(워드 클라우드)를 넘어 "어떤 키워드가 함께 등장하는가"라는 구조적 관계를 파악할 수 있어, 여론의 프레임과 핵심 논리 구조를 발견하는 데 유용합니다.',
    details: [
      '노드(원): 각 키워드를 표시 — 크기는 출현 빈도에 비례 (6~32px 정규화)',
      '노드 색상: 초록=긍정 키워드, 빨강=부정 키워드, 회색=중립/연관어',
      '선(엣지): 두 키워드가 동일한 댓글/기사에 함께 등장하는 동시출현 관계',
      '선 굵기: coOccurrenceScore (0~1) — 높을수록 두 키워드가 밀접하게 연결',
      '연결선 없는 노드: AI가 단독 이슈로 판단했거나, 다른 키워드와 동시출현 빈도가 낮은 경우',
    ],
    howToRead: [
      '허브 키워드 찾기: 가장 많은 선이 연결된 노드가 여론의 "중심 프레임"을 구성하는 핵심어입니다',
      '군집(클러스터) 파악: 선으로 묶인 키워드 그룹은 함께 논의되는 하나의 내러티브를 형성합니다',
      '색상 군집 분석: 빨강 노드끼리 강하게 연결되면 부정 여론의 공격 논리가 구조화된 것 — 대응 우선순위가 높습니다',
      '긍·부정 연결: 초록-빨강이 교차 연결된 경우 같은 사건을 두고 프레임 충돌이 일어나는 지점입니다',
      '고립 노드: 연결선 없이 떠 있는 키워드는 독립 이슈이거나 소수 여론의 주변적 언급입니다',
    ],
    tips: [
      '드래그: 노드를 끌어 배치를 재정렬 — 복잡한 연결을 분리해서 분석할 수 있습니다',
      '스크롤(휠): 확대/축소로 세부 관계와 라벨을 명확하게 확인하세요',
      '허브 키워드를 먼저 파악한 뒤, 그 키워드와 연결된 부정어 제거 전략을 수립하면 효과적입니다',
      '워드 클라우드(빈도)와 함께 보면 "자주 언급되지만 고립된" vs "덜 언급되지만 핵심 연결고리인" 키워드를 구별할 수 있습니다',
      '연결선이 없을 때: AI 모델을 Gemini 2.5 Pro 또는 Claude Sonnet으로 변경하면 연관어 추출 품질이 높아집니다',
    ],
    limitations: [
      '연관어(relatedKeywords)가 비어있으면 노드만 표시되고 연결선이 나타나지 않습니다',
      '연결선 생성 품질은 AI 모델 성능에 크게 의존합니다 — 저비용 모델(Flash Lite 등)은 연관어를 생략하는 경향이 있습니다',
      '입력 데이터가 매우 적은 경우(기사+댓글 합계 50건 미만) 연관어 추출 정확도가 낮을 수 있습니다',
    ],
    techNotes: [
      '데이터 출처: sentiment-framing 모듈의 topKeywords(노드) + relatedKeywords(엣지)',
      '렌더링: D3.js v7 Force-directed simulation — charge, center, collision, x/y 보조력 조합',
      '노드 크기: d3.scaleSqrt() — count 값을 실제 픽셀 반지름 6~32px로 정규화',
      '추천 AI 모델(연결선 품질 기준): ① Claude Sonnet 4.6 (최고 품질) ② Gemini 2.5 Pro (무료/CLI) ③ Gemini 2.5 Flash (기본) — Flash Lite는 연관어 생략 빈번',
      '스키마 검증: relatedKeywords min(1) 강제 — AI가 빈 배열 반환 시 자동 재시도',
    ],
    source: '감정 프레이밍 모듈 (sentiment-framing) — topKeywords + relatedKeywords',
    relatedModules: ['키워드 / 워드 클라우드', '감성 프레임 분석', '프레임 전쟁(고급)'],
  },
  semanticSearch: {
    title: '의미 검색',
    description:
      '자연어 질의로 수집된 기사와 댓글을 의미적으로 검색합니다. 키워드가 정확히 일치하지 않아도 관련 문서를 찾을 수 있어, 수집 데이터의 심층 탐색에 유용합니다.',
    details: [
      'pgvector 임베딩 기반 의미 검색 — 키워드가 아닌 "의미"로 검색',
      '"물가상승" 검색 시 "인플레이션", "생활고" 관련 문서도 함께 검색됨',
      '각 결과에 유사도 점수(%)가 표시되어 관련성 정도를 확인 가능',
      '기사(파란 아이콘)와 댓글(주황 아이콘)을 통합 검색',
    ],
    howToRead: [
      '유사도 80%+: 질의와 거의 동일한 의미의 문서',
      '유사도 60~80%: 관련성이 높은 문서',
      '유사도 60% 미만: 약한 관련성 — 참고용으로 활용',
      '검색 결과가 없으면 다른 표현으로 다시 시도해 보세요',
    ],
    tips: [
      '특정 관점의 의견만 보려면 감정 필터(긍정/부정/중립)를 활용하세요',
      'AI 리포트에서 언급된 키워드를 그대로 검색어로 사용하면 관련 원문을 바로 확인 가능',
      '"~에 대한 비판적 의견", "~의 긍정적 반응" 같은 문장 형태로 검색해 보세요',
    ],
    limitations: [
      '임베딩이 생성되지 않은 문서는 검색되지 않습니다 (최초 분석 후 사용 가능)',
      '매우 짧은 댓글(1~2단어)은 임베딩 품질이 낮을 수 있습니다',
    ],
    techNotes: [
      '임베딩 모델: multilingual-e5-small (384차원 벡터) — ONNX Runtime으로 서버 사이드 추론',
      '저장: articles.embedding / comments.embedding 컬럼 (PostgreSQL pgvector 확장, vector(384) 타입)',
      '검색 방식: 질의 텍스트 → embedTexts() 임베딩 → pgvector 코사인 거리(<=> 연산자)로 유사도 정렬',
      '유사도 계산: 1 - (embedding <=> query_vector) = 코사인 유사도 (0~1 범위)',
      '임베딩 생성 시점: 분석 파이프라인 실행 시 embedding-persist.ts에서 배치 생성 + backfill 스크립트로 기존 데이터 보완',
      '파이프라인 흐름: 검색어 입력 → tRPC search.semantic → semanticSearch() → embedTexts([query]) → pgvector SQL → 유사도 필터링(기본 0.4) → topK 반환',
      '소스 코드: packages/core/src/search/semantic-search.ts (검색 로직), packages/core/src/analysis/preprocessing/embeddings.ts (임베딩 생성)',
      '업그레이드 가이드: 임베딩 모델 변경 시 vector(384)→새 차원수로 마이그레이션 + 전체 backfill 재실행 필요',
    ],
    source: 'pgvector 임베딩 (multilingual-e5-small, 384차원)',
    relatedModules: ['키워드 / 연관어', '수집 데이터'],
  },
  knowledgeGraph: {
    title: '지식 그래프',
    description:
      '분석 결과에서 AI가 추출한 핵심 엔티티(인물/조직/이슈/키워드/프레임/주장)와 그들 간의 관계를 인터랙티브 네트워크 그래프로 시각화합니다. 여론의 구조적 관계를 한눈에 파악할 수 있습니다.',
    details: [
      '보라색 노드: 인물 엔티티',
      '파란색 노드: 조직/집단 엔티티',
      '빨간색 노드: 이슈/리스크 엔티티',
      '초록색 노드: 키워드 엔티티',
      '노란색 노드: 프레임 엔티티',
      '하늘색 노드: 주장/메시지 엔티티',
      '실선: 위협/대립/연쇄 관계, 점선: 동시출현/연관 관계',
    ],
    howToRead: [
      '노드가 클수록 더 자주 언급된 엔티티입니다',
      '여러 선이 연결된 노드가 여론의 핵심 허브입니다',
      '빨간 선(위협/대립)으로 연결된 프레임은 충돌 관계를 나타냅니다',
      '엔티티 타입 필터(Badge)를 클릭하여 관심 유형만 표시할 수 있습니다',
      '노드를 클릭하면 상세 정보(설명, 언급 횟수)를 확인할 수 있습니다',
    ],
    tips: [
      '핵심 허브 엔티티를 중심으로 커뮤니케이션 전략을 수립하세요',
      '위협 관계(빨간 선)로 연결된 엔티티 간의 충돌 구조를 파악하면 대응 우선순위를 결정할 수 있습니다',
      '동시출현(점선)으로 묶인 키워드 그룹은 하나의 프레임으로 인식되고 있음을 의미합니다',
    ],
    limitations: [
      '엔티티는 분석 모듈의 구조화된 결과에서 자동 추출하므로, 모듈이 감지하지 못한 엔티티는 누락될 수 있습니다',
      '동의어(예: "이재명"과 "이 대표")가 별개 노드로 표시될 수 있습니다',
    ],
    source: '온톨로지 추출 (분석 모듈 결과 자동 매핑)',
    relatedModules: ['키워드 네트워크', '프레임 전쟁(고급)', '리스크 분석'],
  },
} as const;
