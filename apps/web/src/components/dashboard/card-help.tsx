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
      '수집된 기사/댓글의 전체 감정 톤을 긍정/부정/중립으로 분류한 비율입니다. 도넛 차트로 여론의 감정 분포를 한눈에 파악하고, 전체 온라인 여론의 "온도"를 측정합니다.',
    details: [
      '긍정: 호의적 표현, 지지, 칭찬, 기대감이 포함된 콘텐츠',
      '부정: 비판, 불만, 우려, 반대 의견이 포함된 콘텐츠',
      '중립: 사실 보도, 객관적 정보 전달, 특정 감정 없는 콘텐츠',
      '비율은 전체 수집 데이터의 AI 분석 결과 기반 (실측 아님)',
      '도넛 중앙에 가장 높은 비율의 감성과 퍼센트가 표시됨',
      '툴팁: 각 영역 호버 시 정확한 비율(%) 확인 가능',
    ],
    howToRead: [
      '녹색 영역이 클수록 긍정 여론이 우세 — 메시지 전략이 효과적이거나 이슈가 없는 상태',
      '빨간 영역이 30% 이상이면 부정 여론이 상당한 수준 — 리스크 카드 즉시 확인',
      '중립이 50% 이상이면 여론이 아직 형성 중이거나 대중 관심도가 낮은 상태',
      '긍정-부정 비율이 비슷하면(30~40%대 분포) 여론 양극화 가능성 높음 — 세그멘테이션 확인',
    ],
    tips: [
      '부정 비율이 높으면 아래 리스크 분석 카드를 우선 확인하세요',
      '시계열 트렌드와 함께 보면 어느 시점부터 감성이 바뀌었는지 추적 가능',
      '소스별 감성 비교와 교차 분석하면 어떤 플랫폼에서 부정 여론이 집중되는지 특정 가능',
      '비교 분석으로 이전 분석 대비 감성 비율 변화를 추적해 전략 효과를 측정하세요',
    ],
    limitations: [
      'AI 감정 분석은 100% 정확하지 않으며, 풍자·반어법·중의적 표현을 오분류할 수 있음',
      '수집 데이터 양이 100건 미만이면 비율의 대표성이 크게 낮아질 수 있음',
      '감성은 분석 시점의 수집 데이터 기준 — 최신 여론 반영을 위해 재분석 필요',
    ],
    techNotes: [
      '데이터 출처: sentiment-framing 모듈의 sentimentRatio 필드',
      '추천 AI 모델: ① Claude Sonnet 4.6 (문맥 이해 최고) ② Gemini 2.5 Pro ③ Gemini 2.5 Flash — Flash Lite는 감성 분류 정확도 저하 가능',
    ],
    source: '감정 프레이밍 모듈 (sentiment-framing)',
    relatedModules: ['시계열 트렌드', '소스별 감성 비교', '키워드 네트워크'],
  },
  trend: {
    title: '시계열 트렌드',
    description:
      'AI가 분석 기간 내 날짜별 언급량과 감성 분포 변화를 추정하여 시각화합니다. 전체/긍정/부정/중립 4개 라인으로 여론의 흐름과 변곡점을 시간축으로 파악할 수 있습니다.',
    details: [
      '전체 언급(파란색): 해당 날짜에 언급된 전체 콘텐츠 추정 건수',
      '긍정(초록색): 긍정 감정으로 분류된 콘텐츠 추정 건수',
      '부정(빨간색): 부정 감정으로 분류된 콘텐츠 추정 건수',
      '중립(회색): 중립으로 분류된 콘텐츠 추정 건수',
      '수직 점선 마커: AI가 감지한 주요 이벤트/변곡점 (마우스 오버로 설명 확인)',
      'X축: YYYY-MM-DD → MM-DD로 축약 표시, Y축: 건수',
    ],
    howToRead: [
      '전체 언급량 급등: 특정 이벤트 발생으로 관심이 폭발적으로 증가한 시점',
      '부정 라인이 긍정 라인 위로 올라가는 교차점 = 위기의 시작 신호',
      '수직 마커 날짜는 AI가 식별한 여론 변화 트리거 — 마커 위 라벨로 이벤트 내용 확인',
      '라인들이 수렴하면 여론 안정화 추세, 발산하면 양극화 진행 중',
      '기간 말미의 추세(상승/하강)가 현재 여론의 방향성을 나타냄',
    ],
    tips: [
      '급등/급락 날짜를 기자회견, 발언, 보도 일정과 대조하면 인과관계 파악 가능',
      'AI 리포트의 "거시 분석" 섹션에서 각 변곡점의 상세 해석을 확인하세요',
      '비교 분석으로 이전 기간 언급량 추이를 비교하면 성장/하락 추세 파악',
      '데이터 없음이 표시될 때: AI 모델을 Gemini 2.5 Pro 또는 Claude Sonnet으로 변경하면 날짜별 집계 품질이 향상됩니다',
    ],
    limitations: [
      '실측 데이터가 아닌 AI 추정값 — 실제 포털 트렌드 지수와 차이가 있을 수 있음',
      '수집 한도(기사 상위 N건)로 인해 실제 전체 언급량과 차이 발생 가능',
      '일별 데이터이므로 같은 날 내 시간대별 변화는 반영되지 않음',
      '저비용 모델(Flash Lite, GPT-4.1 Nano 등)은 날짜 집계를 생략하고 빈 배열을 반환하는 경향 있음',
    ],
    techNotes: [
      '데이터 출처: macro-view 모듈의 dailyMentionTrend 배열',
      '추천 AI 모델(날짜 집계 정확도 기준): ① Gemini 2.5 Pro (날짜 스캔 가장 정확) ② Claude Sonnet 4.6 ③ Gemini 2.5 Flash — Flash Lite/GPT-4.1 Nano는 빈 배열 반환 빈번',
      '변곡점 마커: macro-view 모듈의 inflectionPoints 배열에서 생성',
    ],
    source: '거시 분석 모듈 (macro-view)',
    relatedModules: ['감성 비율', 'KPI 카드', '거시 분석(AI 리포트)'],
  },
  keywords: {
    title: '키워드 / 연관어',
    description:
      '수집 데이터에서 AI가 추출한 핵심 키워드 TOP 20을 워드 클라우드로 시각화합니다. 글자 크기와 굵기로 출현 빈도를 직관적으로 확인하고, 색상으로 감성을 구분할 수 있습니다.',
    details: [
      '글자 크기: 출현 빈도에 비례 (14px~42px, 클수록 자주 언급)',
      '글자 굵기: 빈도 상위 50%는 Bold 처리로 시각적 강조',
      '색상: 5단계 Blue 그래디언트로 빈도 순위 표현 (진할수록 상위)',
      '각 키워드에는 감성(긍정/부정/중립) 태그가 함께 분류됨',
      'AI가 불용어(조사, 접속사, 대명사 등)를 제거하고 의미 있는 단어만 추출',
    ],
    howToRead: [
      '가장 큰 키워드가 현재 여론의 핵심 관심사',
      '부정 감성 키워드가 상위에 있으면 부정 여론의 주 원인어',
      '예상치 못한 키워드가 상위에 있다면 새로운 이슈 등장 신호',
      '관련 키워드끼리 묶어 보면 여론의 주요 프레임을 파악 가능',
    ],
    tips: [
      '상위 키워드를 기반으로 대응 메시지의 핵심 단어를 선정하세요',
      '부정 키워드와 연결된 맥락을 수집 데이터 탭에서 원문으로 확인해보세요',
      '키워드 네트워크와 함께 보면 키워드 간의 구조적 연결 관계까지 파악 가능',
      '비교 분석으로 새로 등장하거나 사라진 키워드를 추적하면 이슈 변화 감지',
    ],
    limitations: [
      '동음이의어(예: "사과"가 과일인지 사과 행위인지) 구분이 제한적일 수 있음',
      '신조어·줄임말·해시태그는 AI가 인식하지 못할 수 있음',
      '최대 20개 키워드만 표시되므로 긴 꼬리(long-tail) 키워드는 누락됨',
    ],
    techNotes: [
      '데이터 출처: sentiment-framing 모듈의 topKeywords 배열 (최대 20개)',
      '추천 AI 모델: ① Claude Sonnet 4.6 (키워드 맥락 분류 정확) ② Gemini 2.5 Pro ③ Gemini 2.5 Flash',
    ],
    source: '감정 프레이밍 모듈 (sentiment-framing)',
    relatedModules: ['키워드 네트워크', '감성 비율', '리스크 분석'],
  },
  platform: {
    title: '소스별 감성 비교',
    description:
      '5개 소스(네이버 뉴스, 유튜브, DC인사이드, 에펨코리아, 클리앙)별로 기사(포스트)와 댓글을 분리하여 긍정·부정·중립 감성 분포를 비교합니다. DB에 저장된 아이템별 실제 감성값을 집계하므로 AI 추정이 아닌 실측 데이터입니다.',
    details: [
      '각 소스마다 최대 2개 막대 — 왼쪽: 기사/포스트, 오른쪽: 댓글',
      '막대 높이(합계): 해당 소스에서 수집된 실제 건수 (AI 추정 아님)',
      '초록색(긍정): 감성 분류기가 긍정으로 분류한 아이템 수',
      '빨간색(부정): 감성 분류기가 부정으로 분류한 아이템 수',
      '회색(중립): 중립 또는 감성 판단이 어려운 아이템 수',
      'DC인사이드는 게시글만 수집(댓글 별도 없음) → 단일 막대 표시',
      '유튜브는 댓글만 집계 (영상 자체는 별도 섹션에서 관리)',
      '플랫폼 성향 — 네이버: 일반 대중·중장년 / 유튜브: 알고리즘 극단화 / DC: 20·30대 남성·풍자문화 / 에펨: 스포츠·IT / 클리앙: IT·진보 전문직',
    ],
    howToRead: [
      '같은 소스에서 기사 막대(좌)와 댓글 막대(우)의 색상 비율이 크게 다르면 — 미디어 보도와 실제 여론 사이에 괴리 존재',
      '댓글 막대가 훨씬 크고 부정 비율이 높음 → "기사는 중립, 독자는 분노"인 기사-댓글 괴리 상황',
      '특정 소스만 부정 집중 → 해당 사용자층의 집중 반발, 타 소스 확산 여부 점검',
      '전 소스 부정 우세 → 전방위 여론 악화, 위기 대응 즉시 검토',
      '커뮤니티(DC·에펨·클리앙) 부정 선행 → 이후 네이버 부정 증가 패턴 = 커뮤니티발 이슈 확산 신호',
    ],
    tips: [
      '댓글 부정이 기사 부정보다 훨씬 높은 소스 = 가장 빠르게 대응이 필요한 채널',
      '"수집 데이터" 탭에서 해당 소스의 원문을 직접 확인해 감성 분류 맥락을 파악하세요',
      '볼륨이 적은 소스(막대가 짧음)는 표본이 적어 통계적 의미가 낮습니다',
      '소스별 사용자층 성향을 감안한 채널 맞춤 메시지 전략에 활용하세요',
    ],
    limitations: [
      '감성 분류는 BERT 기반 자동 분류로, 풍자·반어 등 맥락적 표현에서 오류 가능',
      '수집량이 10건 미만인 소스는 감성 비율 신뢰도가 낮음',
      '분석 설정에서 제외된 소스는 막대가 표시되지 않음',
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
      '확산 확률: AI가 추정한 이슈 확산 가능성 (0~100%)',
      '트리거 조건: 리스크가 실제로 발화하는 시나리오 조건 목록',
    ],
    howToRead: [
      'Critical/High 리스크가 있다면 최우선으로 확인하세요',
      '영향도(파급력)가 높고 확산 확률도 높은 항목이 가장 위험한 리스크',
      '트리거 조건을 사전에 파악해 조건이 충족되기 전 선제 대응 가능',
      '리스크 개수 자체가 5개 이상이면 전반적 위기 국면일 수 있음',
      '반복 분석으로 리스크 구성 변화를 추적하면 이슈 소멸/등장 감지 가능',
    ],
    tips: [
      'Critical 리스크는 즉시 팀에 공유하고 대응 회의를 소집하세요',
      '각 리스크의 설명에서 구체적 키워드를 파악하여 실시간 모니터링 알림 설정',
      'AI 리포트의 "위기 시나리오" 섹션에서 리스크별 상세 대응 시나리오 확인',
      '기회 분석과 함께 보면 위기를 기회로 전환할 수 있는 전환점 발견 가능',
    ],
    limitations: [
      'AI 추정 기반이므로 실제 리스크의 심각도와 차이가 있을 수 있음',
      '수집되지 않은 플랫폼(비공개 커뮤니티, SNS DM 등)의 리스크는 반영되지 않음',
      '확산 확률은 텍스트 패턴 기반 추정이며, 외부 정치·경제 변수를 완전히 반영하지 못함',
    ],
    techNotes: [
      '데이터 출처: risk-map 모듈의 topRisks 배열',
      '추천 AI 모델: ① Claude Sonnet 4.6 (리스크 구조화 가장 정교) ② Claude Opus 4.6 (최고 품질, 비용 높음) ③ Gemini 2.5 Pro — Haiku/Flash는 리스크 판단 깊이 부족',
    ],
    source: '리스크 맵 모듈 (risk-map)',
    relatedModules: ['기회 분석', '위기 시나리오(고급)', '프레임 전쟁(고급)'],
  },
  opportunity: {
    title: '기회 분석',
    description:
      '여론 데이터에서 AI가 발견한 활용 가능한 긍정 요소와 전략적 기회를 실현가능성(High/Medium/Low)별로 정렬합니다. 각 기회에 대한 구체적 활용 추천이 포함됩니다.',
    details: [
      'High (빨강): 즉시 활용 가능하고 확장성이 높은 기회',
      'Medium (파랑): 적절한 전략 수립 시 활용 가능한 기회',
      'Low (초록): 장기적 관점에서 잠재 가치가 있는 기회',
      '영향도 바: 해당 기회 활용 시 예상되는 여론 개선 효과 (0~100%)',
      '각 카드에 구체적 활용 추천(recommendation)이 포함됨',
      '현재 활용도와 확장 가능성을 함께 평가한 결과',
    ],
    howToRead: [
      'High 등급 기회를 우선 확인하여 즉시 실행 계획을 수립하세요',
      '영향도가 높은 항목이 실행 시 가장 큰 여론 개선 효과를 기대할 수 있음',
      '추천 내용에 구체적 행동 지침이 포함되어 있으므로 실행 계획에 바로 활용',
      '현재 활용도가 낮고 확장성이 높은 항목 = 숨겨진 고잠재력 기회',
    ],
    tips: [
      'High 기회와 전략 제안(AI 리포트)을 결합하여 실행 계획을 구체화하세요',
      '리스크와 기회를 매칭하면 "위기를 기회로" 전환하는 전략 수립 가능',
      '기회에 언급된 긍정 키워드를 커뮤니케이션 메시지에 적극 활용',
      '반복 분석으로 기회가 지속되는지, 새로운 기회가 등장하는지 추적',
    ],
    limitations: [
      'AI가 발견한 기회가 실제 실행 가능한지는 현장 판단이 필요',
      '경쟁 상대의 전략이나 외부 환경 변수는 반영되지 않음',
    ],
    techNotes: [
      '데이터 출처: opportunity 모듈의 untappedAreas 배열',
      '추천 AI 모델: ① Claude Sonnet 4.6 ② Claude Opus 4.6 (고품질 기회 발굴) ③ Gemini 2.5 Pro — Haiku/Flash는 기회 발굴 창의성 부족',
    ],
    source: '기회 발굴 모듈 (opportunity)',
    relatedModules: ['리스크 분석', '전략 제안(고급)', 'AI 핵심 인사이트'],
  },
  kpi: {
    title: 'KPI 지표 카드',
    description:
      '분석 결과의 핵심 지표 4가지를 한눈에 요약합니다. 총 수집량, 주요 감성, 핵심 키워드, 여론 방향을 빠르게 파악하여 현재 상황을 즉시 진단할 수 있습니다.',
    details: [
      '총 수집량: 시계열 트렌드 기반 분석 기간 전체 언급 추정 건수',
      '주요 감성: 전체 데이터에서 가장 비율이 높은 감정(긍정/부정/중립)',
      '핵심 키워드: 출현 빈도가 가장 높은 단일 키워드',
      '여론 방향: AI가 판단한 전체 여론의 방향(긍정적/부정적/혼합)',
    ],
    howToRead: [
      '수집량이 많을수록 분석 결과의 대표성과 신뢰도가 높음',
      '여론 방향이 "부정적"이면 리스크 카드를 우선 확인',
      '여론 방향이 "혼합(mixed)"이면 양극화 가능성 높음 — 세그멘테이션 확인',
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
      '각 조치에는 실행 타임라인(즉시/단기/중기)이 함께 제공됨',
    ],
    howToRead: [
      '한 줄 요약으로 전체 상황을 빠르게 파악하세요',
      '조치 사항의 우선순위 1번이 가장 시급한 행동',
      '타임라인이 "즉시"인 항목은 24시간 내 실행 권장',
      '예상 효과(expectedImpact)로 투입 대비 효과를 사전 판단 가능',
    ],
    tips: [
      '이 요약을 팀 브리핑의 핵심 슬라이드로 활용하세요',
      '조치 사항을 실행한 후 반복 분석으로 여론 변화 효과를 추적',
      'AI 리포트에서 더 상세한 종합 분석(전략/시뮬레이션)을 확인할 수 있습니다',
    ],
    techNotes: [
      '데이터 출처: final-summary 모듈의 executiveSummary + priorityActions',
      '추천 AI 모델: ① Claude Opus 4.6 (종합 판단 최고 품질) ② Claude Sonnet 4.6 (품질-비용 균형) ③ Gemini 2.5 Pro — 종합 요약은 고성능 모델 사용 권장',
    ],
    source: '종합 요약 모듈 (final-summary)',
    relatedModules: ['리스크 분석', '기회 분석', '전략 제안(고급)'],
  },
  compare: {
    title: '비교 분석',
    description:
      '두 시점의 분석 결과를 나란히 비교하여 여론의 변화를 정량적으로 파악합니다. KPI 변화량, 감성 비율 변화, 키워드 변화를 자동으로 계산하여 전략 효과 측정에 활용할 수 있습니다.',
    details: [
      'KPI 변화량: 4개 핵심 지표의 증감을 ↑↓ 화살표로 표시',
      '감성 비율 변화: 긍정/부정/중립 각각의 비율 포인트(%p) 변화',
      '키워드 변화: 새로 등장한 키워드와 사라진 키워드 식별',
      '과거 완료된 분석 중 비교 대상을 선택 (최근 10건)',
    ],
    howToRead: [
      '긍정 비율 ↑ + 부정 비율 ↓ = 여론 개선 추세',
      '새로 등장한 부정 키워드가 있다면 새로운 리스크 발생 신호',
      '사라진 키워드는 해당 이슈가 소멸되거나 관심이 줄고 있다는 의미',
      '총 수집량 변화가 크면 해당 기간의 관심도 자체가 변화하고 있음',
    ],
    tips: [
      '대응 전략 실행 전후를 비교하면 전략의 효과를 정량 측정 가능',
      '정기 분석(주간/격주)으로 여론 변화 추이를 지속 모니터링하세요',
      '이벤트(기자회견, 발표 등) 전후를 비교하면 이벤트 영향력을 정확히 파악',
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
      '연결선 없는 노드: AI가 단독 이슈로 판단했거나, 동시출현 빈도가 낮은 경우',
    ],
    howToRead: [
      '허브 키워드 찾기: 가장 많은 선이 연결된 노드 = 여론의 "중심 프레임"을 구성하는 핵심어',
      '군집(클러스터) 파악: 선으로 묶인 키워드 그룹 = 함께 논의되는 하나의 내러티브',
      '색상 군집 분석: 빨강 노드끼리 강하게 연결 = 부정 여론의 공격 논리가 구조화된 것',
      '긍·부정 교차 연결: 초록-빨강이 교차된 경우 = 같은 사건을 두고 프레임 충돌이 일어나는 지점',
      '고립 노드: 연결선 없이 떠 있는 키워드 = 독립 이슈이거나 소수 여론의 주변적 언급',
    ],
    tips: [
      '드래그: 노드를 끌어 배치를 재정렬 — 복잡한 연결을 분리해서 분석 가능',
      '스크롤(휠): 확대/축소로 세부 관계와 라벨을 명확하게 확인',
      '허브 키워드를 먼저 파악한 뒤 연결된 부정어 제거 전략을 수립하면 효과적',
      '워드 클라우드(빈도)와 함께 보면 "자주 언급되지만 고립" vs "덜 언급되지만 핵심 연결고리"인 키워드를 구별 가능',
      '연결선이 없거나 적을 때: AI 모델을 Claude Sonnet 4.6 또는 Gemini 2.5 Pro로 변경하면 연관어 추출 품질이 향상됩니다',
    ],
    limitations: [
      '연관어(relatedKeywords)가 비어있으면 노드만 표시되고 연결선이 나타나지 않습니다',
      '연결선 생성 품질은 AI 모델 성능에 크게 의존 — 저비용 모델(Flash Lite 등)은 연관어를 생략하는 경향',
      '입력 데이터가 매우 적은 경우(기사+댓글 합계 50건 미만) 연관어 추출 정확도 낮아짐',
    ],
    techNotes: [
      '데이터 출처: sentiment-framing 모듈의 topKeywords(노드) + relatedKeywords(엣지)',
      '렌더링: D3.js v7 Force-directed simulation — charge, center, collision, x/y 보조력 조합',
      '노드 크기: d3.scaleSqrt() — count 값을 실제 픽셀 반지름 6~32px로 정규화',
      '추천 AI 모델(연관어 추출 품질 기준): ① Claude Sonnet 4.6 (연관어 구조화 가장 정교) ② Gemini 2.5 Pro (무료/CLI 활용 가능) ③ Gemini 2.5 Flash (기본) — Flash Lite·GPT-4.1 Nano는 연관어 생략 빈번',
      '스키마 검증: relatedKeywords min(1) 강제 — AI가 빈 배열 반환 시 자동 재시도 로직 적용',
    ],
    source: '감정 프레이밍 모듈 (sentiment-framing) — topKeywords + relatedKeywords',
    relatedModules: ['키워드 / 워드 클라우드', '감성 비율', '프레임 전쟁(고급)'],
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
      '감정 필터(긍정/부정/중립)로 특정 감성의 원문만 추출 가능',
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
      '저장: articles.embedding / comments.embedding 컬럼 (PostgreSQL pgvector, vector(384) 타입)',
      '검색 방식: 질의 텍스트 → embedTexts() → pgvector 코사인 거리(<=> 연산자)로 유사도 정렬',
      '유사도: 1 - (embedding <=> query_vector) = 코사인 유사도 (0~1), 기본 필터 임계값 0.4',
      '임베딩 생성 시점: 파이프라인 실행 시 embedding-persist.ts에서 배치 생성',
      '업그레이드 가이드: 임베딩 모델 변경 시 vector(384) → 새 차원수 마이그레이션 + 전체 backfill 재실행 필요',
    ],
    source: 'pgvector 임베딩 (multilingual-e5-small, 384차원)',
    relatedModules: ['키워드 / 연관어', '수집 데이터'],
  },
  knowledgeGraph: {
    title: '지식 그래프 (Knowledge Graph)',
    description:
      '14개 AI 분석 모듈이 추출한 엔티티(인물·조직·이슈·키워드·프레임·주장)와 그 관계를 클러스터형 네트워크로 시각화합니다. 노드 크기는 언급 빈도, 선 굵기는 관계 강도, 선 색상은 관계 유형을 나타냅니다.',
    details: [
      '보라색 노드 — 인물: 분석 대상 인물 및 언급된 주요 관계자',
      '파란색 노드 — 조직: 정당·언론·지지 집단·반대 집단 등',
      '빨간색 노드 — 이슈: 핵심 논란·리스크·사건 사고',
      '초록색 노드 — 키워드: 고빈도 언급 단어·해시태그',
      '노란색 노드 — 프레임: 여론이 대상을 해석하는 서사 틀',
      '하늘색 노드 — 주장: 지지·공격성 메시지, 유력 발언',
      '실선(빨강): 위협(threatens) — 한 프레임이 다른 프레임을 약화시키는 관계',
      '실선(주황): 대립(opposes) — 두 프레임·세력이 정면 충돌하는 관계',
      '실선(보라): 연쇄(causes) — 한 이슈가 다른 이슈를 유발하는 인과 관계',
      '실선(초록): 지지(supports) — 한 주장이 다른 엔티티를 강화하는 관계',
      '점선(회색): 동시출현(cooccurs) / 연관(related) — 함께 언급되는 관계',
      '노드 위에 마우스를 올리면 직접 연결된 노드·선만 강조됩니다',
      '노드를 클릭하면 하단에 전체 레이블·설명·언급 횟수가 표시됩니다',
      '드래그로 노드를 자유롭게 배치할 수 있습니다',
    ],
    howToRead: [
      '타입 배지(인물·조직·…)를 클릭하면 해당 유형만 필터링됩니다. 복잡할 때는 프레임+이슈만 켜고 관계 구조를 먼저 파악하세요.',
      '노드가 클수록 언급 빈도가 높습니다. 반경이 가장 큰 2~3개 노드가 현재 여론의 핵심 허브입니다.',
      '많은 선이 집중된 노드(허브)를 찾으세요. 그 엔티티를 통제하거나 활용하면 여론 구조 전체에 영향을 줄 수 있습니다.',
      '빨간·주황 실선으로 연결된 프레임 쌍은 현재 프레임 전쟁이 벌어지는 구간입니다. 어느 쪽이 더 굵은지(강도) 확인하세요.',
      '점선 밀집 구역은 동시에 유통되는 키워드 군집입니다. 한 키워드로 메시지를 만들면 군집 전체로 연상이 퍼집니다.',
      '같은 타입 원(클러스터 배경)에서 멀리 떨어진 노드는 이질적 성격을 가진 엔티티입니다. 다른 타입과 더 강하게 연결된 경우 크로스-도메인 영향력이 있습니다.',
    ],
    tips: [
      '가장 많은 선이 연결된 허브 노드 2~3개를 찾아 커뮤니케이션 전략의 출발점으로 삼으세요.',
      '빨간 실선(위협) 관계에서 내 프레임이 수동적(화살표를 받는 쪽)이면 방어 메시지가 필요합니다.',
      '프레임 필터만 켠 상태에서 프레임 간 관계를 확인하면, 경쟁 서사를 어떤 순서로 무력화할지 순서를 잡을 수 있습니다.',
      '이슈 노드를 클릭해 설명을 읽으면 해당 이슈가 어느 분석 모듈에서 추출됐는지 확인할 수 있습니다.',
      '키워드 군집(점선 집중 구역)에서 핵심 단어를 선점하면 군집 전체의 연상 이미지를 선점하는 효과가 있습니다.',
      '분석을 반복 실행하면 엔티티 언급 횟수가 누적됩니다. 노드 크기 변화를 비교해 여론 흐름의 이동을 추적하세요.',
    ],
    limitations: [
      '엔티티는 14개 모듈 결과에서 자동 추출되므로, AI가 분석에서 언급하지 않은 항목은 그래프에 나타나지 않습니다.',
      '"이재명"과 "이 대표"처럼 동의어가 별개 노드로 분리될 수 있습니다. 중요 인물은 클릭해서 레이블 전체를 확인하세요.',
      '엔티티 최대 표시 개수는 50개입니다. 노드가 많을 경우 타입 필터로 집중 영역을 좁히세요.',
      '수집 건수가 적을 때(20건 미만)는 관계선이 희박하게 나타납니다. 수집 후 재분석하면 그래프가 풍부해집니다.',
    ],
    techNotes: [
      '추출 모듈: sentiment-framing(키워드·프레임), frame-war(프레임 위협), risk-map(이슈·연쇄), message-impact(주장), segmentation(조직), macro-view(이슈 변곡점), strategy(조직·키워드)',
      '관계 유형 6종: supports / opposes / related / causes / cooccurs / threatens',
      '노드 크기 = mentionCount × 3, 최소 8px. 관계선 굵기 = weight × 3, 최소 1px.',
      '동일 엔티티(normalizedName + type 일치)가 여러 모듈에서 추출되면 mentionCount가 누적됩니다.',
      '그래프 레이아웃은 D3 Force Simulation — 타입별 클러스터링(forceX/Y strength 0.18) + 충돌 회피(forceCollide).',
      '권장 AI 모델: Claude Opus 4.6 (복잡한 관계 추론) 또는 GPT-4o (속도 우선). 저비용 분석 시 Claude Haiku 4.5 사용 가능하나 관계 다양성이 줄어듦.',
    ],
    source:
      '온톨로지 추출 파이프라인 (14개 분석 모듈 결과 자동 매핑 → PostgreSQL entities/relations 테이블)',
    relatedModules: [
      '감성 프레이밍',
      '프레임 전쟁(고급)',
      '리스크 분석',
      '메시지 임팩트',
      '세그멘테이션',
    ],
  },
} as const;
