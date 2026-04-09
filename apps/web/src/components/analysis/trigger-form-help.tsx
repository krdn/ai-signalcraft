'use client';

import {
  Search,
  Zap,
  BarChart3,
  Clock,
  DollarSign,
  Lightbulb,
  HelpCircle,
  ChevronDown,
  Bookmark,
  Pause,
  Play,
  SkipForward,
  FastForward,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface TriggerFormHelpProps {
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  helpTab: string;
  setHelpTab: (tab: string) => void;
}

export function TriggerFormHelp({
  isHelpOpen,
  setIsHelpOpen,
  helpTab,
  setHelpTab,
}: TriggerFormHelpProps) {
  return (
    <Collapsible open={isHelpOpen} onOpenChange={setIsHelpOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
        <HelpCircle className="h-4 w-4" />
        사용 가이드
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${isHelpOpen ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 rounded-lg border bg-card text-sm">
          {/* 도움말 탭 네비게이션 */}
          <Tabs value={helpTab} onValueChange={setHelpTab}>
            <div className="border-b px-3 pt-3">
              <TabsList className="w-full h-auto flex-wrap gap-1">
                <TabsTrigger value="quickstart" className="gap-1 text-xs">
                  <Zap className="h-3 w-3" />
                  빠른 시작
                </TabsTrigger>
                <TabsTrigger value="keyword" className="gap-1 text-xs">
                  <Search className="h-3 w-3" />
                  키워드
                </TabsTrigger>
                <TabsTrigger value="sources" className="gap-1 text-xs">
                  <BarChart3 className="h-3 w-3" />
                  소스
                </TabsTrigger>
                <TabsTrigger value="period" className="gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  기간
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="gap-1 text-xs">
                  <Zap className="h-3 w-3" />
                  분석 과정
                </TabsTrigger>
                <TabsTrigger value="cost" className="gap-1 text-xs">
                  <DollarSign className="h-3 w-3" />
                  비용/시간
                </TabsTrigger>
                <TabsTrigger value="breakpoints" className="gap-1 text-xs">
                  <Bookmark className="h-3 w-3" />
                  단계별 정지
                </TabsTrigger>
              </TabsList>
            </div>

            {/* 빠른 시작 가이드 */}
            <TabsContent value="quickstart" className="p-4 space-y-4 mt-0">
              <div>
                <h4 className="font-semibold text-foreground flex items-center gap-1.5 mb-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  3단계로 분석 시작하기
                </h4>
                <ol className="space-y-3 text-muted-foreground">
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-5 w-5 justify-center p-0 text-xs"
                    >
                      1
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">키워드 입력</span>
                      <p className="mt-0.5">분석하려는 인물명 또는 이슈 키워드를 입력하세요.</p>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-5 w-5 justify-center p-0 text-xs"
                    >
                      2
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">소스 & 기간 선택</span>
                      <p className="mt-0.5">
                        수집할 플랫폼과 분석 기간을 설정합니다. 기본값(전체 소스, 최근 7일)으로도
                        충분합니다.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-5 w-5 justify-center p-0 text-xs"
                    >
                      3
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">분석 실행</span>
                      <p className="mt-0.5">
                        버튼을 누르면 자동으로 수집 → 분석 → 리포트가 생성됩니다. 진행 상태는
                        실시간으로 확인 가능합니다.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
              <Separator />
              <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                <p className="font-medium text-foreground text-xs">처음 사용하시나요?</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• 기본 설정 그대로 키워드만 입력해도 분석이 시작됩니다</li>
                  <li>• 분석이 진행되는 동안 다른 탭을 둘러볼 수 있습니다</li>
                  <li>• 완료 후 &quot;AI 리포트&quot; 탭에서 종합 분석 결과를 확인하세요</li>
                  <li>• 분석 중 특정 모듈을 건너뛰거나 비용 한도를 설정할 수 있습니다</li>
                  <li>
                    • <span className="text-foreground font-medium">단계별 검수 정지</span> 기능으로
                    특정 단계 완료 후 결과를 확인하고 재개할 수 있습니다 (아래 탭 참고)
                  </li>
                </ul>
              </div>
            </TabsContent>

            {/* 키워드 가이드 */}
            <TabsContent value="keyword" className="p-4 space-y-4 mt-0">
              <div>
                <h4 className="font-semibold text-foreground mb-2">키워드 입력 가이드</h4>
                <p className="text-muted-foreground mb-3">
                  분석 대상의 여론을 정확하게 수집하려면 적절한 키워드 설정이 중요합니다.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium text-foreground text-xs mb-1.5">좋은 키워드 예시</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['이재명', '윤석열', '삼성전자', '갤럭시 S25', 'AI 규제'].map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    구체적인 인물명, 기업명, 이슈명이 가장 좋은 결과를 냅니다.
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium text-foreground text-xs mb-1.5">키워드 작성 팁</p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-1.5">
                      <span className="text-green-500 shrink-0">O</span>
                      <span>
                        <span className="text-foreground">명확하고 구체적인 키워드</span> —
                        &quot;이재명 대선&quot;보다 &quot;이재명&quot;이 범위가 넓어 더 많은 데이터
                        수집
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-green-500 shrink-0">O</span>
                      <span>
                        <span className="text-foreground">가장 많이 쓰이는 표현</span> —
                        &quot;삼성&quot;보다 &quot;삼성전자&quot;가 뉴스/커뮤니티에서 더 정확
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-red-500 shrink-0">X</span>
                      <span>
                        <span className="text-foreground">너무 일반적인 키워드 피하기</span> —
                        &quot;경제&quot;, &quot;정치&quot; 같은 포괄적 키워드는 노이즈가 많음
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-red-500 shrink-0">X</span>
                      <span>
                        <span className="text-foreground">특수문자/기호 피하기</span> — 검색
                        정확도가 떨어질 수 있음
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-dashed p-3">
                  <p className="font-medium text-foreground text-xs mb-1.5">
                    활용 시나리오별 키워드
                  </p>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <p>
                      <span className="text-foreground">정치인 여론 분석:</span> 인물 이름 (예:
                      &quot;한동훈&quot;)
                    </p>
                    <p>
                      <span className="text-foreground">기업 이미지 분석:</span> 기업명 (예:
                      &quot;현대자동차&quot;)
                    </p>
                    <p>
                      <span className="text-foreground">이슈/사건 분석:</span> 사건명 (예:
                      &quot;의대 증원&quot;)
                    </p>
                    <p>
                      <span className="text-foreground">제품 여론 분석:</span> 제품명 (예:
                      &quot;아이폰 17&quot;)
                    </p>
                    <p>
                      <span className="text-foreground">연예인 평판 분석:</span> 활동명 (예:
                      &quot;뉴진스&quot;)
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 소스 가이드 */}
            <TabsContent value="sources" className="p-4 space-y-4 mt-0">
              <div>
                <h4 className="font-semibold text-foreground mb-2">데이터 소스 가이드</h4>
                <p className="text-muted-foreground mb-3">
                  각 소스는 서로 다른 특성의 여론을 반영합니다. 목적에 따라 적절한 소스를
                  선택하세요.
                </p>
              </div>

              <div className="space-y-3">
                {/* 네이버 뉴스 */}
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground text-sm">네이버 뉴스</span>
                    <Badge variant="outline" className="text-xs">
                      뉴스/영상
                    </Badge>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p>
                      <span className="text-foreground">수집 대상:</span> 뉴스 기사 본문 + 기사별
                      댓글
                    </p>
                    <p>
                      <span className="text-foreground">수집 방식:</span> Playwright 브라우저 자동화
                    </p>
                    <p>
                      <span className="text-foreground">기본 한도:</span> 기사 1,000건 (일별 균등
                      수집), 기사당 댓글 500건
                    </p>
                    <p>
                      <span className="text-foreground">특성:</span> 주류 언론의 보도 프레임과 일반
                      대중의 반응을 동시에 파악. 정치/경제 키워드에 특히 효과적
                    </p>
                    <p>
                      <span className="text-foreground">추천 상황:</span> 언론 보도 기조 분석, 댓글
                      여론 파악, 기사 프레이밍 분석
                    </p>
                  </div>
                </div>

                {/* 유튜브 */}
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground text-sm">유튜브</span>
                    <Badge variant="outline" className="text-xs">
                      뉴스/영상
                    </Badge>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p>
                      <span className="text-foreground">수집 대상:</span> 영상 메타데이터(조회수,
                      좋아요) + 댓글
                    </p>
                    <p>
                      <span className="text-foreground">수집 방식:</span> YouTube Data API v3
                    </p>
                    <p>
                      <span className="text-foreground">기본 한도:</span> 영상 50건, 영상당 댓글
                      500건
                    </p>
                    <p>
                      <span className="text-foreground">특성:</span> 영상 콘텐츠에 대한 시청자 반응.
                      정치 유튜브, 리뷰, 뉴스 클립 댓글에서 깊은 의견 확인 가능
                    </p>
                    <p>
                      <span className="text-foreground">추천 상황:</span> 영상 미디어 여론 파악,
                      인플루언서 영향력 분석, 바이럴 콘텐츠 추적
                    </p>
                  </div>
                </div>

                {/* 커뮤니티 */}
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground text-sm">커뮤니티</span>
                    <Badge variant="outline" className="text-xs">
                      커뮤니티
                    </Badge>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p>
                      <span className="text-foreground">수집 대상:</span> 게시글 + 댓글
                    </p>
                    <p>
                      <span className="text-foreground">수집 방식:</span> Playwright 브라우저 자동화
                    </p>
                    <p>
                      <span className="text-foreground">기본 한도:</span> 게시글 50건, 게시글당 댓글
                      500건
                    </p>
                  </div>
                  <Separator />
                  <div className="text-xs space-y-2 text-muted-foreground">
                    <div>
                      <span className="text-foreground font-medium">DC갤러리</span>
                      <p className="mt-0.5">
                        익명 커뮤니티로 정치 관련 활발한 토론. 솔직하고 날것의 여론 확인 가능. 정치
                        갤러리, 주식 갤러리 등 주제별 분류
                      </p>
                    </div>
                    <div>
                      <span className="text-foreground font-medium">에펨코리아</span>
                      <p className="mt-0.5">
                        스포츠/연예/시사 중심 커뮤니티. 20~30대 남성 여론이 주류. 유머와 섞인 시사
                        토론 활발
                      </p>
                    </div>
                    <div>
                      <span className="text-foreground font-medium">클리앙</span>
                      <p className="mt-0.5">
                        IT/기술 중심 커뮤니티. 상대적으로 논리적인 토론 문화. 기업/제품 여론에 특히
                        유용
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="font-medium text-foreground text-xs mb-1.5">소스 조합 추천</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    <span className="text-foreground">종합 분석:</span> 전체 선택 (가장 포괄적,
                    권장)
                  </p>
                  <p>
                    <span className="text-foreground">빠른 분석:</span> 네이버 뉴스만 (빠르고 대표성
                    높음)
                  </p>
                  <p>
                    <span className="text-foreground">MZ세대 여론:</span> 유튜브 + 에펨코리아
                  </p>
                  <p>
                    <span className="text-foreground">IT/기술 여론:</span> 클리앙 + 유튜브
                  </p>
                  <p>
                    <span className="text-foreground">정치 심층 여론:</span> DC갤러리 + 네이버 뉴스
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 기간 가이드 */}
            <TabsContent value="period" className="p-4 space-y-4 mt-0">
              <div>
                <h4 className="font-semibold text-foreground mb-2">분석 기간 설정 가이드</h4>
                <p className="text-muted-foreground mb-3">
                  분석 목적에 맞는 기간을 설정하면 더 정확한 인사이트를 얻을 수 있습니다.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="font-medium text-foreground text-xs mb-2">기간 선택 모드</p>
                  <div className="space-y-2">
                    <div className="rounded-lg border p-3 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-xs">기간 선택</Badge>
                        <span className="text-foreground font-medium">시작일~종료일 직접 지정</span>
                      </div>
                      <p className="text-muted-foreground">
                        특정 기간의 여론 흐름을 분석할 때 사용합니다. &quot;빠른 선택&quot; 버튼으로
                        자주 쓰는 기간을 한 번에 설정할 수 있습니다.
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-xs">이벤트 중심</Badge>
                        <span className="text-foreground font-medium">
                          특정 사건 전후 자동 계산
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        기자회견, 발언 논란, 정책 발표 등 특정 이벤트의 여론 영향을 분석할 때
                        사용합니다. 이벤트 날짜와 전후 범위만 설정하면 자동으로 분석 기간이
                        계산됩니다.
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="font-medium text-foreground text-xs mb-2">기간별 권장 가이드</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Badge variant="outline" className="shrink-0 text-xs">
                        1~3일
                      </Badge>
                      <div>
                        <span className="text-foreground">급한 이슈 확인</span>
                        <p className="mt-0.5">
                          속보, 긴급 대응이 필요한 사건의 즉각적인 여론 반응 확인. 수집량이 적어
                          빠르게 완료
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Badge variant="outline" className="shrink-0 text-xs font-semibold">
                        7~14일
                      </Badge>
                      <div>
                        <span className="text-foreground font-medium">가장 추천 (기본값)</span>
                        <p className="mt-0.5">
                          여론 형성부터 확산, 안정화까지의 흐름을 파악하기에 적절한 기간. 대부분의
                          분석에 이 기간이면 충분
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Badge variant="outline" className="shrink-0 text-xs">
                        30일
                      </Badge>
                      <div>
                        <span className="text-foreground">장기 트렌드 분석</span>
                        <p className="mt-0.5">
                          여론의 장기적 변화, 이슈 사이클 분석. 수집 시간이 길어지지만 트렌드 파악에
                          유리
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium text-foreground text-xs mb-1.5">
                    이벤트 중심 모드 활용 예시
                  </p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>• 기자회견 발언이 여론에 미친 영향 → 이벤트 날짜 + 전후 3일</p>
                    <p>• 정책 발표 후 국민 반응 → 이벤트 날짜 + 전후 5일</p>
                    <p>• 논란 발생 전후 여론 변화 비교 → 이벤트 날짜 + 전후 7일</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 분석 과정 가이드 */}
            <TabsContent value="pipeline" className="p-4 space-y-4 mt-0">
              <div>
                <h4 className="font-semibold text-foreground mb-2">분석 파이프라인 상세</h4>
                <p className="text-muted-foreground mb-3">
                  분석 실행 후 4단계 파이프라인이 자동으로 진행됩니다.
                </p>
              </div>

              {/* 파이프라인 흐름도 */}
              <div className="flex items-center justify-center gap-1 flex-wrap">
                {[
                  {
                    label: '수집',
                    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
                  },
                  {
                    label: '정규화',
                    color:
                      'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
                  },
                  {
                    label: 'AI 분석',
                    color:
                      'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
                  },
                  {
                    label: '리포트',
                    color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
                  },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-1">
                    <span
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${step.color}`}
                    >
                      {step.label}
                    </span>
                    {i < 3 && <span className="text-muted-foreground text-xs">→</span>}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {/* 1단계: 수집 */}
                <div className="rounded-lg border p-3 text-xs space-y-1.5">
                  <p className="font-medium text-foreground">1단계: 데이터 수집</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• 선택한 소스에서 키워드 관련 기사/영상/게시글/댓글을 자동 수집</li>
                    <li>
                      • 각 소스는 <span className="text-foreground">독립적으로 병렬 실행</span> —
                      하나가 실패해도 나머지 계속 진행
                    </li>
                    <li>• 수집 현황은 &quot;수집&quot; 탭에서 소스별로 실시간 확인 가능</li>
                  </ul>
                </div>

                {/* 2단계: 정규화 */}
                <div className="rounded-lg border p-3 text-xs space-y-1.5">
                  <p className="font-medium text-foreground">2단계: 데이터 정규화</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• 각 플랫폼별 다른 데이터 구조를 통일된 형식으로 변환</li>
                    <li>• 중복 데이터 제거 (같은 기사/댓글 재수집 방지)</li>
                    <li>• 기사↔댓글, 영상↔댓글 관계 매핑</li>
                  </ul>
                </div>

                {/* 3단계: AI 분석 */}
                <div className="rounded-lg border p-3 text-xs space-y-2">
                  <p className="font-medium text-foreground">3단계: AI 분석 (12개 모듈)</p>
                  <p className="text-muted-foreground">
                    GPT-4o-mini와 Claude Sonnet이 단계별로 분석을 수행합니다.
                  </p>
                  <div className="space-y-2">
                    <div className="rounded bg-muted/50 p-2">
                      <p className="text-foreground font-medium mb-1">
                        Stage 1 — 기초 분석 (4개, 병렬)
                      </p>
                      <p className="text-muted-foreground">
                        감정 프레이밍 · 거시 분석 · 세그멘테이션 · 메시지 임팩트
                      </p>
                    </div>
                    <div className="rounded bg-muted/50 p-2">
                      <p className="text-foreground font-medium mb-1">
                        Stage 2 — 심층 분석 (3개, 순차)
                      </p>
                      <p className="text-muted-foreground">
                        리스크 맵 · 기회 발굴 · 전략 제안 — Stage 1 결과를 참조
                      </p>
                    </div>
                    <div className="rounded bg-muted/50 p-2">
                      <p className="text-foreground font-medium mb-1">Stage 3 — 종합 요약 (1개)</p>
                      <p className="text-muted-foreground">
                        모든 선행 분석을 통합하여 핵심 발견과 즉시 행동 사항 정리
                      </p>
                    </div>
                    <div className="rounded bg-muted/50 p-2">
                      <p className="text-foreground font-medium mb-1">Stage 4 — 고급 분석 (4개)</p>
                      <p className="text-muted-foreground">
                        지지율 분석 · 프레임 전쟁 · 위기 시나리오 · 승리 시뮬레이션
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4단계: 리포트 */}
                <div className="rounded-lg border p-3 text-xs space-y-1.5">
                  <p className="font-medium text-foreground">4단계: 리포트 생성</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>
                      • Stage 1~3 완료 후 <span className="text-foreground">1차 리포트</span> 자동
                      생성
                    </li>
                    <li>
                      • Stage 4 고급 분석 완료 시{' '}
                      <span className="text-foreground">최종 리포트로 재생성</span>
                    </li>
                    <li>• 일부 모듈이 실패해도 가용한 결과로 리포트 작성</li>
                    <li>• &quot;AI 리포트&quot; 탭에서 마크다운 형식으로 확인 가능</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="font-medium text-foreground text-xs mb-1.5">분석 중 제어 기능</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    • <span className="text-foreground">일시정지/재개:</span> 분석을 잠시 멈추고
                    나중에 이어서 진행
                  </p>
                  <p>
                    • <span className="text-foreground">모듈 스킵:</span> 특정 분석 모듈을 건너뛰어
                    시간/비용 절감
                  </p>
                  <p>
                    • <span className="text-foreground">비용 한도:</span> AI API 사용 비용 상한선
                    설정 (초과 시 자동 중지)
                  </p>
                  <p>
                    • <span className="text-foreground">중지:</span> 진행 중인 분석을 완전히 취소
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 비용/시간 가이드 */}
            <TabsContent value="cost" className="p-4 space-y-4 mt-0">
              <div>
                <h4 className="font-semibold text-foreground mb-2">예상 소요시간 & 비용</h4>
                <p className="text-muted-foreground mb-3">
                  실행 조건에 따라 소요시간과 AI API 비용이 달라집니다.
                </p>
              </div>

              <div className="space-y-3">
                {/* 소요시간 */}
                <div>
                  <p className="font-medium text-foreground text-xs mb-2">예상 소요시간</p>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                            조건
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                            수집
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                            분석
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                            합계
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        <tr className="border-t">
                          <td className="px-3 py-2 text-foreground">소스 1개, 7일</td>
                          <td className="px-3 py-2">1~3분</td>
                          <td className="px-3 py-2">3~5분</td>
                          <td className="px-3 py-2 text-foreground font-medium">5~8분</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-foreground">전체 소스, 7일</td>
                          <td className="px-3 py-2">3~8분</td>
                          <td className="px-3 py-2">5~10분</td>
                          <td className="px-3 py-2 text-foreground font-medium">10~20분</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-foreground">전체 소스, 30일</td>
                          <td className="px-3 py-2">10~20분</td>
                          <td className="px-3 py-2">10~15분</td>
                          <td className="px-3 py-2 text-foreground font-medium">20~35분</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    * 수집 소스 수, 기간, 데이터 양에 따라 실제 소요시간은 달라질 수 있습니다.
                  </p>
                </div>

                <Separator />

                {/* AI API 비용 */}
                <div>
                  <p className="font-medium text-foreground text-xs mb-2">AI API 비용 (참고)</p>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                            모델
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                            사용 단계
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                            비용 수준
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        <tr className="border-t">
                          <td className="px-3 py-2 text-foreground">GPT-4o-mini</td>
                          <td className="px-3 py-2">Stage 1 (기초 분석)</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className="text-xs text-green-600 border-green-600/30"
                            >
                              저렴
                            </Badge>
                          </td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2 text-foreground">Claude Sonnet</td>
                          <td className="px-3 py-2">Stage 2~4 (심층/고급)</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className="text-xs text-orange-600 border-orange-600/30"
                            >
                              보통
                            </Badge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium text-foreground text-xs mb-1.5">비용 절감 팁</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>
                      • <span className="text-foreground">불필요한 모듈 스킵:</span> 분석 진행 중
                      &quot;분석&quot; 탭에서 특정 모듈 비활성화 가능
                    </li>
                    <li>
                      • <span className="text-foreground">비용 한도 설정:</span> 개요 탭에서 한도를
                      설정하면 초과 시 자동 중지
                    </li>
                    <li>
                      • <span className="text-foreground">개별 감정 분석 옵션:</span> 활성화하면
                      기사/댓글 각각에 AI를 호출하므로 비용이 크게 증가. 필요한 경우에만 사용
                    </li>
                    <li>
                      • <span className="text-foreground">소스 수 조절:</span> 네이버 뉴스만으로도
                      기본적인 여론 파악이 가능
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-dashed p-3">
                  <p className="font-medium text-foreground text-xs mb-1.5">비용 실시간 확인</p>
                  <p className="text-xs text-muted-foreground">
                    분석 실행 후 파이프라인 모니터의 &quot;개요&quot; 탭에서 현재까지 사용된 토큰
                    수와 예상 비용을 실시간으로 확인할 수 있습니다.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 단계별 검수 정지 가이드 */}
            <TabsContent value="breakpoints" className="p-4 space-y-4 mt-0">
              <div>
                <h4 className="font-semibold text-foreground flex items-center gap-1.5 mb-2">
                  <Bookmark className="h-4 w-4 text-amber-500" />
                  단계별 검수 정지 (브레이크포인트)
                </h4>
                <p className="text-muted-foreground mb-3">
                  분석 파이프라인의 특정 단계가 끝날 때마다 자동으로 정지하여 중간 결과를 확인하고,
                  검수 후 수동으로 다음 단계를 진행할 수 있는 기능입니다. 검수·디버깅·단계별 결과
                  비교에 유용합니다.
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <p className="font-medium text-foreground text-xs mb-1.5">언제 사용하면 좋나요?</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>
                    • <span className="text-foreground">수집 품질 검수:</span> 수집된 데이터가
                    의도한 범위·양인지 확인 후 분석 진행
                  </li>
                  <li>
                    • <span className="text-foreground">개별 감정 결과 검증:</span> 기사/댓글 감정
                    분석 결과를 확인 후 AI 분석 진행 여부 결정
                  </li>
                  <li>
                    • <span className="text-foreground">Stage별 비교:</span> Stage 1(거시 분석)
                    결과를 먼저 보고 Stage 2(전략) 진행 여부 결정
                  </li>
                  <li>
                    • <span className="text-foreground">비용 통제:</span> 중간 단계에서 결과가
                    기대에 못 미치면 즉시 취소해 이후 비용 절감
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-foreground text-xs mb-2">정지 가능한 단계 (7개)</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex gap-2 items-start">
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      1
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">수집 완료 후</span>
                      <span className="text-muted-foreground">
                        {' '}
                        — 네이버·유튜브·커뮤니티 원본 데이터 확보 시점
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start">
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      2
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">정규화 완료 후</span>
                      <span className="text-muted-foreground"> — DB 저장·중복 제거 완료 시점</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start">
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      3
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">토큰 최적화 완료 후</span>
                      <span className="text-muted-foreground">
                        {' '}
                        — 분석 전 전처리/압축 완료 시점
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start">
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      4
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">개별 감정 분석 완료 후</span>
                      <span className="text-muted-foreground">
                        {' '}
                        — 기사/댓글 단위 감정 태깅 완료 시점
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start">
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      5
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">AI 분석 Stage 1 완료 후</span>
                      <span className="text-muted-foreground">
                        {' '}
                        — 거시 관점·세그먼트·감정 프레임·메시지 영향 (병렬 4모듈)
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start">
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      6
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">AI 분석 Stage 2 완료 후</span>
                      <span className="text-muted-foreground">
                        {' '}
                        — 리스크맵·기회·전략·최종 요약 완료 시점
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start">
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      7
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">AI 분석 Stage 4 완료 후</span>
                      <span className="text-muted-foreground">
                        {' '}
                        — 지지율·프레임 전쟁·위기 시나리오 등 고급 분석 완료 시점
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="font-medium text-foreground text-xs mb-2">사용 방법</p>
                <ol className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-5 w-5 justify-center p-0 text-xs"
                    >
                      1
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">분석 시작 전 설정:</span> 분석
                      옵션 아래의{' '}
                      <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                        <Bookmark className="h-3 w-3" />
                        단계별 검수 정지
                      </span>{' '}
                      섹션을 열고 정지할 단계를 체크
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-5 w-5 justify-center p-0 text-xs"
                    >
                      2
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">자동 정지:</span> 선택한 단계가
                      끝나면 자동으로 정지, 해당 카드가 앰버색으로 강조되며 인라인 제어 패널이
                      나타남
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-5 w-5 justify-center p-0 text-xs"
                    >
                      3
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">결과 검수:</span> 파이프라인
                      모니터의 &quot;개요&quot; · &quot;수집&quot; · &quot;분석&quot; 탭에서
                      현재까지 진행된 결과 확인
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="shrink-0 h-5 w-5 justify-center p-0 text-xs"
                    >
                      4
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">재개 선택:</span> 인라인 패널의
                      4 버튼 중 하나 선택 (아래 설명)
                    </div>
                  </li>
                </ol>
              </div>

              <div>
                <p className="font-medium text-foreground text-xs mb-2">재개 버튼 4종</p>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-2 items-start rounded-md border p-2">
                    <Play className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-foreground font-medium">다음 단계 실행</p>
                      <p className="text-muted-foreground">
                        다음 브레이크포인트까지 진행. 설정한 BP가 더 없으면 끝까지 완료.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start rounded-md border p-2">
                    <SkipForward className="h-4 w-4 shrink-0 text-foreground mt-0.5" />
                    <div>
                      <p className="text-foreground font-medium">한 단계만 실행 (step-once)</p>
                      <p className="text-muted-foreground">
                        바로 다음 단계 하나만 실행하고 즉시 다시 정지. 단계별로 결과를 꼼꼼히 볼 때.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start rounded-md border p-2">
                    <FastForward className="h-4 w-4 shrink-0 text-foreground mt-0.5" />
                    <div>
                      <p className="text-foreground font-medium">끝까지 실행</p>
                      <p className="text-muted-foreground">
                        모든 브레이크포인트를 무시하고 리포트까지 완주. 검수 종료 시 사용.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start rounded-md border border-red-200 dark:border-red-900/50 p-2">
                    <Pause className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-foreground font-medium">취소</p>
                      <p className="text-muted-foreground">
                        작업을 완전히 중지. 이미 수집·저장된 데이터는 유지되지만 이후 단계는
                        진행되지 않음.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-dashed p-3 space-y-1.5">
                <p className="font-medium text-foreground text-xs">참고 사항</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>
                    • 24시간 내에 재개하지 않으면{' '}
                    <span className="text-foreground">자동으로 취소</span>됩니다 (무한 대기 방지).
                  </li>
                  <li>
                    • 정지 중에도 비용이 더 발생하지는 않습니다 (이미 진행된 단계의 비용만 청구).
                  </li>
                  <li>
                    • 브레이크포인트는 분석 시작 전에만 설정 가능하며, 실행 중에는 변경할 수
                    없습니다 (향후 개선 예정).
                  </li>
                  <li>
                    • 동시에 여러 BP 잡이 정지되면 뒤따르는 잡 처리가 지연될 수 있으니, 검수가
                    끝나면 되도록 빨리 재개 또는 취소하는 것을 권장합니다.
                  </li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
