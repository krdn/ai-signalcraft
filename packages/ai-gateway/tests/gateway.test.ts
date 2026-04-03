import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod'; // eslint-disable-line import-x/order

// mock 함수 정의
const mockGenerateText = vi.fn();
const mockGenerateObject = vi.fn();

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

const mockCreateAnthropic = vi.fn();
const mockCreateOpenAI = vi.fn();
const mockCreateGoogleGenerativeAI = vi.fn();

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: (...args: unknown[]) => mockCreateAnthropic(...args),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (...args: unknown[]) => mockCreateOpenAI(...args),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: (...args: unknown[]) => mockCreateGoogleGenerativeAI(...args),
}));

// mock 이후 import
import { analyzeText, analyzeStructured, getModel } from '../src/gateway';

describe('getModel', () => {
  const mockAnthropicModel = 'anthropic-model-instance';
  const mockOpenAIModel = 'openai-model-instance';
  const mockChatModel = 'chat-model-instance';

  beforeEach(() => {
    vi.clearAllMocks();

    // anthropic: client(modelName) 반환
    mockCreateAnthropic.mockReturnValue(vi.fn(() => mockAnthropicModel));

    // openai: client(modelName) 반환, client.chat(modelName) 도 지원
    const openaiClient = vi.fn(() => mockOpenAIModel);
    openaiClient.chat = vi.fn(() => mockChatModel);
    mockCreateOpenAI.mockReturnValue(openaiClient);

    // gemini: createGoogleGenerativeAI → client(modelName) 반환
    mockCreateGoogleGenerativeAI.mockReturnValue(vi.fn(() => 'gemini-model-instance'));
  });

  it('anthropic 프로바이더에 createAnthropic 호출', async () => {
    const result = await getModel('anthropic');
    expect(mockCreateAnthropic).toHaveBeenCalledOnce();
    expect(result).toBe(mockAnthropicModel);
  });

  it('openai 프로바이더에 createOpenAI 호출, client(modelName) 반환', async () => {
    const result = await getModel('openai');
    expect(mockCreateOpenAI).toHaveBeenCalledOnce();
    // openai는 client(modelName) 사용 (Responses API)
    expect(result).toBe(mockOpenAIModel);
  });

  it('ollama 프로바이더에 createOpenAI({ baseURL: "http://localhost:11434/v1" }) + client.chat 호출', async () => {
    const result = await getModel('ollama');
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama',
    });
    expect(result).toBe(mockChatModel);
  });

  it('deepseek 프로바이더에 기본 baseURL https://api.deepseek.com/v1 적용', async () => {
    await getModel('deepseek');
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'ollama',
    });
  });

  it('xai 프로바이더에 기본 baseURL https://api.x.ai/v1 적용', async () => {
    await getModel('xai');
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      baseURL: 'https://api.x.ai/v1',
      apiKey: 'ollama',
    });
  });

  it('openrouter 프로바이더에 기본 baseURL https://openrouter.ai/api/v1 적용', async () => {
    await getModel('openrouter');
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'ollama',
    });
  });

  it('custom 프로바이더에 trailing slash 제거 후 /v1 추가', async () => {
    await getModel('custom', 'my-model', 'http://example.com');
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      baseURL: 'http://example.com/v1',
      apiKey: 'ollama',
    });
  });

  it('baseUrl이 이미 /v1로 끝나면 추가하지 않음', async () => {
    await getModel('custom', 'my-model', 'http://example.com/v1');
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      baseURL: 'http://example.com/v1',
      apiKey: 'ollama',
    });
  });

  it('baseUrl trailing slash만 제거', async () => {
    await getModel('custom', 'my-model', 'http://example.com/v1/');
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      baseURL: 'http://example.com/v1',
      apiKey: 'ollama',
    });
  });

  it('anthropic 기본 모델은 claude-sonnet-4-6', async () => {
    await getModel('anthropic');
    const clientFn = mockCreateAnthropic.mock.results[0].value;
    expect(clientFn).toHaveBeenCalledWith('claude-sonnet-4-6');
  });

  it('openai 기본 모델은 gpt-4.1-nano', async () => {
    await getModel('openai');
    const clientFn = mockCreateOpenAI.mock.results[0].value;
    expect(clientFn).toHaveBeenCalledWith('gpt-4.1-nano');
  });

  it('gemini 프로바이더에 createGoogleGenerativeAI 호출', async () => {
    const result = await getModel('gemini');
    expect(mockCreateGoogleGenerativeAI).toHaveBeenCalledOnce();
    expect(result).toBe('gemini-model-instance');
  });

  it('apiKey가 전달되면 anthropic 클라이언트에 포함', async () => {
    await getModel('anthropic', undefined, undefined, 'test-key');
    expect(mockCreateAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'test-key' }),
    );
  });
});

describe('analyzeText', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // anthropic mock 설정
    mockCreateAnthropic.mockReturnValue(vi.fn(() => 'model-instance'));

    mockGenerateText.mockResolvedValue({
      text: 'analysis result',
      usage: { promptTokens: 10, completionTokens: 20 },
      finishReason: 'stop',
    });
  });

  it('기본 provider는 anthropic', async () => {
    await analyzeText('test prompt');
    expect(mockCreateAnthropic).toHaveBeenCalled();
  });

  it('systemPrompt가 있으면 system으로 전달', async () => {
    await analyzeText('test prompt', { provider: 'anthropic', systemPrompt: 'sys prompt' });
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'sys prompt' }),
    );
  });

  it('systemPrompt가 없으면 system 키 미포함', async () => {
    await analyzeText('test prompt', { provider: 'anthropic' });
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('system');
  });

  it('maxOutputTokens 기본값 4096', async () => {
    await analyzeText('test prompt');
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({ maxOutputTokens: 4096 }),
    );
  });

  it('반환 형태는 { text, usage, finishReason }', async () => {
    const result = await analyzeText('test prompt');
    expect(result).toEqual({
      text: 'analysis result',
      usage: { promptTokens: 10, completionTokens: 20 },
      finishReason: 'stop',
    });
  });
});

describe('analyzeStructured', () => {
  const testSchema = z.object({ key: z.string() });

  beforeEach(() => {
    vi.clearAllMocks();

    // anthropic mock 설정
    mockCreateAnthropic.mockReturnValue(vi.fn(() => 'model-instance'));

    mockGenerateObject.mockResolvedValue({
      object: { key: 'value' },
      usage: { promptTokens: 5, completionTokens: 10 },
      finishReason: 'stop',
    });
  });

  it('schema를 generateObject에 전달', async () => {
    await analyzeStructured('test prompt', testSchema);
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({ schema: testSchema }),
    );
  });

  it('반환 형태는 { object, usage, finishReason }', async () => {
    const result = await analyzeStructured('test prompt', testSchema);
    expect(result).toEqual({
      object: { key: 'value' },
      usage: { promptTokens: 5, completionTokens: 10 },
      finishReason: 'stop',
    });
  });

  it('기본 provider는 anthropic', async () => {
    await analyzeStructured('test prompt', testSchema);
    expect(mockCreateAnthropic).toHaveBeenCalled();
  });

  it('maxOutputTokens 기본값 4096', async () => {
    await analyzeStructured('test prompt', testSchema);
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({ maxOutputTokens: 4096 }),
    );
  });
});
