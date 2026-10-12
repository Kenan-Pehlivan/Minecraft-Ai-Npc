import { z } from 'zod';
import type { CompletionRequest, LlmClient } from './types.js';

export class InvalidModelOutputError extends Error {}

/**
 * Fordert ein JSON-Objekt an und prueft es gegen ein Schema.
 * Offene Modelle liefern oefter ungueltiges JSON, daher genau ein Reparaturversuch.
 * Danach entscheidet der Aufrufer ueber den lokalen Fallback.
 */
export async function completeJson<T extends z.ZodType>(
  client: LlmClient,
  req: Omit<CompletionRequest, 'json'>,
  schema: T,
): Promise<z.infer<T>> {
  const first = await client.complete({ ...req, json: true });
  const parsed = tryParse(first.text, schema);
  if (parsed.ok) return parsed.value;

  const repair = await client.complete({
    ...req,
    json: true,
    purpose: `${req.purpose}:repair`,
    messages: [
      ...req.messages,
      { role: 'assistant', content: first.text },
      {
        role: 'user',
        content: `Deine Antwort war ungueltig (${parsed.error}). Antworte nur mit einem JSON-Objekt, das dem verlangten Format entspricht.`,
      },
    ],
  });
  const second = tryParse(repair.text, schema);
  if (second.ok) return second.value;
  throw new InvalidModelOutputError(second.error);
}

function tryParse<T extends z.ZodType>(
  text: string,
  schema: T,
): { ok: true; value: z.infer<T> } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'kein gueltiges JSON' };
  }
  const result = schema.safeParse(json);
  if (!result.success) return { ok: false, error: z.prettifyError(result.error).slice(0, 300) };
  return { ok: true, value: result.data };
}
