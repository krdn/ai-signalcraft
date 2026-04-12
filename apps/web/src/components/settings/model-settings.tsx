'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  HelpCircle,
  Loader2,
  RotateCcw,
  AlertTriangle,
  ChevronsUpDown,
  Sparkles,
  Zap,
  ArrowRight,
  Shield,
  Heart,
} from 'lucide-react';
import { PROVIDER_REGISTRY, type AIProvider } from '@ai-signalcraft/core/ai-meta';
import { trpcClient } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// ── 모듈 메타데이터 ──

type ModuleMeta = {
  name: string;
  description: string;
  analyzes: string[];
  recommended: { provider: string; model: string; reason: string };
  costTip: string;
  domain?:
    | 'political'
    | 'fandom'
    | 'corporate'
    | 'pr'
    | 'policy'
    | 'finance'
    | 'healthcare'
    | 'legal'
    | 'sports'; // undefined = 공통
};

const MODULE_META: Record<string, ModuleMeta> = {
  // 공통 모듈 (Stage 1)
  'macro-view': {
    name: '전체 여론 구조 분석',
    description: '수집된 전체 데이터를 바탕으로 여론의 거시적 구조와 흐름을 파악합니다.',
    analyzes: [
      '주요 이슈별 여론 분포 비율',
      '시간대별 여론 변화 트렌드',
      '플랫폼 간 여론 차이 비교',
      '핵심 키워드 및 토픽 클러스터링',
    ],
    recommended: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reason: '대량 텍스트 요약에 비용 효율적',
    },
    costTip: '데이터 양이 많아 토큰 소비가 큽니다. 비용 절감이 중요하면 경량 모델을 추천합니다.',
  },
  segmentation: {
    name: '여론 진영 세분화',
    description: '여론 참여자를 성향, 관심사, 입장에 따라 세부 진영으로 분류합니다.',
    analyzes: [
      '지지/반대/중립 진영 분류 및 규모 추정',
      '진영별 핵심 주장과 논리 구조',
      '진영 간 대립 포인트 매핑',
      '이탈 가능성이 높은 유동층 식별',
    ],
    recommended: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reason: '패턴 분류 작업에 충분한 성능, 비용 효율적',
    },
    costTip: '분류 작업은 비교적 단순하므로 경량 모델로도 정확도가 높습니다.',
  },
  'sentiment-framing': {
    name: '감정 프레이밍 분석',
    description: '텍스트에 내재된 감정의 종류와 강도, 프레이밍 방식을 분석합니다.',
    analyzes: [
      '긍정/부정/분노/불안/희망 등 감정 분류',
      '감정 강도 수치화 (1~10)',
      '프레이밍 전략 탐지',
      '감정 유발 키워드 추출',
    ],
    recommended: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reason: '감정 분류에 비용 대비 성능 우수',
    },
    costTip: '한국어 뉘앙스 파악이 중요한 경우 고급 모델이 더 정확합니다.',
  },
  'message-impact': {
    name: '메시지 임팩트 분석',
    description: '특정 메시지나 발언이 여론에 미친 실제 영향력을 측정합니다.',
    analyzes: [
      '메시지 도달 범위 및 확산 속도 추정',
      '메시지 전후 여론 변화량 측정',
      '반응 유형 분류',
      '메시지 효과의 지속 기간 예측',
    ],
    recommended: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reason: '정량적 분석에 적합, 비용 효율적',
    },
    costTip: '시계열 비교가 포함되어 입력 토큰이 많을 수 있습니다.',
  },
  // 공통 모듈 (Stage 2)
  'risk-map': {
    name: '리스크 맵',
    description: '현재 여론 상황에서 잠재적 위험 요소를 식별하고 우선순위를 매깁니다.',
    analyzes: [
      '부정 여론 확산 위험도 평가',
      '이슈별 위기 발생 확률 예측',
      '위험 요소 영향 범위 및 심각도 매트릭스',
      '조기 경보 신호 탐지',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '복합적 위험 분석에 높은 추론 능력 필요',
    },
    costTip: '정확한 위험 평가가 중요하므로 고급 모델 사용을 권장합니다.',
  },
  opportunity: {
    name: '기회 요소 분석',
    description: '여론 데이터에서 활용 가능한 긍정적 기회와 전략적 포인트를 발굴합니다.',
    analyzes: [
      '긍정 여론 강화 가능 포인트',
      '경쟁 대상 대비 우위 영역',
      '미디어 어젠다 선점 기회',
      '지지층 확대 가능 타겟 그룹 식별',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '창의적 인사이트 도출에 강점',
    },
    costTip: '전략적 판단이 필요한 영역으로, 모델 품질이 결과에 직접 영향을 줍니다.',
  },
  strategy: {
    name: '전략 제안',
    description: '분석 결과를 종합하여 실행 가능한 구체적 전략 방안을 제시합니다.',
    analyzes: [
      '단기/중기/장기 대응 전략 로드맵',
      '타겟별 맞춤 메시지 전략',
      '위기 대응 시나리오별 액션 플랜',
      '채널별 최적 커뮤니케이션 방안',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '전략 수립에 깊은 추론 능력 필수',
    },
    costTip: '최종 의사결정에 활용되므로 가장 높은 품질의 모델을 추천합니다.',
  },
  'final-summary': {
    name: '최종 요약',
    description: '모든 분석 모듈의 결과를 하나의 통합 요약 보고서로 정리합니다.',
    analyzes: [
      '각 모듈 핵심 결론 종합 정리',
      '우선순위별 주요 발견 사항',
      '즉시 대응 필요 항목 하이라이트',
      '의사결정자용 원페이지 브리핑',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '다중 분석 결과 종합에 뛰어난 정리 능력',
    },
    costTip: '입력이 다른 모듈 결과 전체이므로 토큰 소비가 클 수 있습니다.',
  },
  'integrated-report': {
    name: '종합 리포트',
    description: '모든 분석 결과를 구조화된 전문 리포트 형태로 생성합니다.',
    analyzes: [
      '목차가 포함된 공식 보고서 형태 생성',
      '그래프/차트 데이터 포맷팅',
      '참고 데이터 원문 인용 및 출처 표기',
      '배포 가능한 최종 문서 형태 출력',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '긴 형식의 구조화된 문서 생성에 최적',
    },
    costTip: '출력 토큰이 매우 많습니다. 비용에 민감하면 요약 수준을 조절하세요.',
  },
  // 정치 전용 (Stage 4)
  'approval-rating': {
    name: '지지율 예측',
    description: '수집된 여론 데이터를 기반으로 지지율 변화를 예측합니다.',
    analyzes: [
      '현재 여론 기반 지지율 추정치',
      '향후 1~4주 지지율 변동 시나리오',
      '지지율 영향 핵심 변수 식별',
      '과거 유사 사례와의 패턴 비교',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '수치 예측에 정밀한 추론 필요',
    },
    costTip: '정량적 예측의 정확도는 모델 성능에 크게 의존합니다.',
    domain: 'political',
  },
  'frame-war': {
    name: '프레임 전쟁 분석',
    description: '각 진영이 사용하는 프레이밍 전략과 그 효과를 분석합니다.',
    analyzes: [
      '진영별 주요 프레임 식별 및 명명',
      '프레임 간 충돌 구조 매핑',
      '프레임 우세/열세 판단',
      '역프레이밍 전략 제안',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '미묘한 언어 전략 분석에 고급 모델 필수',
    },
    costTip: '담론 분석은 컨텍스트 이해가 핵심이므로 모델 품질이 중요합니다.',
    domain: 'political',
  },
  'crisis-scenario': {
    name: '위기 시나리오',
    description: '발생 가능한 위기 상황을 시나리오별로 예측하고 대응 방안을 수립합니다.',
    analyzes: [
      '최악/보통/최선 시나리오 시뮬레이션',
      '시나리오별 발생 확률 및 트리거 조건',
      '시나리오별 피해 규모 추정',
      '단계별 위기 대응 매뉴얼 생성',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '복합 시나리오 생성에 고급 추론 필요',
    },
    costTip: '여러 시나리오를 생성하므로 출력 토큰이 많습니다.',
    domain: 'political',
  },
  'win-simulation': {
    name: '승리 시뮬레이션',
    description: '목표 달성을 위한 최적 전략 경로를 시뮬레이션합니다.',
    analyzes: [
      '목표 지지율 달성을 위한 경로 모델링',
      '핵심 변수별 민감도 분석',
      '경쟁 대상 전략 대응 시뮬레이션',
      '최적 자원 배분 방안 제안',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '게임 이론 기반 전략 시뮬레이션에 최고 성능 필요',
    },
    costTip: '가장 복잡한 분석 모듈입니다. 최고 품질 모델 사용을 강력 권장합니다.',
    domain: 'political',
  },
  // 팬덤 전용 (Stage 4)
  'fan-loyalty-index': {
    name: '팬 로열티 지수',
    description: '팬덤의 충성도를 정량 분석하고 이탈 징후를 조기 감지합니다.',
    analyzes: [
      '충성도 점수 (engagement/sentiment/advocacy)',
      '이탈 징후 및 위험 팬 식별',
      '팬덤 세분화 (5단계: 열성팬→일반인)',
      '플랫폼별 팬 참여도 비교',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '팬덤 심리 분석에 높은 이해력 필요',
    },
    costTip: '정서적 뉘앙스 분석이 핵심이므로 고급 모델을 권장합니다.',
    domain: 'fandom',
  },
  'fandom-narrative-war': {
    name: '팬덤 내러티브 전쟁',
    description: '팬덤 vs 안티 내러티브 경쟁과 팬덤 간 경쟁 구도를 분석합니다.',
    analyzes: [
      '팬덤 vs 안티 주요 내러티브 매핑',
      '팬덤 간 갈등 구조 및 연합 관계',
      '내러티브 확산 경로 및 영향력 평가',
      '방어/역공 내러티브 전략 제안',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '복합적 내러티브 분석에 고급 추론 필요',
    },
    costTip: '다양한 관점을 종합해야 하므로 고품질 모델이 필요합니다.',
    domain: 'fandom',
  },
  'fandom-crisis-scenario': {
    name: '팬덤 위기 시나리오',
    description: '팬덤 특유의 위기 유형(논란, 구설, 루머)별 시나리오를 생성합니다.',
    analyzes: [
      '팬덤 위기 유형별 발생 시나리오 3종',
      '확산/통제/역전 단계별 대응 매뉴얼',
      '위기별 팬덤 반응 예측',
      '플랫폼별 대응 전략 차이',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '팬덤 특화 위기 시나리오에 전문적 분석 필요',
    },
    costTip: '여러 시나리오를 생성하므로 출력 토큰이 많습니다.',
    domain: 'fandom',
  },
  'release-reception-prediction': {
    name: '컴백/발표 반응 예측',
    description: '신곡, 컴백, 방송 출연 등의 반응을 사전 예측합니다.',
    analyzes: [
      '성공/보통/실망 시나리오별 반응 예측',
      '성공 요인 및 리스크 요인 분석',
      '플랫폼별 반응 차이 예측',
      '최적 발표 타이밍 및 전략 제안',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '예측 정확도에 고급 모델 필수',
    },
    costTip: '예측의 정확도가 비즈니스에 직접 영향을 미치므로 최고 품질 모델을 추천합니다.',
    domain: 'fandom',
  },
  // 기업 평판 전용 (Stage 4)
  'stakeholder-map': {
    name: '이해관계자 영향력 지도',
    description:
      'Stakeholder Salience Model 기반으로 투자자·소비자·임직원·규제기관·미디어의 권력·합법성·긴급성을 매핑합니다.',
    analyzes: [
      '7가지 이해관계자 유형 분류 (Dormant→Definitive)',
      '이해관계자별 현출성(Salience) 점수 산출',
      '긴급 대응 필요 이해관계자 우선순위 결정',
      '2×2 권력-관심 매트릭스 구성',
    ],
    recommended: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reason: '이해관계자 분류 작업에 비용 효율적',
    },
    costTip: '구조화된 분류 작업이므로 경량 모델로도 정확합니다.',
    domain: 'corporate',
  },
  'esg-sentiment': {
    name: 'ESG 여론 분석',
    description:
      '환경(E)·사회(S)·지배구조(G) 3차원별로 온라인 여론을 분리 측정하고 규제 리스크를 평가합니다.',
    analyzes: [
      'E·S·G 차원별 여론 점수 (0~100)',
      '그린워싱 논란 감지',
      '규제기관 관련 언급 및 리스크 수준',
      'ESG 개선 기회 식별',
    ],
    recommended: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reason: '3차원 분류 작업에 비용 효율적',
    },
    costTip: 'ESG 언급이 없는 차원은 자동으로 중립(50점) 처리됩니다.',
    domain: 'corporate',
  },
  'reputation-index': {
    name: '평판 지수 측정 (RepTrak)',
    description:
      'RepTrak 7차원 모델(제품·혁신·직장·거버넌스·시민의식·리더십·재무)로 종합 평판 점수를 산출합니다.',
    analyzes: [
      'RepTrak 7차원별 점수 및 추세 (improving/stable/declining)',
      '이해관계자별 평판 인식 차이',
      '평판 취약 지점 및 개선 권고',
      '업계 평균 대비 위치 추정',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '7차원 통합 평가에 깊은 추론 필요',
    },
    costTip: '선행 분석 결과를 종합하므로 입력 토큰이 많을 수 있습니다.',
    domain: 'corporate',
  },
  'crisis-type-classifier': {
    name: 'SCCT 위기 유형 분류',
    description:
      'Situational Crisis Communication Theory로 위기 유형(희생자형/사고형/예방가능형)을 분류하고 Image Repair 전략을 매핑합니다.',
    analyzes: [
      'SCCT 3가지 위기 유형 분류 및 귀속 책임 수준',
      'Image Repair Theory 5가지 대응 전략 우선순위',
      '골든타임 잔여 시간 평가 (critical/high/medium/low)',
      '과거 유사 위기 이력 추출',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '위기 유형 판단에 미묘한 컨텍스트 이해 필요',
    },
    costTip: '위기 대응의 골든타임을 다루므로 정확도 우선 고급 모델 권장.',
    domain: 'corporate',
  },
  'media-framing-dominance': {
    name: '미디어 프레임 의제 설정력',
    description:
      '언론 기사 프레임 vs 댓글 여론 프레임의 간극을 분석하고, 기업 공식 메시지의 의제 설정력을 측정합니다.',
    analyzes: [
      '언론 지배 프레임과 강도 (0~100)',
      '기사 프레임 vs 댓글 여론 간 괴리 (frameMismatch)',
      '기업 공식 메시지의 언론 반영도 (0~100)',
      '의제 주도권 판단 (company-led/media-led/public-led/contested)',
    ],
    recommended: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reason: '프레임 분류에 비용 효율적',
    },
    costTip: '병렬 실행 모듈로 처리 속도가 빠릅니다.',
    domain: 'corporate',
  },
  'csr-communication-gap': {
    name: 'CSR 공약 진정성 간극',
    description:
      'ESG/CSR 공약과 실제 온라인 여론 평가의 간극을 측정하고 그린워싱 위험을 진단합니다.',
    analyzes: [
      'E·S·G 차원별 기업 공약 vs 온라인 여론 신뢰도',
      '그린워싱(Greenwashing) 위험 수준',
      'CSR 이니셔티브별 평판 ROI',
      '전반적 CSR 신뢰도 점수 (0~100)',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '진정성 판단에 Claude 언어 이해력 활용',
    },
    costTip: 'ESG 공시 문서 컨텍스트가 많을수록 정확도가 높아집니다.',
    domain: 'corporate',
  },
  'reputation-recovery-simulation': {
    name: '평판 회복 시뮬레이션',
    description:
      'RepTrak·SCCT·SLO 이론을 종합하여 평판 회복 목표 달성 확률과 최적 회복 전략을 도출합니다.',
    analyzes: [
      '평판 회복 목표 달성 확률 (0~100%)',
      '회복 조건 met/partial/unmet 상태 진단',
      '회복 장애 요인 및 이해관계자별 완화 방안',
      '우선순위별 회복 전략 (immediate/short-term/long-term)',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '전략적 종합 추론에 최고 성능 필요',
    },
    costTip:
      '모든 선행 모듈 결과를 종합하므로 입력 토큰이 가장 많습니다. 최고 품질 모델 강력 권장.',
    domain: 'corporate',
  },

  // ── 헬스케어 도메인 Stage 4 ──
  'health-risk-perception': {
    name: '건강 위험 인식 분석',
    description:
      'Risk Perception Theory(Slovic, 1987)로 대중의 건강 위험 인식 편향(공포요소·미지성·정상화편향·가용성휴리스틱)을 분석하고, 전문가 평가와 대중 인식 간 간극을 측정합니다.',
    analyzes: [
      '대중 위험 인식 수준 (overestimated/accurate/underestimated)',
      '전문가 vs 대중 인식 간극 + 간극 크기 평가',
      '편향 유형별(dread-factor/unknown-risk/normalcy-bias) 데이터 패턴 식별',
      '확산 중인 오정보 목록 + 정정 우선순위',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '미묘한 위험 인식 편향 패턴 식별에 Claude 언어 이해력 필요',
    },
    costTip: '선행 sentiment-framing 결과를 활용하므로 독립 실행 시보다 정확도가 높습니다.',
    domain: 'healthcare',
  },
  'compliance-predictor': {
    name: '의료 순응도 예측',
    description:
      'Health Belief Model(Rosenstock, 1966) 6요인(취약성·심각성·이익·장벽·계기·자기효능감)으로 집단별 의료 순응 예측 확률과 장벽을 도출하고 개입 전략을 제안합니다.',
    analyzes: [
      '전체 의료 순응 예측 확률 (0~100%)',
      'HBM 6요인별 여론 신호 강도 및 근거',
      '집단별(환자/보호자/의료진/일반대중) 순응 확률 + 핵심 장벽',
      '순응도 향상 개입 전략 우선순위',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '행동 심리 모델 적용과 집단별 차별화 분석에 고급 추론 필요',
    },
    costTip: '선행 health-risk-perception 결과를 활용하여 더 정확한 집단별 예측이 가능합니다.',
    domain: 'healthcare',
  },

  // ── 금융 도메인 Stage 4 ──
  'market-sentiment-index': {
    name: '투자 심리 지수',
    description:
      'Baker & Wurgler(2006) 투자자 심리 지수와 Kahneman & Tversky(1979) 행동 재무학으로 공포/탐욕 스펙트럼과 투자자 편향을 측정합니다. ⚠️ 투자 자문 아님.',
    analyzes: [
      '투자 심리 지수 (0=극단적 공포 ~ 100=극단적 탐욕)',
      '투자자 집단별 (개인/기관/외국인) bullish/bearish 심리',
      '행동 재무학 편향 패턴 (손실 회피·앵커링·군집 행동·확증 편향)',
      '역발상 신호 vs 추세 추종 신호 분류',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '투자자 심리 편향 패턴 분류에 정교한 언어 이해 필요',
    },
    costTip: '심리 지수 산출은 댓글 분석 집중형 — 댓글 수집량이 많을수록 정확도 향상.',
    domain: 'finance',
  },
  'information-asymmetry': {
    name: '정보 비대칭 분석',
    description:
      'Bikhchandani et al.(1992) Information Cascade Theory로 정보 폭포 현상, 선행 지표, 루머 위험 영역을 식별합니다. ⚠️ 투자 자문 아님.',
    analyzes: [
      '기관-개인 정보 격차 수준 (high/medium/low)',
      '정보 폭포 시작점 및 확산 경로',
      '주류 미디어 반영 전 선행 지표 (커뮤니티 선행 신호)',
      '정보 공백 영역과 루머 위험도 및 공식 정보 권고',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '정보 폭포 패턴의 맥락적 이해와 선행/후행 신호 구분에 Claude 추론 필요',
    },
    costTip: '선행 의존 모듈이 많아 컨텍스트가 큼 — 경량 토큰 최적화 설정 권장.',
    domain: 'finance',
  },
  'catalyst-scenario': {
    name: '시장 시나리오',
    description:
      'De Long et al.(1990) Noise Trader Theory로 여론 기반 강세(Bull)/기본(Base)/약세(Bear) 3개 시나리오와 촉발 이벤트를 분석합니다. ⚠️ 투자 자문 아님.',
    analyzes: [
      'Bull / Base / Bear 3개 시나리오별 확률·촉발 이벤트·시장 내러티브',
      '현재 가장 가능성 높은 시나리오 선정',
      '심리 모멘텀 방향 (accelerating-bull / stable / accelerating-bear)',
      '현재 여론이 단기 노이즈인지 구조적 시그널인지 판단',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '복수 시나리오 분기 추론과 확률 배분에 Claude 추론 능력 활용',
    },
    costTip: '시나리오 생성은 창의적 추론 집중형 — 모델 품질이 결과 다양성에 직결됨.',
    domain: 'finance',
  },
  'investment-signal': {
    name: '투자 신호 종합',
    description:
      '금융 Stage 4 분석을 종합하여 여론 기반 단기(1~2주) / 중기(1~3개월) 투자 심리 신호를 도출합니다. ⚠️ 투자 자문 아님.',
    analyzes: [
      '종합 투자 신호 (strong-buy / buy / hold / sell / strong-sell) — 여론 기반',
      '신호 강도 (0~100) 및 구성 요소 가중치 분해',
      '단기 / 중기 신호 구분 및 근거',
      '극단적 심리 경고 및 역발상 신호 발동 조건',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '전체 금융 Stage 4 결과 종합 — 가장 많은 선행 컨텍스트를 처리하는 최종 모듈',
    },
    costTip:
      '모든 금융 Stage 4 선행 결과를 입력으로 받아 토큰이 가장 많습니다. 최고 품질 모델 강력 권장.',
    domain: 'finance',
  },
  // 스포츠 전용 (Stage 4)
  'performance-narrative': {
    name: '성과 내러티브 분석',
    description:
      'BIRGing/CORFing Theory(Cialdini et al., 1976)로 팀/선수 성적과 팬덤 여론 온도 간 상관관계를 분석하고, 지배적 서사 호(Arc)를 파악합니다.',
    analyzes: [
      'BIRGing/CORFing 패턴 측정 — 승/패 시 팬 반응 강도 변화',
      '서사 호 유형 식별: 부활/몰락/영웅/악역/라이벌리',
      '미디어 프레임 vs 팬 커뮤니티 프레임 차이 분석',
      '팬덤 여론 안정성 지수 및 모멘텀 방향',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '팬덤 심리 미묘한 뉘앙스 분석과 서사 호 식별에 고급 추론 필요',
    },
    costTip: '선행 macro-view·sentiment-framing 결과를 컨텍스트로 받아 토큰이 증가합니다.',
    domain: 'sports',
  },
  'season-outlook-prediction': {
    name: '시즌 전망 예측',
    description:
      'Sport Consumer Motivation Theory(Trail et al., 2003) 기반으로 팬 기대치 지수(0~100), 팬 참여도 예측, 주요 관전 포인트와 리스크·기회 요인을 종합합니다.',
    analyzes: [
      '팬 기대치 지수(0~100) — 성적 기대·스타 선수·라이벌전 종합',
      '팬 참여도 예측: 증가/유지/감소 추세 및 근거',
      '주요 관전 포인트 및 팬덤 내러티브 잠재력',
      '리스크 요인(확률·영향도) 및 기회 요인 목록',
    ],
    recommended: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '복합 예측 시나리오 생성과 선행 분석 결과 종합에 Claude 추론 활용',
    },
    costTip: '성과 내러티브 선행 결과를 포함하여 컨텍스트가 큽니다. 경량 토큰 최적화 권장.',
    domain: 'sports',
  },
};

// ── 모듈 분류 상수 ──

const COMMON_MODULES = [
  'macro-view',
  'segmentation',
  'sentiment-framing',
  'message-impact',
  'risk-map',
  'opportunity',
  'strategy',
  'final-summary',
];

const DOMAIN_MODULES: Record<string, string[]> = {
  political: ['approval-rating', 'frame-war', 'crisis-scenario', 'win-simulation'],
  policy: ['approval-rating', 'frame-war', 'crisis-scenario', 'win-simulation'],
  fandom: [
    'fan-loyalty-index',
    'fandom-narrative-war',
    'fandom-crisis-scenario',
    'release-reception-prediction',
  ],
  corporate: [
    'stakeholder-map',
    'esg-sentiment',
    'reputation-index',
    'crisis-type-classifier',
    'media-framing-dominance',
    'csr-communication-gap',
    'crisis-scenario',
    'reputation-recovery-simulation',
  ],
  pr: ['crisis-type-classifier', 'reputation-index', 'crisis-scenario', 'frame-war'],
  finance: [
    'market-sentiment-index',
    'information-asymmetry',
    'catalyst-scenario',
    'investment-signal',
  ],
  healthcare: ['health-risk-perception', 'compliance-predictor'],
  legal: ['reputation-index', 'frame-war', 'crisis-scenario', 'win-simulation'],
  education: ['approval-rating', 'frame-war', 'crisis-scenario', 'win-simulation'],
  'public-sector': ['approval-rating', 'frame-war', 'crisis-scenario', 'win-simulation'],
  sports: [
    'performance-narrative',
    'season-outlook-prediction',
    'fandom-crisis-scenario',
    'frame-war',
  ],
};

// 프리셋 → 도메인 매핑 (seed-presets와 동일)
const PRESET_DOMAIN_MAP: Record<string, { domain: string; title: string; category: string }> = {
  politics: { domain: 'political', title: '정치 캠프', category: '핵심 활용' },
  pr_crisis: { domain: 'pr', title: 'PR / 위기관리', category: '핵심 활용' },
  corporate_reputation: { domain: 'corporate', title: '기업 평판 관리', category: '핵심 활용' },
  entertainment: { domain: 'fandom', title: '연예인 / 기획사', category: '핵심 활용' },
  policy_research: { domain: 'policy', title: '정책 연구', category: '산업 특화' },
  finance: { domain: 'finance', title: '금융 / 투자', category: '산업 특화' },
  pharma_healthcare: { domain: 'healthcare', title: '제약 / 헬스케어', category: '산업 특화' },
  public_sector: { domain: 'public-sector', title: '지자체 / 공공기관', category: '산업 특화' },
  education: { domain: 'education', title: '대학 / 교육', category: '확장 영역' },
  sports: { domain: 'sports', title: '스포츠 / e스포츠', category: '확장 영역' },
  legal: { domain: 'legal', title: '법률 / 로펌', category: '확장 영역' },
  franchise_retail: { domain: 'political', title: '프랜차이즈 / 유통', category: '확장 영역' },
};

const CATEGORY_ORDER = ['핵심 활용', '산업 특화', '확장 영역'];

function getModulesForPreset(presetSlug?: string): string[] {
  if (!presetSlug) {
    // 전체 목록: 중복 제거 (crisis-scenario 등이 여러 도메인에 존재)
    const allDomainModules = [
      ...DOMAIN_MODULES.political,
      ...DOMAIN_MODULES.policy,
      ...DOMAIN_MODULES.fandom,
      ...DOMAIN_MODULES.corporate,
      ...DOMAIN_MODULES.pr,
      ...DOMAIN_MODULES.finance,
      ...DOMAIN_MODULES.healthcare,
      ...DOMAIN_MODULES.legal,
      ...DOMAIN_MODULES.education,
      ...DOMAIN_MODULES['public-sector'],
      ...DOMAIN_MODULES.sports,
    ];
    return [...COMMON_MODULES, ...Array.from(new Set(allDomainModules))];
  }
  const domain = PRESET_DOMAIN_MAP[presetSlug]?.domain ?? 'political';
  return [...COMMON_MODULES, ...(DOMAIN_MODULES[domain] ?? DOMAIN_MODULES.political)];
}

// ── 프로바이더 표시명 ──

function getProviderLabel(provider: string): string {
  return PROVIDER_REGISTRY[provider as AIProvider]?.displayName ?? provider;
}

// ── 타입 ──

type ModelSettingItem = {
  moduleName: string;
  provider: string;
  model: string;
  isCustom: boolean;
  source?: 'preset' | 'global' | 'default';
};

type PresetInfo = {
  id: string;
  slug: string;
  category: string;
  domain: string;
  title: string;
  icon: string;
  highlight: string | null;
};

// ── 메인 컴포넌트 ──

export function ModelSettings() {
  const queryClient = useQueryClient();
  const [selectedPresetSlug, setSelectedPresetSlug] = useState<string | null>(null);

  // 설정 목록 (프리셋 필터)
  const { data: settings, isLoading } = useQuery({
    queryKey: [['settings', 'list', selectedPresetSlug]],
    queryFn: () =>
      trpcClient.settings.list.query(
        selectedPresetSlug ? { presetSlug: selectedPresetSlug } : undefined,
      ),
  });

  // 프리셋 목록
  const { data: presets } = useQuery({
    queryKey: ['presets', 'enabled'],
    queryFn: () => trpcClient.presets.listEnabled.query(),
    staleTime: 5 * 60 * 1000,
  });

  // 시나리오 프리셋 목록
  const { data: scenarioPresets } = useQuery({
    queryKey: [['settings', 'modelScenarios', 'list']],
    queryFn: () => trpcClient.settings.modelScenarios.list.query(),
  });

  // API 키
  const { data: providerKeysList } = useQuery({
    queryKey: [['settings', 'providerKeys', 'list']],
    queryFn: () => trpcClient.settings.providerKeys.list.query(),
  });

  // 등록된 프로바이더/모델 목록
  const { availableProviders, providerModels } = useMemo(() => {
    if (!providerKeysList || providerKeysList.length === 0) {
      return { availableProviders: [] as string[], providerModels: {} as Record<string, string[]> };
    }
    const MAIN_MODEL_PATTERNS = [
      /^gpt-4/,
      /^gpt-5/,
      /^gpt-3\.5/,
      /^o[1-9]/,
      /^claude/,
      /^gemini/,
      /^qwen/,
      /^llama/,
      /^mistral/,
      /^deepseek/,
      /^codestral/,
      /^command/,
    ];
    function isMainModel(model: string): boolean {
      return MAIN_MODEL_PATTERNS.some((p) => p.test(model));
    }
    const modelsMap: Record<string, Set<string>> = {};
    for (const key of providerKeysList) {
      if (!key.isActive) continue;
      if (!modelsMap[key.providerType]) modelsMap[key.providerType] = new Set();
      const models = (key as any).availableModels as string[] | null;
      if (models?.length) {
        for (const m of models) {
          if (isMainModel(m)) modelsMap[key.providerType].add(m);
        }
      }
      if (key.selectedModel) modelsMap[key.providerType].add(key.selectedModel);
    }
    const providers = Object.keys(modelsMap).sort();
    const models: Record<string, string[]> = {};
    for (const [p, s] of Object.entries(modelsMap)) models[p] = [...s].sort();
    return { availableProviders: providers, providerModels: models };
  }, [providerKeysList]);

  // 뮤테이션들
  const updateMutation = useMutation({
    mutationFn: (input: { moduleName: string; provider: string; model: string }) =>
      trpcClient.settings.update.mutate(input as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success('모델 설정이 변경되었습니다');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '설정 변경에 실패했습니다');
    },
  });

  const updatePresetMutation = useMutation({
    mutationFn: (input: {
      presetSlug: string;
      moduleName: string;
      provider: string;
      model: string;
    }) => trpcClient.settings.updatePreset.mutate(input as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success('프리셋 모델 설정이 변경되었습니다');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '설정 변경에 실패했습니다');
    },
  });

  const resetPresetMutation = useMutation({
    mutationFn: (input: { presetSlug: string; moduleName: string }) =>
      trpcClient.settings.resetPresetModel.mutate(input as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success('기본 설정으로 복원되었습니다');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '복원에 실패했습니다');
    },
  });

  const resetMutation = useMutation({
    mutationFn: (moduleName: string) => trpcClient.settings.resetToDefault.mutate({ moduleName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success('기본값으로 복원되었습니다');
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '복원에 실패했습니다');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (input: { provider: string; model: string; presetSlug?: string }) =>
      trpcClient.settings.bulkUpdate.mutate(input as any),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success(`전체 ${data.updated}개 모듈의 모델이 변경되었습니다`);
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? '일괄 변경에 실패했습니다');
    },
  });

  const scenarioMutation = useMutation({
    mutationFn: (input: { presetId: string; targetPresetSlug?: string }) =>
      trpcClient.settings.modelScenarios.applyPreset.mutate(input as any),
    onSuccess: (data) => {
      setScenarioDialogOpen(null);
      queryClient.invalidateQueries({ queryKey: [['settings', 'list']] });
      toast.success(`"${data.presetName}" 시나리오가 적용되었습니다 (${data.updated}개 모듈)`);
    },
    onError: (error: { message?: string }) => {
      setScenarioDialogOpen(null);
      toast.error(error.message ?? '시나리오 적용에 실패했습니다');
    },
  });

  const [bulkProvider, setBulkProvider] = useState<string>('');
  const [bulkModel, setBulkModel] = useState<string>('');
  const [scenarioDialogOpen, setScenarioDialogOpen] = useState<string | null>(null);

  // 표시할 모듈 필터링
  const visibleModules = useMemo(
    () => getModulesForPreset(selectedPresetSlug ?? undefined),
    [selectedPresetSlug],
  );
  const currentDomain = selectedPresetSlug ? PRESET_DOMAIN_MAP[selectedPresetSlug]?.domain : null;

  // 프리셋을 카테고리별로 그룹화
  const presetGroups = useMemo(() => {
    if (!presets) return {};
    const map: Record<string, PresetInfo[]> = {};
    for (const p of presets) {
      const info = PRESET_DOMAIN_MAP[p.slug];
      if (!info) continue;
      const cat = info.category;
      if (!map[cat]) map[cat] = [];
      map[cat].push({
        id: p.id,
        slug: p.slug,
        category: cat,
        domain: info.domain,
        title: info.title,
        icon: p.icon,
        highlight: p.highlight,
      });
    }
    return map;
  }, [presets]);

  const handleProviderChange = (item: ModelSettingItem, newProvider: string | null) => {
    if (!newProvider) return;
    const firstModel = providerModels[newProvider]?.[0] ?? '';
    if (selectedPresetSlug) {
      updatePresetMutation.mutate({
        presetSlug: selectedPresetSlug,
        moduleName: item.moduleName,
        provider: newProvider,
        model: firstModel,
      });
    } else {
      updateMutation.mutate({
        moduleName: item.moduleName,
        provider: newProvider,
        model: firstModel,
      });
    }
  };

  const handleModelChange = (item: ModelSettingItem, newModel: string | null) => {
    if (!newModel) return;
    if (selectedPresetSlug) {
      updatePresetMutation.mutate({
        presetSlug: selectedPresetSlug,
        moduleName: item.moduleName,
        provider: item.provider,
        model: newModel,
      });
    } else {
      updateMutation.mutate({
        moduleName: item.moduleName,
        provider: item.provider,
        model: newModel,
      });
    }
  };

  const handleReset = (item: ModelSettingItem) => {
    if (selectedPresetSlug) {
      resetPresetMutation.mutate({ presetSlug: selectedPresetSlug, moduleName: item.moduleName });
    } else {
      resetMutation.mutate(item.moduleName);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        설정 불러오는 중...
      </div>
    );
  }

  if (!settings || settings.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">설정을 불러올 수 없습니다.</div>;
  }

  const isPending =
    updateMutation.isPending ||
    updatePresetMutation.isPending ||
    resetMutation.isPending ||
    resetPresetMutation.isPending ||
    bulkUpdateMutation.isPending ||
    scenarioMutation.isPending;
  const hasProviders = availableProviders.length > 0;
  const bulkModels = bulkProvider ? (providerModels[bulkProvider] ?? []) : [];

  return (
    <div className="space-y-3">
      {/* API 키 없음 안내 */}
      {!hasProviders && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">등록된 API 키가 없습니다</p>
            <p className="mt-1">
              위의 <strong>API 키 관리</strong> 탭에서 프로바이더를 등록하고 모델을 선택해주세요.
            </p>
          </div>
        </div>
      )}

      {/* 프리셋 선택 탭바 */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">분석 유형</span>
          <span className="text-xs text-muted-foreground">— 유형별로 다른 AI 모델 설정</span>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-1 pb-1">
            {/* 기본(전체) 버튼 */}
            <button
              onClick={() => setSelectedPresetSlug(null)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                selectedPresetSlug === null
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              전체 모듈
            </button>
            {/* 카테고리별 프리셋 */}
            {CATEGORY_ORDER.map((cat) => {
              const group = presetGroups[cat];
              if (!group?.length) return null;
              return (
                <div key={cat} className="flex items-center gap-1 shrink-0">
                  <span className="text-muted-foreground/50 text-xs select-none">|</span>
                  {group.map((p) => {
                    const isActive = selectedPresetSlug === p.slug;
                    const isFandom = p.domain === 'fandom';
                    return (
                      <button
                        key={p.slug}
                        onClick={() => setSelectedPresetSlug(isActive ? null : p.slug)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                          isActive
                            ? isFandom
                              ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                              : 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <span>{p.title}</span>
                        {isFandom ? (
                          <Heart className="h-3 w-3 text-violet-500" />
                        ) : (
                          <Shield className="h-3 w-3 text-blue-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        {selectedPresetSlug && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              선택:{' '}
              <strong className="text-foreground">
                {PRESET_DOMAIN_MAP[selectedPresetSlug]?.title}
              </strong>
            </span>
            <span>
              (
              {(
                {
                  fandom: '팬덤',
                  policy: '정책',
                  corporate: '기업',
                  pr: 'PR',
                  finance: '금융',
                  healthcare: '헬스케어',
                } as Record<string, string>
              )[PRESET_DOMAIN_MAP[selectedPresetSlug]?.domain] ?? '정치'}{' '}
              도메인 — {getModulesForPreset(selectedPresetSlug).length}개 모듈)
            </span>
            <button
              onClick={() => setSelectedPresetSlug(null)}
              className="ml-1 text-primary hover:underline"
            >
              전체 보기
            </button>
          </div>
        )}
      </div>

      {/* 시나리오 프리셋 */}
      {scenarioPresets && scenarioPresets.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">시나리오 프리셋</span>
            <span className="text-xs text-muted-foreground">— 모듈별 최적 모델을 한 번에 적용</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {scenarioPresets.map((preset) => {
              const isRecommended = preset.id === 'scenario-b';
              const requiredProviders = new Set(
                Object.values(preset.modules).map((m: any) => m.provider),
              );
              const registeredProviders = new Set(
                providerKeysList?.filter((k) => k.isActive).map((k) => k.providerType) ?? [],
              );
              const missingProviders = [...requiredProviders].filter(
                (p) => !registeredProviders.has(p),
              );
              return (
                <div
                  key={preset.id}
                  className={`relative rounded-lg border p-3 ${isRecommended ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
                >
                  {isRecommended && (
                    <Badge className="absolute -top-2 right-2 text-[10px]">추천</Badge>
                  )}
                  <div className="flex items-center gap-1.5 mb-1">
                    {isRecommended ? (
                      <Zap className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{preset.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                    {preset.description}
                  </p>
                  {missingProviders.length > 0 && (
                    <div className="flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 mb-2">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        미등록: {missingProviders.map((p) => getProviderLabel(p)).join(', ')}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">
                      {preset.estimatedCost}
                    </span>
                    <AlertDialog
                      open={scenarioDialogOpen === preset.id}
                      onOpenChange={(open) => setScenarioDialogOpen(open ? preset.id : null)}
                    >
                      <AlertDialogTrigger
                        className={`inline-flex items-center justify-center rounded-md text-xs h-7 px-3 ${
                          isRecommended
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
                        } ${isPending ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                      >
                        적용
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>시나리오 적용</AlertDialogTitle>
                          <AlertDialogDescription>
                            &quot;{preset.name}&quot; 시나리오를{' '}
                            {selectedPresetSlug
                              ? `"${PRESET_DOMAIN_MAP[selectedPresetSlug]?.title}" 프리셋에`
                              : '전체 모듈에'}{' '}
                            적용하시겠습니까?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.preventDefault();
                              scenarioMutation.mutate({
                                presetId: preset.id,
                                targetPresetSlug: selectedPresetSlug ?? undefined,
                              });
                            }}
                          >
                            {scenarioMutation.isPending ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : null}
                            적용
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 전체 일괄 변경 */}
      {hasProviders && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ChevronsUpDown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">전체 일괄 변경</span>
            <span className="text-xs text-muted-foreground">
              —{' '}
              {selectedPresetSlug
                ? `"${PRESET_DOMAIN_MAP[selectedPresetSlug]?.title}" 프리셋에만`
                : '모든 모듈에'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={bulkProvider}
              onValueChange={(val) => {
                setBulkProvider(val ?? '');
                setBulkModel('');
              }}
              disabled={isPending}
            >
              <SelectTrigger className="w-[130px]" size="sm">
                <SelectValue placeholder="프로바이더" />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {getProviderLabel(provider)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={bulkModel}
              onValueChange={(val) => setBulkModel(val ?? '')}
              disabled={isPending || bulkModels.length === 0}
            >
              <SelectTrigger className="flex-1" size="sm">
                <SelectValue
                  placeholder={bulkModels.length > 0 ? '모델 선택' : '프로바이더를 먼저 선택'}
                />
              </SelectTrigger>
              <SelectContent>
                {bulkModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={isPending || !bulkProvider || !bulkModel}
              onClick={() => {
                bulkUpdateMutation.mutate(
                  {
                    provider: bulkProvider,
                    model: bulkModel,
                    presetSlug: selectedPresetSlug ?? undefined,
                  },
                  {
                    onSuccess: () => {
                      setBulkProvider('');
                      setBulkModel('');
                    },
                  },
                );
              }}
            >
              {bulkUpdateMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              전체 적용
            </Button>
          </div>
        </div>
      )}

      {/* 모듈 목록 */}
      {(() => {
        const settingsMap = new Map(settings.map((s: ModelSettingItem) => [s.moduleName, s]));
        const commonVisible = visibleModules.filter((m) => COMMON_MODULES.includes(m));
        const domainVisible = visibleModules.filter((m) => !COMMON_MODULES.includes(m));

        return (
          <div className="space-y-4">
            {/* 공통 모듈 */}
            {commonVisible.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  공통 모듈
                </p>
                {commonVisible.map((moduleName) => {
                  const item = settingsMap.get(moduleName);
                  if (!item) return null;
                  return (
                    <ModuleCard
                      key={moduleName}
                      item={item}
                      hasProviders={hasProviders}
                      availableProviders={availableProviders}
                      currentModels={providerModels[item.provider] ?? []}
                      isPending={isPending}
                      onProviderChange={handleProviderChange}
                      onModelChange={handleModelChange}
                      onReset={handleReset}
                    />
                  );
                })}
              </div>
            )}
            {/* 도메인 전용 모듈 */}
            {domainVisible.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{
                      color: currentDomain === 'fandom' ? 'rgb(139,92,246)' : 'hsl(var(--primary))',
                    }}
                  >
                    {(
                      {
                        fandom: '팬덤 전용',
                        policy: '정책 전용',
                        corporate: '기업 전용',
                        pr: 'PR 전용',
                        finance: '금융 전용',
                        healthcare: '헬스케어 전용',
                      } as Record<string, string>
                    )[currentDomain ?? ''] ?? '정치 전용'}{' '}
                    모듈
                  </p>
                  <div className="flex-1 border-t" />
                </div>
                {domainVisible.map((moduleName) => {
                  const item = settingsMap.get(moduleName);
                  if (!item) return null;
                  return (
                    <ModuleCard
                      key={moduleName}
                      item={item}
                      hasProviders={hasProviders}
                      availableProviders={availableProviders}
                      currentModels={providerModels[item.provider] ?? []}
                      isPending={isPending}
                      onProviderChange={handleProviderChange}
                      onModelChange={handleModelChange}
                      onReset={handleReset}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── 모듈 카드 ──

function ModuleCard({
  item,
  hasProviders,
  availableProviders,
  currentModels,
  isPending,
  onProviderChange,
  onModelChange,
  onReset,
}: {
  item: ModelSettingItem;
  hasProviders: boolean;
  availableProviders: string[];
  currentModels: string[];
  isPending: boolean;
  onProviderChange: (item: ModelSettingItem, provider: string | null) => void;
  onModelChange: (item: ModelSettingItem, model: string | null) => void;
  onReset: (item: ModelSettingItem) => void;
}) {
  const isModelAvailable = currentModels.includes(item.model);
  const meta = MODULE_META[item.moduleName];
  const domain = meta?.domain;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{meta?.name ?? item.moduleName}</span>
          {domain && (
            <Badge
              className={`text-[9px] ${domain === 'fandom' ? 'bg-violet-500/15 text-violet-500 border-violet-500/20' : domain === 'corporate' ? 'bg-sky-500/15 text-sky-600 border-sky-500/20' : domain === 'pr' ? 'bg-orange-500/15 text-orange-600 border-orange-500/20' : domain === 'policy' ? 'bg-indigo-500/15 text-indigo-600 border-indigo-500/20' : 'bg-blue-500/15 text-blue-500 border-blue-500/20'}`}
            >
              {(
                {
                  fandom: '팬덤',
                  policy: '정책',
                  corporate: '기업',
                  pr: 'PR',
                  finance: '금융',
                  healthcare: '헬스케어',
                } as Record<string, string>
              )[domain] ?? '정치'}
            </Badge>
          )}
          <span className="text-xs font-mono text-muted-foreground">{item.moduleName}</span>
          <ModuleHelpPopover moduleName={item.moduleName} />
          {item.source ? (
            sourceBadge(item.source)
          ) : item.isCustom ? (
            <Badge variant="secondary" className="text-[10px]">
              사용자 설정
            </Badge>
          ) : null}
        </div>
        {(item.isCustom || item.source === 'preset') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            disabled={isPending}
            onClick={() => onReset(item)}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            {item.source === 'preset' ? '글로벌로' : '기본값'}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={hasProviders && availableProviders.includes(item.provider) ? item.provider : ''}
          onValueChange={(val) => onProviderChange(item, val)}
          disabled={isPending || !hasProviders}
        >
          <SelectTrigger className="w-[130px]" size="sm">
            <SelectValue placeholder={hasProviders ? '프로바이더' : '키 없음'} />
          </SelectTrigger>
          <SelectContent>
            {availableProviders.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {getProviderLabel(provider)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={isModelAvailable ? item.model : ''}
          onValueChange={(val) => onModelChange(item, val)}
          disabled={isPending || !hasProviders || currentModels.length === 0}
        >
          <SelectTrigger className="flex-1" size="sm">
            <SelectValue placeholder={currentModels.length > 0 ? '모델 선택' : '모델 없음'} />
          </SelectTrigger>
          <SelectContent>
            {currentModels.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {item.isCustom &&
        hasProviders &&
        (!availableProviders.includes(item.provider) || !isModelAvailable) && (
          <p className="text-xs text-amber-500">
            현재 설정된{' '}
            {!availableProviders.includes(item.provider)
              ? `프로바이더(${item.provider})`
              : `모델(${item.model})`}
            이(가) API 키 관리에 등록되지 않았습니다.
          </p>
        )}
    </div>
  );
}

function sourceBadge(source: string) {
  if (source === 'preset')
    return (
      <Badge className="text-[10px] bg-violet-500/15 text-violet-500 border-violet-500/20">
        프리셋
      </Badge>
    );
  if (source === 'global')
    return (
      <Badge variant="secondary" className="text-[10px]">
        글로벌
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      기본
    </Badge>
  );
}

// ── 도움말 팝오버 ──

function ModuleHelpPopover({ moduleName }: { moduleName: string }) {
  const meta = MODULE_META[moduleName];
  if (!meta) return null;

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary">
        <HelpCircle className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0">
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{meta.description}</p>
          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">분석 항목</p>
            <ul className="space-y-1">
              {meta.analyzes.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md bg-muted/50 p-2.5">
            <p className="text-xs font-semibold text-foreground mb-1">추천 모델</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{meta.recommended.provider}</span>
              {' / '}
              <span className="font-mono text-[11px]">{meta.recommended.model}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">{meta.recommended.reason}</p>
          </div>
          <div className="flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
            <span className="text-xs leading-none mt-0.5">💡</span>
            <p className="text-xs text-muted-foreground leading-relaxed">{meta.costTip}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
