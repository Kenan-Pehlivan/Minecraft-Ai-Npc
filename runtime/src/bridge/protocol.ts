import { z } from 'zod';

/** Plugin-Messaging-Kanal zwischen Bot und NpcBridge-Plugin (Payload: UTF-8-JSON). */
export const BRIDGE_CHANNEL = 'npcbridge:main';
export const BRIDGE_VERSION = 1;

export const pluginToBotSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('welcome'), version: z.number().int(), npc: z.string() }),
  z.object({ type: z.literal('despawn'), reason: z.string() }),
]);
export type PluginToBot = z.infer<typeof pluginToBotSchema>;

export type BotToPlugin = { type: 'hello'; version: number };

/** Antwort von `npc poll` ueber RCON. */
export const pollResponseSchema = z.object({
  v: z.literal(1),
  npcs: z.array(z.object({ username: z.string(), requested: z.boolean(), online: z.boolean() })),
});
export type PollResponse = z.infer<typeof pollResponseSchema>;

export function encodeBridge(message: BotToPlugin): Buffer {
  return Buffer.from(JSON.stringify(message), 'utf8');
}

export function decodeBridge(data: Buffer): PluginToBot | null {
  try {
    const result = pluginToBotSchema.safeParse(JSON.parse(data.toString('utf8')));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** RCON liefert die Konsolenausgabe; das JSON steht in der letzten nicht-leeren Zeile. */
export function parsePollResponse(output: string): PollResponse | null {
  const line = output.split('\n').map((l) => l.trim()).filter(Boolean).at(-1);
  if (!line) return null;
  try {
    const result = pollResponseSchema.safeParse(JSON.parse(line));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
