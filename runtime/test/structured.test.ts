import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { completeJson, InvalidModelOutputError } from '../src/llm/structured.js';
import type { CompletionRequest, LlmClient } from '../src/llm/types.js';

function scripted(answers: string[]): LlmClient & { requests: CompletionRequest[] } {
  return {
    requests: [],
    async complete(req) {
      this.requests.push(req);
      const text = answers.shift() ?? '';
      return { text, provider: 'p', model: 'm', inputTokens: 1, outputTokens: 1, durationMs: 1 };
    },
  };
}

const goal = z.object({ goal: z.enum(['wood', 'food', 'sleep']), reason: z.string() });
const req = { purpose: 'plan', messages: [{ role: 'user' as const, content: 'Was nun?' }], maxTokens: 100 };

describe('completeJson', () => {
  it('liefert gueltige Antworten direkt', async () => {
    const llm = scripted(['{"goal":"wood","reason":"Vorrat leer"}']);
    await expect(completeJson(llm, req, goal)).resolves.toEqual({ goal: 'wood', reason: 'Vorrat leer' });
    expect(llm.requests[0]?.json).toBe(true);
  });

  it('repariert einmal und nennt den Fehler', async () => {
    const llm = scripted(['kein json', '{"goal":"food","reason":"Hunger"}']);
    await expect(completeJson(llm, req, goal)).resolves.toMatchObject({ goal: 'food' });
    expect(llm.requests[1]?.purpose).toBe('plan:repair');
    expect(llm.requests[1]?.messages.at(-1)?.content).toMatch(/ungueltig/);
  });

  it('gibt nach dem zweiten Fehlschlag auf', async () => {
    const llm = scripted(['{"goal":"fly"}', '{"goal":"fly"}']);
    await expect(completeJson(llm, req, goal)).rejects.toBeInstanceOf(InvalidModelOutputError);
  });
});
