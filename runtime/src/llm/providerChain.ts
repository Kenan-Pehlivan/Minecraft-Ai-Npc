import type { Logger } from '../log.js';
import { RateLimiter } from './rateLimiter.js';
import {
  NoProviderAvailableError,
  RateLimitedError,
  type CompletionRequest,
  type CompletionResult,
  type LlmClient,
  type LlmProvider,
} from './types.js';
import type { UsageSink } from './usageLog.js';

export interface ChainEntry {
  provider: LlmProvider;
  limiter: RateLimiter;
}

/**
 * Fragt die Anbieter der Reihe nach (z. B. Groq, dann Cerebras).
 * Uebersprungen wird, wer sein Limit erreicht hat, kostenpflichtig ist ohne Freigabe
 * oder gerade ausfaellt. Ist niemand verfuegbar, entscheidet der Aufrufer ueber den Fallback.
 */
export class ProviderChain implements LlmClient {
  constructor(
    private readonly entries: ChainEntry[],
    private readonly opts: { allowPaid: boolean; usage: UsageSink; log: Logger; now?: () => number },
  ) {}

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const now = this.opts.now ?? Date.now;
    const reasons: string[] = [];

    for (const { provider, limiter } of this.entries) {
      if (provider.paid && !this.opts.allowPaid) {
        reasons.push(`${provider.name}: kostenpflichtig, nicht freigegeben`);
        continue;
      }
      if (!limiter.canRequest(now())) {
        reasons.push(`${provider.name}: lokales Limit erreicht`);
        continue;
      }
      try {
        const result = await provider.complete(req);
        limiter.record(result.inputTokens + result.outputTokens, now());
        this.opts.usage.write({
          at: new Date(now()).toISOString(),
          purpose: req.purpose,
          provider: result.provider,
          model: result.model,
          ok: true,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          durationMs: result.durationMs,
        });
        return result;
      } catch (err) {
        const message = (err as Error).message;
        if (err instanceof RateLimitedError) {
          limiter.blockFor(err.retryAfterMs, now());
        } else {
          // Auch ein gescheiterter Versuch zaehlt gegen das Kontingent.
          limiter.record(0, now());
        }
        this.opts.usage.write({
          at: new Date(now()).toISOString(),
          purpose: req.purpose,
          provider: provider.name,
          ok: false,
          error: message,
        });
        this.opts.log.warn({ provider: provider.name, err: message }, 'KI-Anbieter fehlgeschlagen, versuche naechsten');
        reasons.push(message);
      }
    }
    throw new NoProviderAvailableError(`Kein KI-Anbieter verfuegbar: ${reasons.join('; ')}`);
  }

  status() {
    return this.entries.map(({ provider, limiter }) => ({
      provider: provider.name,
      paid: provider.paid,
      ...limiter.snapshot(),
    }));
  }
}
