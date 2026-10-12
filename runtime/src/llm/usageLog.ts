import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface UsageEntry {
  at: string;
  purpose: string;
  provider: string;
  model?: string;
  ok: boolean;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  error?: string;
}

export interface UsageSink {
  write(entry: UsageEntry): void;
}

/** Schreibt jeden KI-Aufruf als eine JSON-Zeile; Grundlage fuer Kosten- und Limitauswertung. */
export class JsonlUsageLog implements UsageSink {
  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }

  write(entry: UsageEntry): void {
    appendFileSync(this.path, `${JSON.stringify(entry)}\n`);
  }
}
