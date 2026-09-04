import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiRequest } from '../../shared/contracts';

const request: AiRequest = { requestId: 'request-1', kind: 'chat', question: '三峡大坝适合几月去？' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('development mock AI service', () => {
  it('returns a deterministic mock answer by default in a development build', async () => {
    vi.stubGlobal('__BUILD_MODE__', 'development');
    const { submitAi } = await import('../../miniprogram/services/ai');
    await expect(submitAi(request)).resolves.toEqual(expect.objectContaining({
      requestId: request.requestId,
      status: 'succeeded',
      mode: 'mock',
      answer: '模拟回答：三峡大坝适合几月去？',
      error: null,
    }));
  });

  it('does not activate the mock adapter in a demo build', async () => {
    vi.stubGlobal('__BUILD_MODE__', 'demo');
    const { submitAi } = await import('../../miniprogram/services/ai');
    await expect(submitAi(request)).rejects.toThrow('模拟服务暂不可用，请稍后重试');
  });
});
