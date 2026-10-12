import { NpcAgent } from './agent/npcAgent.js';
import { MineflayerBody } from './body/mineflayerBody.js';
import { ConfigError, loadConfig, requireEnv } from './config/load.js';
import { RconPresenceSource } from './control/rconControl.js';
import { Supervisor } from './control/supervisor.js';
import { createLlmClient } from './llm/index.js';
import { log } from './log.js';

async function main(): Promise<void> {
  const configPath = process.argv[2] ?? 'config.yaml';
  const config = loadConfig(configPath);
  const llm = createLlmClient(config, log);

  const agents = config.npcs.map(
    (npc) =>
      new NpcAgent(
        npc,
        new MineflayerBody({
          host: config.server.host,
          port: config.server.port,
          username: npc.username,
          auth: config.server.auth,
          version: config.server.version,
          dataDir: config.dataDir,
          log,
        }),
        llm,
        config,
        log,
      ),
  );

  const source = new RconPresenceSource({
    host: config.rcon.host,
    port: config.rcon.port,
    password: requireEnv(config.rcon.passwordEnv),
  });
  const supervisor = new Supervisor(agents, source, log, { pollIntervalMs: config.rcon.pollIntervalMs });

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Runtime wird beendet');
    await supervisor.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  log.info(
    { npcs: config.npcs.map((n) => n.username), providers: llm.status().map((p) => p.provider) },
    'Runtime gestartet, warte auf "npc spawn" im Server',
  );
  supervisor.start();
}

main().catch((err: Error) => {
  log.fatal({ err: err.message }, err instanceof ConfigError ? 'Konfigurationsfehler' : 'Start fehlgeschlagen');
  process.exit(1);
});
