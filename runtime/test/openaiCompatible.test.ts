import { describe, expect, it } from 'vitest';
import { OpenAiCompatibleProvider, parseRetryAfter } from '../src/llm/openaiCompatible.js';
import { FatalLlmError, RateLimitedError, TransientLlmError } from '../src/llm/types.js';

function make(response: () => Response, captured: { body?: any; url?: string; auth?: string } = {}) {
  return new OpenAiCompatibleProvider({
    name: 'groq',
    baseUrl: 'https://api.example.com/v1/',
    apiKey: 'k',
    model: 'test-model',
    paid: false,
    timeoutMs: 1000,
    fetchImpl: (async (url: string, init: RequestInit) => {
      captured.url = url;
      captured.body = JSON.parse(String(init.body));
      captured.auth = (init.headers as Record<string, string>).authorization;
      return response();
    }) as unknown as typeof fetch,
  });
}

const req = { purpose: 't', messages: [{ role: 'user' as const, content: 'x' }], maxTokens: 50, json: true };

describe('OpenAiCompatibleProvider', () => {
  it('sendet eine Chat-Completions-Anfrage und liest Text und Tokens', async () => {
    const captured: { body?: any; url?: string; auth?: string } = {};
    const p = make(
      () => Response.json({ choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 12, completion_tokens: 4 } }),
      captured,
    );
    const r = await p.complete(req);
    expect(captured.url).toBe('https://api.example.com/v1/chat/completions');
    expect(captured.auth).toBe('Bearer k');
    expect(captured.body).toMatchObject({ model: 'test-model', max_tokens: 50, response_format: { type: 'json_object' } });
    expect(r).toMatchObject({ text: '{"a":1}', inputTokens: 12, outputTokens: 4, provider: 'groq' });
  });

  it('unterscheidet 429, 5xx und 4xx', async () => {
    await expect(make(() => new Response('', { status: 429, headers: { 'retry-after': '7' } })).complete(req)).rejects.toMatchObject({
      retryAfterMs: 7000,
    });
    await expect(make(() => new Response('', { status: 429 })).complete(req)).rejects.toBeInstanceOf(RateLimitedError);
    await expect(make(() => new Response('', { status: 503 })).complete(req)).rejects.toBeInstanceOf(TransientLlmError);
    await expect(make(() => new Response('bad key', { status: 401 })).complete(req)).rejects.toBeInstanceOf(FatalLlmError);
  });

  it('liest Retry-After als Sekunden oder Datum', () => {
    expect(parseRetryAfter('3')).toBe(3000);
    expect(parseRetryAfter(null)).toBe(60_000);
    const now = Date.parse('2026-10-12T10:00:00Z');
    expect(parseRetryAfter('Mon, 12 Oct 2026 10:00:10 GMT', now)).toBe(10_000);
  });
});
