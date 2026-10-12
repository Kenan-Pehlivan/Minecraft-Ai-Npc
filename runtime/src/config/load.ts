import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import { configSchema, type Config } from './schema.js';

export class ConfigError extends Error {}

export function parseConfig(raw: unknown): Config {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(`Ungueltige Konfiguration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function loadConfig(path: string): Config {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    throw new ConfigError(`Konfiguration ${path} nicht lesbar: ${(err as Error).message}`);
  }
  return parseConfig(parse(text));
}

/** Liest ein Secret aus der Umgebung; fehlt es, ist das ein Konfigurationsfehler. */
export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name];
  if (!value) throw new ConfigError(`Umgebungsvariable ${name} fehlt`);
  return value;
}
