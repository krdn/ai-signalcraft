// ai-gateway 메타데이터 re-export — 서버 의존성 없는 순수 메타 정보
// web은 이 파일을 통해 프로바이더 레지스트리에 접근
export {
  PROVIDER_REGISTRY,
  AI_PROVIDER_VALUES,
  getProvidersByAccess,
  type AIProvider,
  type AccessMethod,
  type ProviderMeta,
} from '@ai-signalcraft/ai-gateway/meta';
