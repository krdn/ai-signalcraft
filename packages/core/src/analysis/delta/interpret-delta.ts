// LLM 델타 해석 — qualitative interpretation 생성
import {
  analyzeStructured,
  normalizeUsage,
  type AIGatewayOptions,
} from '@krdn/ai-analysis-kit/gateway';
import {
  QualitativeInterpretationSchema,
  type QualitativeInterpretation,
  type QuantitativeDelta,
} from './delta-schema';

export async function interpretDelta(
  keyword: string,
  quantDelta: QuantitativeDelta,
  currentDateRange: { start: string; end: string },
  previousDateRange: { start: string; end: string },
): Promise<{
  interpretation: QualitativeInterpretation;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    provider: string;
    model: string;
  };
}> {
  const systemPrompt = `당신은 여론 변화 분석 전문가입니다.
주어진 정량 데이터를 바탕으로 두 기간 사이의 여론 변화를 해석하고, 핵심 동인과 위험 신호, 기회를 도출합니다.
분석은 한국어로 작성하며, 구체적이고 실행 가능한 인사이트를 제공합니다.`;

  const prompt = `키워드: "${keyword}"

분석 기간 비교:
- 이전 기간: ${previousDateRange.start} ~ ${previousDateRange.end}
- 현재 기간: ${currentDateRange.start} ~ ${currentDateRange.end}

정량 변화 데이터:
${JSON.stringify(quantDelta, null, 2)}

위 데이터를 바탕으로 두 기간 사이의 여론 변화를 분석해주세요.
- summary: 변화를 2~3문장으로 요약
- keyDrivers: 변화의 핵심 동인 (3~5개)
- riskAlerts: 새로 부상한 위험 신호 (없으면 빈 배열)
- opportunities: 새로 발견된 기회 (없으면 빈 배열)`;

  const gatewayOptions: AIGatewayOptions = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    maxOutputTokens: 2048,
    timeoutMs: 60000,
    systemPrompt,
  };

  const { object, usage } = await analyzeStructured(
    prompt,
    QualitativeInterpretationSchema,
    gatewayOptions,
  );

  const normalizedUsage = normalizeUsage(usage as Record<string, unknown>);

  return {
    interpretation: object,
    usage: {
      inputTokens: normalizedUsage.inputTokens,
      outputTokens: normalizedUsage.outputTokens,
      totalTokens: normalizedUsage.totalTokens,
      provider: gatewayOptions.provider ?? 'anthropic',
      model: gatewayOptions.model ?? 'claude-sonnet-4-6',
    },
  };
}
