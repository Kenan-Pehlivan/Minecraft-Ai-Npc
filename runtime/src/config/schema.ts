import { z } from 'zod';

const providerSchema = z.object({
  /** Freier Name, z. B. "groq" oder "cerebras". */
  name: z.string().min(1),
  /** OpenAI-kompatibler Endpunkt, z. B. https://api.groq.com/openai/v1 */
  baseUrl: z.url(),
  /** Name der Umgebungsvariable mit dem API-Schluessel (nie den Schluessel selbst eintragen). */
  apiKeyEnv: z.string().min(1),
  model: z.string().min(1),
  /** Kostenpflichtige Anbieter werden nur genutzt, wenn llm.allowPaid true ist. */
  paid: z.boolean().default(false),
  limits: z.object({
    requestsPerMinute: z.number().int().positive(),
    requestsPerDay: z.number().int().positive(),
    tokensPerDay: z.number().int().positive().optional(),
  }),
  timeoutMs: z.number().int().positive().default(20_000),
});

const npcSchema = z.object({
  /** Minecraft-Benutzername des NPC-Kontos; muss im Plugin freigegeben sein. */
  username: z.string().regex(/^[A-Za-z0-9_]{3,16}$/),
  displayName: z.string().min(1),
  /** Kurzbeschreibung der Persoenlichkeit fuer Gespraeche. */
  personality: z.string().min(1),
});

export const configSchema = z.object({
  server: z.object({
    host: z.string().min(1),
    port: z.number().int().default(25565),
    /** 'microsoft' fuer online-mode, 'offline' nur fuer lokale Testserver. */
    auth: z.enum(['microsoft', 'offline']).default('microsoft'),
    /** Muss eine von Mineflayer unterstuetzte Version sein. */
    version: z.string().default('26.1'),
  }),
  rcon: z.object({
    host: z.string().min(1),
    port: z.number().int().default(25575),
    passwordEnv: z.string().default('RCON_PASSWORD'),
    pollIntervalMs: z.number().int().min(1000).default(3000),
  }),
  npcs: z.array(npcSchema).min(1),
  llm: z.object({
    providers: z.array(providerSchema).min(1),
    allowPaid: z.boolean().default(false),
    /** Wohin jeder Aufruf mit Tokens und Dauer protokolliert wird (JSON Lines). */
    usageLogPath: z.string().default('data/llm-usage.jsonl'),
  }),
  chat: z.object({
    /** Mindestabstand zwischen zwei Antworten an denselben Spieler. */
    perPlayerCooldownMs: z.number().int().nonnegative().default(15_000),
    maxReplyChars: z.number().int().positive().default(200),
  }).prefault({}),
  dataDir: z.string().default('data'),
});

export type Config = z.infer<typeof configSchema>;
export type ProviderConfig = z.infer<typeof providerSchema>;
export type NpcConfig = z.infer<typeof npcSchema>;
