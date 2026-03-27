// SignalCraft 계층형 에러 클래스
// 에러 코드와 컨텍스트를 포함하여 구조화된 에러 처리 지원

/**
 * 기본 에러 클래스
 * 모든 SignalCraft 에러의 부모 클래스
 */
export class SignalCraftError extends Error {
  readonly errorCode: string;
  readonly context?: Record<string, unknown>;

  constructor(message: string, errorCode = 'SIGNALCRAFT_ERROR', context?: Record<string, unknown>) {
    super(message);
    this.name = 'SignalCraftError';
    this.errorCode = errorCode;
    this.context = context;
  }
}

/** 수집(Collection) 단계 에러 */
export class CollectionError extends SignalCraftError {
  constructor(message: string, errorCode = 'COLLECTION_ERROR', context?: Record<string, unknown>) {
    super(message, errorCode, context);
    this.name = 'CollectionError';
  }
}

/** 분석(Analysis) 단계 에러 */
export class AnalysisError extends SignalCraftError {
  constructor(message: string, errorCode = 'ANALYSIS_ERROR', context?: Record<string, unknown>) {
    super(message, errorCode, context);
    this.name = 'AnalysisError';
  }
}

/** 파이프라인(Pipeline) 단계 에러 */
export class PipelineError extends SignalCraftError {
  constructor(message: string, errorCode = 'PIPELINE_ERROR', context?: Record<string, unknown>) {
    super(message, errorCode, context);
    this.name = 'PipelineError';
  }
}

/** 프로바이더(Provider) 관련 에러 */
export class ProviderError extends SignalCraftError {
  constructor(message: string, errorCode = 'PROVIDER_ERROR', context?: Record<string, unknown>) {
    super(message, errorCode, context);
    this.name = 'ProviderError';
  }
}
