# Minecraft AI-NPC

Autonome NPCs für eine Minecraft-Java-Survival-Welt. Jeder NPC ist ein echter Spieler-Client
([Mineflayer](https://github.com/PrismarineJS/mineflayer)), gesteuert von einer lokalen
Verhaltens-Engine. Ein Sprachmodell kommt nur für Gespräche und größere Entscheidungen dazu.

Planung und Architektur: [Technische Planungsphase](https://claude.ai/code/artifact/951071f8-c669-4c88-80ad-a9b6f1dbecf6)

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `runtime/` | Agent-Runtime (TypeScript, Node.js): Bot, Steuerung, KI-Anbindung |
| `plugin/` | Spigot-Plugin **NpcBridge** (Java): Freigabe, Notfall-Stopp, Brücke |
| `protocol/` | Nachrichten zwischen Runtime und Plugin |
| `deploy/` | Lokaler Testserver (Docker) |

Die KI-Anbindung ist austauschbar und läuft standardmäßig über Gratis-Kontingente
(Groq, dann Cerebras als Ersatz). Kostenpflichtige Anbieter werden nur genutzt,
wenn `llm.allowPaid: true` gesetzt ist.

## Stand: Meilenstein M0 (Fundament)

- NPC betritt die Welt nur nach `npc spawn <name>` in der Serverkonsole und verlässt sie mit `npc despawn <name>`.
- `npc stop` entfernt sofort alle NPCs, auch wenn die Runtime nicht reagiert.
- NPC-Konten werden beim Login abgewiesen, solange sie nicht angefordert sind.
- Der NPC antwortet im Chat, wenn man ihn mit Namen anspricht oder ihm flüstert.
- Jeder KI-Aufruf wird in `runtime/data/llm-usage.jsonl` protokolliert; Limits pro Anbieter werden lokal eingehalten.
- Antworten des Modells werden nie als Befehl gesendet (ein führendes `/` wird entfernt).

Bewegung, Abbau, Crafting und Überleben folgen ab M1.

## Einrichtung

### 1. Plugin auf den Server (Nitrado)

1. `npcbridge-0.1.0.jar` herunterladen: GitHub → Actions → letzter grüner Lauf → Artefakt `npcbridge-plugin`
   (oder selbst bauen: `cd plugin && ./gradlew build`, Ergebnis in `plugin/build/libs/`).
2. Die Datei in den Ordner `plugins/` des Servers hochladen und den Server neu starten.
3. In `plugins/NpcBridge/config.yml` unter `npcs` den Minecraft-Namen des NPC-Kontos eintragen, Server neu starten.
4. RCON im Nitrado-Webinterface aktivieren, Passwort setzen und den RCON-Port notieren.

### 2. Runtime auf dem eigenen PC

Voraussetzung: [Node.js 22](https://nodejs.org) oder neuer.

```bash
git clone https://github.com/Kenan-Pehlivan/Minecraft-Ai-Npc.git
cd Minecraft-Ai-Npc/runtime
npm ci
cp config.example.yaml config.yaml   # Serveradresse, RCON-Port, NPC-Name, Persönlichkeit eintragen
cp .env.example .env                 # API-Schlüssel und RCON-Passwort eintragen
npm run build
npm start
```

API-Schlüssel (kostenlos): [Groq](https://console.groq.com/keys) und [Cerebras](https://cloud.cerebras.ai).
Modellnamen und Gratis-Limits in `config.yaml` vor dem ersten Start mit den aktuellen Angaben der Anbieter abgleichen.

Beim ersten Verbinden zeigt die Runtime einen Link und einen Code für die Microsoft-Anmeldung des NPC-Kontos.
Danach werden die Tokens in `runtime/data/auth/` gespeichert. Das Passwort wird nie benötigt.

### 3. Benutzung (Serverkonsole)

| Befehl | Wirkung |
| --- | --- |
| `npc spawn <name>` | NPC betritt die Welt (Runtime muss laufen) |
| `npc despawn <name>` | NPC meldet sich ab |
| `npc stop` | Notfall-Stopp: alle NPCs sofort entfernen |
| `npc status` | Angefordert, online, Brücke bestätigt |

## Entwicklung

```bash
cd runtime && npm test        # Unit-Tests der Runtime
cd plugin && ./gradlew build  # Plugin bauen und testen
```

Lokaler Testserver: siehe `deploy/docker-compose.yml` (Spigot im Offline-Modus, nur für Tests).
