import { Rcon } from 'rcon-client';
import { parsePollResponse, type PollResponse } from '../bridge/protocol.js';

export interface PresenceSource {
  /** Liefert, welche NPCs laut Server in der Welt sein sollen. */
  poll(): Promise<PollResponse>;
  close(): Promise<void>;
}

/**
 * Fragt den Server per RCON mit `npc poll` ab. RCON ist bei Nitrado ohnehin
 * vorhanden, die Runtime baut die Verbindung nach aussen auf; ein eigener Port
 * auf dem Server ist nicht noetig.
 */
export class RconPresenceSource implements PresenceSource {
  private rcon: Rcon | null = null;

  constructor(private readonly opts: { host: string; port: number; password: string; timeoutMs?: number }) {}

  async poll(): Promise<PollResponse> {
    const rcon = await this.connection();
    let output: string;
    try {
      output = await rcon.send('npc poll');
    } catch (err) {
      await this.close();
      throw err;
    }
    const parsed = parsePollResponse(output);
    if (!parsed) throw new Error(`Unerwartete Antwort auf "npc poll": ${output.slice(0, 200)}`);
    return parsed;
  }

  async close(): Promise<void> {
    const rcon = this.rcon;
    this.rcon = null;
    await rcon?.end().catch(() => undefined);
  }

  private async connection(): Promise<Rcon> {
    if (this.rcon) return this.rcon;
    const rcon = await Rcon.connect({
      host: this.opts.host,
      port: this.opts.port,
      password: this.opts.password,
      timeout: this.opts.timeoutMs ?? 5000,
    });
    rcon.on('end', () => {
      if (this.rcon === rcon) this.rcon = null;
    });
    this.rcon = rcon;
    return rcon;
  }
}
