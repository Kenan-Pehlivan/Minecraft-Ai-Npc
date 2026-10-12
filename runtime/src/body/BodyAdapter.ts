/**
 * Der "Koerper" eines NPC in der Welt. Planer und Gedaechtnis sprechen nur gegen
 * diese Schnittstelle; heute steckt Mineflayer dahinter, spaeter waere ein anderer
 * Adapter moeglich. M0 enthaelt nur Verbindung und Chat; Bewegung, Abbau und
 * Crafting folgen in M1.
 */
export interface BodyAdapter {
  readonly username: string;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(reason: string): void;
  say(text: string): void;
  whisper(player: string, text: string): void;
  sendBridge(payload: Buffer): void;
  on(event: 'chat', listener: (player: string, message: string, whisper: boolean) => void): this;
  on(event: 'bridge', listener: (payload: Buffer) => void): this;
  on(event: 'disconnected', listener: (reason: string) => void): this;
}
