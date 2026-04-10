/**
 * 도메인 추상화 타입 정의
 * 정치/팬덤 등 분석 도메인별 프롬프트 설정과 모듈 구성을 관리한다.
 * 새 분석 유형 추가 시:
 *   1. AnalysisDomain 유니언에 문자열 추가
 *   2. domains/ 아래에 새 설정 파일 생성
 *   3. (필요시) modules/<domain>/ 아래에 전용 모듈 생성
 *   4. registry.ts에 등록
 */

/** 지원 분석 도메인 */
export type AnalysisDomain = 'political' | 'fandom';

/** 도메인별 집단 분류 라벨 */
export interface SegmentationLabels {
  /** 집단 분류 enum 값 목록 */
  types: string[];
  /** 각 타입별 판별 기준 설명 */
  criteria: Record<string, string>;
}

/** 모듈별 도메인 프롬프트 오버라이드 */
export interface ModulePromptOverride {
  /** 시스템 프롬프트 전체 (기본 모듈의 buildSystemPrompt 대체) */
  systemPrompt: string;
}

/** 도메인별 Stage 4 모듈 구성 */
export interface Stage4Config {
  /** 병렬 실행 모듈명 */
  parallel: string[];
  /** 순차 실행 모듈명 (의존 체인) */
  sequential: string[];
}

/** 도메인 설정 */
export interface DomainConfig {
  /** 도메인 식별자 */
  id: AnalysisDomain;
  /** 표시명 */
  displayName: string;

  /** 모듈 시스템 프롬프트에 공통 삽입할 플랫폼 지식 블록 */
  platformKnowledge: string;

  /** impactScore / negativeScore 평가 기준 앵커 */
  impactScoreAnchor: string;

  /** 프레임 강도 기준 앵커 (0~100) */
  frameStrengthAnchor: string;

  /** 확률 판단 기준 앵커 */
  probabilityAnchor: string;

  /** 집단 분류 체계 */
  segmentationLabels: SegmentationLabels;

  /** 모듈별 프롬프트 오버라이드 (moduleName → override) */
  modulePrompts: Partial<Record<string, ModulePromptOverride>>;

  /** Stage 4 모듈 구성 (도메인별로 다른 모듈 실행) */
  stage4: Stage4Config;

  /** 리포트 생성기 시스템 프롬프트 */
  reportSystemPrompt: string;

  /** 리포트 섹션 구조 템플릿 */
  reportSectionTemplate: string;
}
