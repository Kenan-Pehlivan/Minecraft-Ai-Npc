import { EventEmitter } from 'node:events';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import type { NpcAgent } from '../src/agent/npcAgent.js';
import type { PollResponse } from '../src/bridge/protocol.js';
import { Supervisor } from '../src/control/supervisor.js';

const log = pino({ level: 'silent' });

function fakeAgent(username: string, failConnect = false) {
  const body = Object.assign(new EventEmitter(), { connected: false, isConnected() { return this.connected; } });
  const agent = {
    npc: { username, displayName: username, personality: '' },
    body,
    spawns: 0,
    despawns: 0,
    async spawn() {
      this.spawns += 1;
      if (failConnect) throw new Error('nope');
      body.connected = true;
    },
    despawn() {
      this.despawns += 1;
      body.connected = false;
    },
  };
  return agent;
}

function source(responses: PollResponse[]) {
  return { poll: async () => responses.shift() ?? { v: 1 as const, npcs: [] }, close: async () => undefined };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const req = (username: string, requested: boolean) => ({ username, requested, online: false });

describe('Supervisor', () => {
  it('verbindet auf spawn und trennt auf despawn', async () => {
    const a = fakeAgent('Bjarne');
    const s = new Supervisor([a as unknown as NpcAgent], source([
      { v: 1, npcs: [req('bjarne', true)] },
      { v: 1, npcs: [req('Bjarne', false)] },
    ]), log, { pollIntervalMs: 1000 });
    await s.tick();
    await flush();
    expect(a.spawns).toBe(1);
    expect(a.body.isConnected()).toBe(true);
    await s.tick();
    expect(a.despawns).toBe(1);
  });

  it('wartet zwischen Fehlversuchen und pausiert nach drei Fehlschlaegen', async () => {
    let now = 0;
    const a = fakeAgent('Bjarne', true);
    const on = { v: 1 as const, npcs: [req('Bjarne', true)] };
    const s = new Supervisor([a as unknown as NpcAgent], source(Array(10).fill(on)), log, {
      pollIntervalMs: 1000,
      reconnectBackoffMs: 30_000,
      pauseAfterFailuresMs: 600_000,
      now: () => now,
    });
    for (const t of [0, 10_000, 30_000, 60_000, 90_000, 120_000]) {
      now = t;
      await s.tick();
      await flush();
    }
    // Versuche bei 0, 30 s und 60 s; danach Pause statt Endlosschleife.
    expect(a.spawns).toBe(3);
    now = 60_000 + 600_001;
    await s.tick();
    await flush();
    expect(a.spawns).toBe(4);
  });

  it('ignoriert unbekannte Namen', async () => {
    const a = fakeAgent('Bjarne');
    const s = new Supervisor([a as unknown as NpcAgent], source([{ v: 1, npcs: [req('Fremder', true)] }]), log, { pollIntervalMs: 1000 });
    await s.tick();
    await flush();
    expect(a.spawns).toBe(0);
  });
});
