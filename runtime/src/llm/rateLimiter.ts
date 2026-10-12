export interface RateLimits {
  requestsPerMinute: number;
  requestsPerDay: number;
  tokensPerDay?: number;
}

const MINUTE = 60_000;

/**
 * Haelt die Gratis-Kontingente eines Anbieters lokal ein, damit der NPC nicht
 * erst am HTTP 429 merkt, dass das Tageslimit erreicht ist.
 * Tageszaehler laufen nach UTC-Tag.
 */
export class RateLimiter {
  private minuteStamps: number[] = [];
  private day = '';
  private requestsToday = 0;
  private tokensToday = 0;
  private blockedUntil = 0;

  constructor(private readonly limits: RateLimits) {}

  canRequest(now = Date.now()): boolean {
    this.roll(now);
    if (now < this.blockedUntil) return false;
    if (this.minuteStamps.length >= this.limits.requestsPerMinute) return false;
    if (this.requestsToday >= this.limits.requestsPerDay) return false;
    if (this.limits.tokensPerDay !== undefined && this.tokensToday >= this.limits.tokensPerDay) return false;
    return true;
  }

  record(tokens: number, now = Date.now()): void {
    this.roll(now);
    this.minuteStamps.push(now);
    this.requestsToday += 1;
    this.tokensToday += tokens;
  }

  /** Nach einem 429 des Anbieters: bis zu diesem Zeitpunkt nicht mehr fragen. */
  blockFor(ms: number, now = Date.now()): void {
    this.blockedUntil = Math.max(this.blockedUntil, now + ms);
  }

  snapshot(now = Date.now()) {
    this.roll(now);
    return {
      requestsLastMinute: this.minuteStamps.length,
      requestsToday: this.requestsToday,
      tokensToday: this.tokensToday,
      blockedUntil: this.blockedUntil > now ? new Date(this.blockedUntil).toISOString() : null,
    };
  }

  private roll(now: number): void {
    this.minuteStamps = this.minuteStamps.filter((t) => now - t < MINUTE);
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.requestsToday = 0;
      this.tokensToday = 0;
    }
  }
}
