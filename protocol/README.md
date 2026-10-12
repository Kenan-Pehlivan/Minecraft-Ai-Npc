# Protokoll Runtime ↔ Server

Zwei Wege, beide ohne zusätzlichen Port auf dem Minecraft-Server.

## 1. RCON (Runtime → Server, Steuerung)

Die Runtime fragt alle `rcon.pollIntervalMs` (Standard 3 s) per RCON:

```
npc poll
```

Antwort (eine JSON-Zeile):

```json
{"v":1,"npcs":[{"username":"Bjarne","requested":true,"online":false}]}
```

- `requested`: im Server wurde `npc spawn <name>` ausgeführt und noch kein `npc despawn`.
- `online`: das Konto ist gerade auf dem Server.

Die Runtime verbindet jeden NPC mit `requested: true` und trennt jeden mit `requested: false`.

## 2. Plugin-Messaging (Bot ↔ Plugin, über die Spielerverbindung)

Kanal `npcbridge:main`, Inhalt UTF-8-JSON. Das Plugin akzeptiert Nachrichten nur von Konten, die in `config.yml` unter `npcs` stehen.

| Richtung | Nachricht | Bedeutung |
| --- | --- | --- |
| Bot → Plugin | `{"type":"hello","version":1}` | Bot ist in der Welt und meldet sich an |
| Plugin → Bot | `{"type":"welcome","version":1,"npc":"Bjarne"}` | Brücke bestätigt |
| Plugin → Bot | `{"type":"despawn","reason":"npc despawn"}` | Bot soll sich abmelden; nach `despawn-grace-seconds` wird er gekickt |

Spätere Meilensteine ergänzen hier Rechteprüfungen (darf der NPC hier abbauen?), Zahlungen und Ereignisse.

## Sicherheit

- NPC-Konten werden beim Login abgewiesen, solange sie nicht angefordert sind.
- `npc stop` kickt alle NPCs sofort, unabhängig von der Runtime.
- `npc poll` funktioniert nur über Konsole oder RCON, nicht im Spielerchat.
