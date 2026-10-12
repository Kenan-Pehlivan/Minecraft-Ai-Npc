import type { NpcAgent } from '../agent/npcAgent.js';
import type { Logger } from '../log.js';
import type { PresenceSource } from './rconControl.js';

export interface SupervisorOptions {
  pollIntervalMs: number;
  /** Mindestabstand zwischen zwei Verbindungsversuchen desselben NPC. */
  reconnectBackoffMs?: number;
  /** Nach so vielen Fehlversuchen in Folge pausiert der NPC (gegen Endlosschleifen). */
  maxConsecutiveFailures?: number;
  pauseAfterFailuresMs?: number;
  now?: () => number;
}

interface AgentState {
  agent: NpcAgent;
  connecting: boolean;
  lastAttempt: number;
  failures: number;
  pausedUntil: number;
}

/**
 * Gleicht den gewuenschten Zustand (aus `npc spawn/despawn` im Server) mit dem
 * tatsaechlichen ab: verbindet NPCs auf Befehl und trennt sie wieder.
 */
export class Supervisor {
  private readonly states = new Map<string, AgentState>();
  private timer: NodeJS.Timeout | null = null;
  private readonly now: () => number;

  constructor(
    agents: NpcAgent[],
    private readonly source: PresenceSource,
    private readonly log: Logger,
    private readonly opts: SupervisorOptions,
  ) {
    this.now = opts.now ?? Date.now;
    for (const agent of agents) {
      this.states.set(agent.npc.username.toLowerCase(), {
        agent,
        connecting: false,
        lastAttempt: Number.NEGATIVE_INFINITY,
        failures: 0,
        pausedUntil: 0,
      });
    }
  }

  start(): void {
    const loop = async () => {
      await this.tick();
      this.timer = setTimeout(loop, this.opts.pollIntervalMs);
    };
    void loop();
  }

  async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const state of this.states.values()) state.agent.despawn('Runtime wird beendet');
    await this.source.close();
  }

  /** Ein Abgleich; oeffentlich fuer Tests. */
  async tick(): Promise<void> {
    let response;
    try {
      response = await this.source.poll();
    } catch (err) {
      this.log.warn({ err: (err as Error).message }, 'RCON-Abfrage fehlgeschlagen');
      return;
    }
    const requested = new Set(response.npcs.filter((n) => n.requested).map((n) => n.username.toLowerCase()));

    for (const [key, state] of this.states) {
      const { agent } = state;
      const connected = agent.body.isConnected();
      if (!requested.has(key)) {
        if (connected) agent.despawn('npc despawn');
        state.failures = 0;
        state.pausedUntil = 0;
        continue;
      }
      if (connected || state.connecting) continue;
      void this.tryConnect(state);
    }
  }

  private async tryConnect(state: AgentState): Promise<void> {
    const now = this.now();
    const backoff = this.opts.reconnectBackoffMs ?? 30_000;
    if (now < state.pausedUntil || now - state.lastAttempt < backoff) return;

    state.connecting = true;
    state.lastAttempt = now;
    const name = state.agent.npc.username;
    try {
      this.log.info({ npc: name }, 'Verbinde NPC');
      await state.agent.spawn();
      state.failures = 0;
    } catch (err) {
      state.failures += 1;
      this.log.error({ npc: name, err: (err as Error).message, failures: state.failures }, 'Verbindung fehlgeschlagen');
      if (state.failures >= (this.opts.maxConsecutiveFailures ?? 3)) {
        state.pausedUntil = this.now() + (this.opts.pauseAfterFailuresMs ?? 10 * 60_000);
        state.failures = 0;
        this.log.error({ npc: name }, 'Zu viele Fehlversuche, NPC pausiert 10 Minuten');
      }
    } finally {
      state.connecting = false;
    }
  }
}
