export const PRICING = [
  {
    name: 'Starter',
    price: '49',
    unit: '만원/월',
    description: '소규모 팀과 컨설턴트',
    features: [
      '분석 대상 1개',
      '3개 소스 수집',
      '기본 8개 모듈 (Stage 1+2)',
      '월 4회 분석',
      '팀원 3명',
    ],
    cta: '7일 무료 체험',
    popular: false,
  },
  {
    name: 'Professional',
    price: '129',
    unit: '만원/월',
    description: 'PR 에이전시와 기업 홍보팀',
    features: [
      '분석 대상 3개',
      '전체 6개 소스 수집',
      '14개 전체 모듈',
      '월 12회 분석',
      '팀원 10명',
      'PDF 리포트 내보내기',
    ],
    cta: '7일 무료 체험',
    popular: true,
  },
  {
    name: 'Campaign',
    price: '249',
    unit: '만원/월',
    description: '정치 캠프와 대규모 조직',
    features: [
      '분석 대상 5개',
      '무제한 분석',
      '14개 전체 모듈',
      'API 접근',
      '전담 CSM',
      '맞춤 분석 모듈',
    ],
    cta: '상담 신청',
    popular: false,
  },
];

export const COMPARISONS = [
  { label: '모니터링 주니어 인건비', cost: '250~350만원/월', scope: '수집만' },
  { label: '소셜 리스닝 도구', cost: '50~300만원/월', scope: '수집 + 감정 분석' },
  {
    label: 'AI SignalCraft',
    cost: '129만원/월',
    scope: '수집 + 분석 + 전략',
    highlight: true as const,
  },
];
