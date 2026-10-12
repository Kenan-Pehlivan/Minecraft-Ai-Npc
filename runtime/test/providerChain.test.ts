import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { ProviderChain } from '../src/llm/providerChain.js';
import { RateLimiter } from '../src/llm/rateLimiter.js';
import {
  NoProviderAvailableError,
  RateLimitedError,
  TransientLlmError,
  type CompletionRequest,
  type CompletionResult,
  type LlmProvider,
} from '../src/llm/types.js';
import type { UsageEntry } from '../src/llm/usageLog.js';

const log = pino({ level: 'silent' });
const req: CompletionRequest = { purpose: 'test', messages: [{ role: 'user', content: 'Hallo' }], maxTokens: 10 };

function provider(name: string, behaviour: () => Promise<string>, paid = false): LlmProvider & { calls: number } {
  return {
    name,
    paid,
    calls: 0,
    async complete(): Promise<CompletionResult> {
      this.calls += 1;
      const text = await behaviour();
      return { text, provider: name, model: 'm', inputTokens: 5, outputTokens: 3, durationMs: 1 };
    },
  };
}

const limiter = () => new RateLimiter({ requestsPerMinute: 10, requestsPerDay: 100 });

function chain(providers: LlmProvider[], allowPaid = false) {
  const usage: UsageEntry[] = [];
  const c = new ProviderChain(
    providers.map((p) => ({ provider: p, limiter: limiter() })),
    { allowPaid, usage: { write: (e) => usage.push(e) }, log },
  );
  return { c, usage };
}

describe('ProviderChain', () => {
  it('nutzt den ersten Anbieter und protokolliert Tokens', async () => {
    const groq = provider('groq', async () => 'hi');
    const { c, usage } = chain([groq]);
    const result = await c.complete(req);
    expect(result.provider).toBe('groq');
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ ok: true, provider: 'groq', inputTokens: 5, outputTokens: 3, purpose: 'test' });
  });

  it('wechselt bei 429 zum Ersatzanbieter und sperrt den ersten', async () => {
    const groq = provider('groq', async () => {
      throw new RateLimitedError('voll', 60_000);
    });
    const cerebras = provider('cerebras', async () => 'ok');
    const { c } = chain([groq, cerebras]);
    expect((await c.complete(req)).provider).toBe('cerebras');
    await c.complete(req);
    expect(groq.calls).toBe(1);
    expect(cerebras.calls).toBe(2);
  });

  it('wechselt bei voruebergehenden Fehlern', async () => {
    const groq = provider('groq', async () => {
      throw new TransientLlmError('timeout');
    });
    const cerebras = provider('cerebras', async () => 'ok');
    const { c, usage } = chain([groq, cerebras]);
    expect((await c.complete(req)).provider).toBe('cerebras');
    expect(usage.map((u) => u.ok)).toEqual([false, true]);
  });

  it('ueberspringt kostenpflichtige Anbieter ohne Freigabe', async () => {
    const claude = provider('claude', async () => 'teuer', true);
    const { c } = chain([claude]);
    await expect(c.complete(req)).rejects.toBeInstanceOf(NoProviderAvailableError);
    expect(claude.calls).toBe(0);
  });

  it('meldet NoProviderAvailable, wenn alle Anbieter ausfallen', async () => {
    const groq = provider('groq', async () => {
      throw new TransientLlmError('weg');
    });
    const { c } = chain([groq]);
    await expect(c.complete(req)).rejects.toBeInstanceOf(NoProviderAvailableError);
  });
});
