import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig, requireEnv } from '../src/config/load.js';

const example = () => parse(readFileSync(new URL('../config.example.yaml', import.meta.url), 'utf8'));

describe('Konfiguration', () => {
  it('akzeptiert die Beispielkonfiguration und setzt Standardwerte', () => {
    const config = parseConfig(example());
    expect(config.server.auth).toBe('microsoft');
    expect(config.llm.allowPaid).toBe(false);
    expect(config.llm.providers.map((p) => p.name)).toEqual(['groq', 'cerebras']);
    expect(config.llm.providers[0]?.paid).toBe(false);
  });

  it('lehnt ungueltige Minecraft-Namen ab', () => {
    const raw = example();
    raw.npcs[0].username = 'mit leerzeichen';
    expect(() => parseConfig(raw)).toThrow(ConfigError);
  });

  it('meldet fehlende Secrets klar', () => {
    expect(() => requireEnv('GIBT_ES_NICHT', {})).toThrow(/GIBT_ES_NICHT/);
  });
});
