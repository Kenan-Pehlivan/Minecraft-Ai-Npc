package de.kenanpehlivan.npcbridge;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.bukkit.Bukkit;
import org.bukkit.command.PluginCommand;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.messaging.PluginMessageListener;

/**
 * Serverseitiger Teil des NPC-Systems. In M0:
 * - Freigabe: NPC-Konten duerfen nur nach "npc spawn" auf den Server.
 * - Notfall-Stopp und Despawn wirken auch ohne Runtime (Kick).
 * - Handshake ueber den Plugin-Messaging-Kanal.
 */
public final class NpcBridgePlugin extends JavaPlugin implements Listener, PluginMessageListener {

    private NpcRegistry registry;
    private final Set<String> bridgeConfirmed = ConcurrentHashMap.newKeySet();

    @Override
    public void onEnable() {
        saveDefaultConfig();
        registry = new NpcRegistry(getConfig().getStringList("npcs"));
        if (registry.entries().isEmpty()) {
            getLogger().warning("Keine NPC-Konten in config.yml eingetragen");
        }

        getServer().getMessenger().registerOutgoingPluginChannel(this, BridgeMessages.CHANNEL);
        getServer().getMessenger().registerIncomingPluginChannel(this, BridgeMessages.CHANNEL, this);
        getServer().getPluginManager().registerEvents(this, this);

        PluginCommand command = getCommand("npc");
        if (command != null) {
            NpcCommand executor = new NpcCommand(this);
            command.setExecutor(executor);
            command.setTabCompleter(executor);
        }
        getLogger().info("NpcBridge aktiv fuer " + registry.entries().size() + " NPC-Konto(en)");
    }

    @Override
    public void onDisable() {
        getServer().getMessenger().unregisterIncomingPluginChannel(this);
        getServer().getMessenger().unregisterOutgoingPluginChannel(this);
    }

    NpcRegistry registry() {
        return registry;
    }

    boolean isOnline(String username) {
        return Bukkit.getPlayerExact(username) != null;
    }

    boolean isBridgeConfirmed(String username) {
        return bridgeConfirmed.contains(username.toLowerCase());
    }

    /** Bittet den NPC um geordnetes Abmelden und kickt ihn nach der Karenzzeit. */
    void despawn(String username, String reason) {
        Player player = Bukkit.getPlayerExact(username);
        if (player == null) return;
        player.sendPluginMessage(this, BridgeMessages.CHANNEL, BridgeMessages.despawn(reason));
        long graceTicks = Math.max(1, getConfig().getLong("despawn-grace-seconds", 5)) * 20L;
        Bukkit.getScheduler().runTaskLater(this, () -> {
            Player stillOnline = Bukkit.getPlayerExact(username);
            if (stillOnline != null && !registry.isRequested(username)) {
                stillOnline.kickPlayer("NPC wurde entfernt: " + reason);
            }
        }, graceTicks);
    }

    int kickAllNpcs(String reason) {
        int count = 0;
        for (Player player : Bukkit.getOnlinePlayers()) {
            if (registry.isNpc(player.getName())) {
                player.kickPlayer(reason);
                count++;
            }
        }
        return count;
    }

    @EventHandler
    public void onPreLogin(AsyncPlayerPreLoginEvent event) {
        String name = event.getName();
        if (registry.isNpc(name) && !registry.isRequested(name)) {
            event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, "NPC ist nicht angefordert (npc spawn " + name + ")");
            getLogger().info("Login von NPC " + name + " abgelehnt: nicht angefordert");
        }
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        bridgeConfirmed.remove(event.getPlayer().getName().toLowerCase());
    }

    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if (!BridgeMessages.CHANNEL.equals(channel)) return;
        // Nur eingetragene NPC-Konten duerfen die Bruecke benutzen.
        if (!registry.isNpc(player.getName())) {
            getLogger().warning("Bruecken-Nachricht von Nicht-NPC " + player.getName() + " verworfen");
            return;
        }
        String type = BridgeMessages.type(message);
        if ("hello".equals(type)) {
            bridgeConfirmed.add(player.getName().toLowerCase());
            player.sendPluginMessage(this, BridgeMessages.CHANNEL, BridgeMessages.welcome(player.getName()));
            getLogger().info("Bruecke zu NPC " + player.getName() + " bestaetigt");
        } else {
            getLogger().warning("Unbekannte Bruecken-Nachricht von " + player.getName() + ": " + type);
        }
    }
}
