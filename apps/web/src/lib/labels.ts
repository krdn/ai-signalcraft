/**
 * 한국어 UI 라벨 중앙 관리
 * 코드는 영문, UI는 한국어로 일관성 유지
 *
 * 규칙:
 *   - UI에 표시되는 모든 용어는 이 파일에서 관리
 *   - 하드코딩된 "고객", "파트너" 등은 여기로 이전
 *   - 변경 시 전체 앱에 즉시 반영됨
 */

// ========= 엔티티 라벨 =========
export const ENTITY = {
  customer: '고객사',
  customerContact: '담당자',
  lead: '리드',
  user: '사용자',
  workspace: '워크스페이스',
  channelPartner: '사업 파트너',
  referralPartner: '추천 파트너',
  staff: '영업팀',
  trial: '체험',
  superAdmin: '시스템 관리자',
} as const;

// ========= 시스템 역할 라벨 =========
export const SYSTEM_ROLE_LABELS: Record<string, string> = {
  super_admin: ENTITY.superAdmin,
  staff: ENTITY.staff,
  external: '외부 사용자',
};

// ========= 관계(affiliation) 타입 라벨 =========
export const AFFILIATION_TYPE_LABELS: Record<string, string> = {
  customer_member: `${ENTITY.customer} 멤버`,
  channel_partner: ENTITY.channelPartner,
  referral_partner: ENTITY.referralPartner,
  sales_rep: ENTITY.staff,
};

// ========= 고객사 상태 라벨 =========
export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  trial: '체험 중',
  active: '계약 중',
  paused: '일시 중지',
  churned: '이탈',
};

// ========= 고객사 획득 출처 라벨 =========
export const ACQUISITION_SOURCE_LABELS: Record<string, string> = {
  direct: '직접 영업',
  channel_partner: ENTITY.channelPartner,
  referral_partner: ENTITY.referralPartner,
  organic: '자연 유입',
};

// ========= 파트너 타입 라벨 =========
export const PARTNER_TYPE_LABELS: Record<string, string> = {
  // 신규 (커스터머스 스키마)
  channel: ENTITY.channelPartner,
  referral: ENTITY.referralPartner,
  // 레거시 (partner_contracts.program_type)
  partner: ENTITY.channelPartner,
  reseller: ENTITY.referralPartner,
};

// ========= 리드 스테이지 라벨 =========
export const LEAD_STAGE_LABELS: Record<string, string> = {
  lead: '신규 리드',
  contacted: '접촉',
  demo: '데모',
  proposal: '제안',
  negotiation: '협상',
  closed_won: '성사',
  closed_lost: '실패',
};

// ========= 레거시 role 라벨 (Phase 6 제거 예정) =========
export const LEGACY_ROLE_LABELS: Record<string, string> = {
  admin: ENTITY.superAdmin,
  leader: '팀 리더',
  sales: ENTITY.staff,
  partner: ENTITY.channelPartner,
  member: '일반 사용자',
  demo: ENTITY.trial,
};
