import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/llm/rateLimiter.js';

describe('RateLimiter', () => {
  const t0 = Date.parse('2026-10-12T10:00:00Z');

  it('haelt das Minutenlimit ein und gibt nach einer Minute wieder frei', () => {
    const limiter = new RateLimiter({ requestsPerMinute: 2, requestsPerDay: 100 });
    limiter.record(10, t0);
    limiter.record(10, t0 + 1000);
    expect(limiter.canRequest(t0 + 2000)).toBe(false);
    expect(limiter.canRequest(t0 + 61_000)).toBe(true);
  });

  it('haelt Tages- und Tokenlimits ein und setzt sie am neuen UTC-Tag zurueck', () => {
    const limiter = new RateLimiter({ requestsPerMinute: 100, requestsPerDay: 100, tokensPerDay: 50 });
    limiter.record(60, t0);
    expect(limiter.canRequest(t0 + 120_000)).toBe(false);
    expect(limiter.canRequest(Date.parse('2026-10-13T00:00:01Z'))).toBe(true);
  });

  it('respektiert eine Sperre nach HTTP 429', () => {
    const limiter = new RateLimiter({ requestsPerMinute: 100, requestsPerDay: 100 });
    limiter.blockFor(30_000, t0);
    expect(limiter.canRequest(t0 + 29_000)).toBe(false);
    expect(limiter.canRequest(t0 + 31_000)).toBe(true);
  });
});
