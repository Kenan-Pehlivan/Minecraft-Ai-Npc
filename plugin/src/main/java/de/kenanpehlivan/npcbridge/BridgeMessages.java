package de.kenanpehlivan.npcbridge;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.function.Predicate;

/** JSON-Nachrichten zwischen Plugin und Runtime (siehe protocol/README.md). */
public final class BridgeMessages {

    public static final String CHANNEL = "npcbridge:main";
    public static final int VERSION = 1;
    private static final Gson GSON = new Gson();

    private BridgeMessages() {}

    /** Antwort auf "npc poll": eine einzelne JSON-Zeile. */
    public static String poll(List<NpcRegistry.Entry> entries, Predicate<String> online) {
        JsonObject root = new JsonObject();
        root.addProperty("v", VERSION);
        JsonArray npcs = new JsonArray();
        for (NpcRegistry.Entry entry : entries) {
            JsonObject npc = new JsonObject();
            npc.addProperty("username", entry.username());
            npc.addProperty("requested", entry.requested());
            npc.addProperty("online", online.test(entry.username()));
            npcs.add(npc);
        }
        root.add("npcs", npcs);
        return GSON.toJson(root);
    }

    public static byte[] welcome(String npc) {
        JsonObject message = new JsonObject();
        message.addProperty("type", "welcome");
        message.addProperty("version", VERSION);
        message.addProperty("npc", npc);
        return GSON.toJson(message).getBytes(StandardCharsets.UTF_8);
    }

    public static byte[] despawn(String reason) {
        JsonObject message = new JsonObject();
        message.addProperty("type", "despawn");
        message.addProperty("reason", reason);
        return GSON.toJson(message).getBytes(StandardCharsets.UTF_8);
    }

    /** Liest den Nachrichtentyp; null bei ungueltigen Daten. */
    public static String type(byte[] payload) {
        try {
            JsonObject message = JsonParser.parseString(new String(payload, StandardCharsets.UTF_8)).getAsJsonObject();
            return message.has("type") ? message.get("type").getAsString() : null;
        } catch (JsonParseException | IllegalStateException | UnsupportedOperationException e) {
            return null;
        }
    }
}
