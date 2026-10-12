export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  /** Wofuer der Aufruf ist (chat, plan, reflect); landet im Nutzungsprotokoll. */
  purpose: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  /** Erzwingt ein JSON-Objekt als Antwort (vom Anbieter unterstuetzt). */
  json?: boolean;
}

export interface CompletionResult {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

/** Alles, was die Runtime von einem Sprachmodell braucht. Anbieter sind austauschbar. */
export interface LlmClient {
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export interface LlmProvider extends LlmClient {
  readonly name: string;
  readonly paid: boolean;
}

/** Anbieter meldet Limit erreicht (HTTP 429). */
export class RateLimitedError extends Error {
  constructor(message: string, readonly retryAfterMs: number) {
    super(message);
  }
}

/** Voruebergehender Fehler (Zeitueberschreitung, 5xx, Netzwerk). */
export class TransientLlmError extends Error {}

/** Dauerhafter Fehler (falscher Schluessel, ungueltige Anfrage). */
export class FatalLlmError extends Error {}

/** Kein Anbieter ist gerade verfuegbar; der NPC faellt auf lokale Routinen zurueck. */
export class NoProviderAvailableError extends Error {}
