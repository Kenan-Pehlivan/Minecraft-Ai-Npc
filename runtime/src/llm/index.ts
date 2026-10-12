import type { Config } from '../config/schema.js';
import { requireEnv } from '../config/load.js';
import type { Logger } from '../log.js';
import { OpenAiCompatibleProvider } from './openaiCompatible.js';
import { ProviderChain } from './providerChain.js';
import { RateLimiter } from './rateLimiter.js';
import { JsonlUsageLog } from './usageLog.js';

export function createLlmClient(config: Config, log: Logger): ProviderChain {
  const entries = config.llm.providers.map((p) => ({
    provider: new OpenAiCompatibleProvider({
      name: p.name,
      baseUrl: p.baseUrl,
      apiKey: requireEnv(p.apiKeyEnv),
      model: p.model,
      paid: p.paid,
      timeoutMs: p.timeoutMs,
    }),
    limiter: new RateLimiter(p.limits),
  }));
  return new ProviderChain(entries, {
    allowPaid: config.llm.allowPaid,
    usage: new JsonlUsageLog(config.llm.usageLogPath),
    log,
  });
}
