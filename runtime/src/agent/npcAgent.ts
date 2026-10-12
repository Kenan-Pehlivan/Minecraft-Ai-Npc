import type { BodyAdapter } from '../body/BodyAdapter.js';
import { BRIDGE_VERSION, decodeBridge, encodeBridge } from '../bridge/protocol.js';
import type { Config, NpcConfig } from '../config/schema.js';
import type { Logger } from '../log.js';
import { NoProviderAvailableError, type LlmClient } from '../llm/types.js';
import { buildChatMessages, Cooldowns, FALLBACK_REPLIES, isAddressed, sanitizeChatReply } from './chat.js';

/**
 * Ein NPC. In M0: Verbindung auf Befehl, Handshake mit dem Plugin und Gespraeche.
 * Ueberleben, Planung und Gedaechtnis kommen in den naechsten Meilensteinen dazu.
 */
export class NpcAgent {
  private readonly cooldowns: Cooldowns;
  private pluginConfirmed = false;
  private fallbackIndex = 0;

  constructor(
    readonly npc: NpcConfig,
    readonly body: BodyAdapter,
    private readonly llm: LlmClient,
    private readonly config: Config,
    private readonly log: Logger,
  ) {
    this.cooldowns = new Cooldowns(config.chat.perPlayerCooldownMs);
    body.on('chat', (player, message, whisper) => {
      void this.onChat(player, message, whisper).catch((err: Error) =>
        this.log.error({ npc: npc.username, err: err.message }, 'Fehler bei der Chatverarbeitung'),
      );
    });
    body.on('bridge', (payload) => this.onBridge(payload));
    body.on('disconnected', (reason) => {
      this.pluginConfirmed = false;
      this.log.info({ npc: npc.username, reason }, 'NPC hat die Welt verlassen');
    });
  }

  async spawn(): Promise<void> {
    await this.body.connect();
    this.body.sendBridge(encodeBridge({ type: 'hello', version: BRIDGE_VERSION }));
  }

  despawn(reason: string): void {
    this.body.disconnect(reason);
  }

  get bridgeConfirmed(): boolean {
    return this.pluginConfirmed;
  }

  private onBridge(payload: Buffer): void {
    const message = decodeBridge(payload);
    if (!message) {
      this.log.warn({ npc: this.npc.username }, 'Unbekannte Plugin-Nachricht verworfen');
      return;
    }
    switch (message.type) {
      case 'welcome':
        this.pluginConfirmed = true;
        this.log.info({ npc: this.npc.username, version: message.version }, 'Plugin-Bruecke bestaetigt');
        break;
      case 'despawn':
        this.log.info({ npc: this.npc.username, reason: message.reason }, 'Plugin verlangt Despawn');
        this.despawn(message.reason);
        break;
    }
  }

  private async onChat(player: string, message: string, whisper: boolean): Promise<void> {
    if (!isAddressed(this.npc, message, whisper)) return;
    if (!this.cooldowns.take(player)) return;

    const maxChars = this.config.chat.maxReplyChars;
    let reply: string;
    try {
      const result = await this.llm.complete({
        purpose: 'chat',
        messages: buildChatMessages(this.npc, player, message, maxChars),
        maxTokens: 120,
        temperature: 0.8,
      });
      reply = sanitizeChatReply(result.text, maxChars);
    } catch (err) {
      if (!(err instanceof NoProviderAvailableError)) throw err;
      this.log.warn({ npc: this.npc.username, err: err.message }, 'Kein KI-Anbieter, nutze Vorlagenantwort');
      reply = FALLBACK_REPLIES[this.fallbackIndex++ % FALLBACK_REPLIES.length]!;
    }
    if (!reply) return;
    if (whisper) this.body.whisper(player, reply);
    else this.body.say(reply);
  }
}
