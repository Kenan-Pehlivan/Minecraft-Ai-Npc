import {
  FatalLlmError,
  RateLimitedError,
  TransientLlmError,
  type CompletionRequest,
  type CompletionResult,
  type LlmProvider,
} from './types.js';

export interface OpenAiCompatibleOptions {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  paid: boolean;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Anbieter mit OpenAI-kompatibler Chat-Completions-Schnittstelle.
 * Groq und Cerebras bieten beide diese Schnittstelle an.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;
  readonly paid: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: OpenAiCompatibleOptions) {
    this.name = opts.name;
    this.paid = opts.paid;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const started = Date.now();
    const body: Record<string, unknown> = {
      model: this.opts.model,
      messages: req.messages,
      max_tokens: req.maxTokens,
      temperature: req.temperature ?? 0.7,
    };
    if (req.json) body.response_format = { type: 'json_object' };

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      });
    } catch (err) {
      throw new TransientLlmError(`${this.name}: Netzwerkfehler oder Zeitueberschreitung: ${(err as Error).message}`);
    }

    if (res.status === 429) {
      throw new RateLimitedError(`${this.name}: Limit erreicht`, parseRetryAfter(res.headers.get('retry-after')));
    }
    if (res.status >= 500) {
      throw new TransientLlmError(`${this.name}: Serverfehler ${res.status}`);
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new FatalLlmError(`${this.name}: HTTP ${res.status} ${detail}`);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      throw new TransientLlmError(`${this.name}: Antwort ohne Text`);
    }
    return {
      text,
      provider: this.name,
      model: this.opts.model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
    };
  }
}

/** Retry-After in Sekunden oder als HTTP-Datum; Standard 60 s. */
export function parseRetryAfter(value: string | null, now = Date.now()): number {
  if (!value) return 60_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 60_000 : Math.max(0, date - now);
}
