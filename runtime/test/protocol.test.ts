import { describe, expect, it } from 'vitest';
import { decodeBridge, encodeBridge, parsePollResponse } from '../src/bridge/protocol.js';

describe('Bruecken-Protokoll', () => {
  it('kodiert hello und dekodiert Plugin-Nachrichten', () => {
    expect(JSON.parse(encodeBridge({ type: 'hello', version: 1 }).toString())).toEqual({ type: 'hello', version: 1 });
    expect(decodeBridge(Buffer.from('{"type":"despawn","reason":"stop"}'))).toEqual({ type: 'despawn', reason: 'stop' });
    expect(decodeBridge(Buffer.from('{"type":"op"}'))).toBeNull();
    expect(decodeBridge(Buffer.from('kaputt'))).toBeNull();
  });

  it('liest die letzte JSON-Zeile aus der RCON-Ausgabe', () => {
    const out = 'irgendwas\n{"v":1,"npcs":[{"username":"Bjarne","requested":true,"online":false}]}\n';
    expect(parsePollResponse(out)?.npcs[0]?.requested).toBe(true);
    expect(parsePollResponse('Unknown command')).toBeNull();
  });
});
