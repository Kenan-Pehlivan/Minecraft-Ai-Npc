package de.kenanpehlivan.npcbridge;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Welche NPC-Konten es gibt und welche gerade in der Welt sein sollen.
 * Thread-sicher, weil Login-Pruefungen asynchron laufen.
 * Nach einem Serverneustart ist kein NPC angefordert (sicherer Standard).
 */
public final class NpcRegistry {

    public record Entry(String username, boolean requested) {}

    private final Map<String, String> knownByKey = new ConcurrentHashMap<>();
    private final Set<String> requested = ConcurrentHashMap.newKeySet();

    public NpcRegistry(Collection<String> usernames) {
        for (String name : usernames) {
            knownByKey.put(key(name), name);
        }
    }

    public boolean isNpc(String username) {
        return knownByKey.containsKey(key(username));
    }

    /** Liefert den eingetragenen Namen in Originalschreibweise oder null. */
    public String canonical(String username) {
        return knownByKey.get(key(username));
    }

    public boolean request(String username) {
        if (!isNpc(username)) return false;
        requested.add(key(username));
        return true;
    }

    public boolean release(String username) {
        if (!isNpc(username)) return false;
        requested.remove(key(username));
        return true;
    }

    public void releaseAll() {
        requested.clear();
    }

    public boolean isRequested(String username) {
        return requested.contains(key(username));
    }

    public List<Entry> entries() {
        List<Entry> list = new ArrayList<>();
        for (String name : knownByKey.values()) {
            list.add(new Entry(name, requested.contains(key(name))));
        }
        list.sort((a, b) -> a.username().compareToIgnoreCase(b.username()));
        return list;
    }

    private static String key(String username) {
        return username.toLowerCase(Locale.ROOT);
    }
}
