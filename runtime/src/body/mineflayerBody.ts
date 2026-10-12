import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import mineflayer, { type Bot } from 'mineflayer';
import { BRIDGE_CHANNEL } from '../bridge/protocol.js';
import type { Logger } from '../log.js';
import type { BodyAdapter } from './BodyAdapter.js';

export interface MineflayerBodyOptions {
  host: string;
  port: number;
  username: string;
  auth: 'microsoft' | 'offline';
  version: string;
  dataDir: string;
  log: Logger;
  connectTimeoutMs?: number;
}

export class MineflayerBody extends EventEmitter implements BodyAdapter {
  readonly username: string;
  private bot: Bot | null = null;

  constructor(private readonly opts: MineflayerBodyOptions) {
    super();
    this.username = opts.username;
  }

  isConnected(): boolean {
    return this.bot !== null;
  }

  connect(): Promise<void> {
    if (this.bot) return Promise.resolve();
    const { log } = this.opts;
    const bot = mineflayer.createBot({
      host: this.opts.host,
      port: this.opts.port,
      username: this.opts.username,
      auth: this.opts.auth,
      version: this.opts.version,
      // Microsoft-Tokens werden hier gespeichert; das Passwort wird nie benoetigt.
      profilesFolder: join(this.opts.dataDir, 'auth'),
      onMsaCode: (data) => {
        log.warn(
          { url: data.verification_uri, code: data.user_code },
          `Einmalige Anmeldung: ${data.verification_uri} oeffnen und Code ${data.user_code} eingeben`,
        );
      },
      hideErrors: true,
    });
    this.bot = bot;

    bot.on('chat', (player, message) => {
      if (player !== bot.username) this.emit('chat', player, message, false);
    });
    bot.on('whisper', (player, message) => {
      if (player !== bot.username) this.emit('chat', player, message, true);
    });
    bot.on('kicked', (reason) => log.warn({ npc: this.username, reason: String(reason) }, 'NPC wurde gekickt'));
    bot.on('error', (err) => log.error({ npc: this.username, err: err.message }, 'Bot-Fehler'));
    bot.on('end', (reason) => {
      this.bot = null;
      this.emit('disconnected', reason);
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        bot.end('connect-timeout');
        reject(new Error('Zeitueberschreitung beim Verbinden'));
      }, this.opts.connectTimeoutMs ?? 120_000);
      bot.once('spawn', () => {
        clearTimeout(timer);
        // Kanal anmelden, damit der Server Plugin-Nachrichten an diesen Spieler zustellt.
        bot._client.registerChannel(BRIDGE_CHANNEL, undefined, true);
        // minecraft-protocol meldet registrierte Kanaele als eigenes Ereignis; die Typen kennen das nicht.
        (bot._client as unknown as EventEmitter).on(BRIDGE_CHANNEL, (data: Buffer) => this.emit('bridge', data));
        log.info({ npc: this.username }, 'NPC ist in der Welt');
        resolve();
      });
      bot.once('end', (reason) => {
        clearTimeout(timer);
        reject(new Error(`Verbindung beendet vor dem Spawn: ${reason}`));
      });
    });
  }

  disconnect(reason: string): void {
    this.bot?.quit(reason);
  }

  say(text: string): void {
    this.bot?.chat(text);
  }

  whisper(player: string, text: string): void {
    this.bot?.whisper(player, text);
  }

  sendBridge(payload: Buffer): void {
    this.bot?._client.write('custom_payload', { channel: BRIDGE_CHANNEL, data: payload });
  }
}
