export const PARTNER_PROGRAMS = [
  {
    type: 'reseller' as const,
    name: '리셀러',
    subtitle: '단순 영업 파트너',
    commissionRange: '10~20%',
    commissionBasis: '고객 1년 매출 기준',
    description: '고객을 소개하고 계약이 성사되면 수수료를 받습니다. 영업 활동에만 집중하세요.',
    features: [
      '고객 소개만으로 수수료 발생',
      '전용 파트너 대시보드 제공',
      '실시간 고객·수수료 추적',
      '마케팅 자료 및 제안서 지원',
    ],
    targetAudience: 'IT 컨설턴트, 프리랜서, 마케팅 전문가, 세일즈 에이전트',
    highlight: false,
  },
  {
    type: 'partner' as const,
    name: '사업 파트너',
    subtitle: '사업 제휴 파트너',
    commissionRange: '10~50%',
    commissionBasis: '담당 업무 비중에 따라 협의',
    description:
      '영업관리·마케팅·납품·고객관리·온프레미스 구축까지 직접 담당하며 높은 수수료를 받습니다.',
    features: [
      '리셀러 혜택 전체 포함',
      '영업관리·마케팅·납품 직접 수행',
      '고객사 기술 지원 및 온프레미스 구축',
      '업무 비중에 따른 유연한 수수료율',
      '전담 기술 지원 및 공동 영업',
    ],
    targetAudience: 'SI 업체, IT 에이전시, 컨설팅 펌, 솔루션 리셀러',
    highlight: true,
  },
];

export const PARTNER_BENEFITS = [
  { label: '초기 비용', value: '0원', description: '가입비·보증금 없음' },
  { label: '정산 주기', value: '월 1회', description: '매월 확정 후 익월 정산' },
  { label: '계약 기간', value: '1년~', description: '자동 갱신, 언제든 해지 가능' },
  { label: '지원', value: '전담 매니저', description: '기술·영업 자료 전면 지원' },
];

export const PARTNER_PROCESS = [
  { step: '1', title: '신청', description: '온라인 신청 폼 작성 (5분)' },
  { step: '2', title: '심사', description: '담당자 검토 및 전화 상담' },
  { step: '3', title: '계약', description: '수수료율 협의 및 계약 체결' },
  { step: '4', title: '영업 시작', description: '대시보드 접근 및 영업 활동 개시' },
];
