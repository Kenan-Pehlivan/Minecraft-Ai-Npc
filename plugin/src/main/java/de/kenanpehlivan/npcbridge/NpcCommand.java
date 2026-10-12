package de.kenanpehlivan.npcbridge;

import java.util.ArrayList;
import java.util.List;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.ConsoleCommandSender;
import org.bukkit.command.RemoteConsoleCommandSender;
import org.bukkit.command.TabExecutor;

/** /npc spawn|despawn|stop|status|poll */
final class NpcCommand implements TabExecutor {

    private final NpcBridgePlugin plugin;

    NpcCommand(NpcBridgePlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) return false;
        NpcRegistry registry = plugin.registry();
        switch (args[0].toLowerCase()) {
            case "spawn" -> {
                if (args.length < 2) return false;
                if (!registry.request(args[1])) {
                    sender.sendMessage("Unbekannter NPC: " + args[1] + " (in config.yml unter npcs eintragen)");
                    return true;
                }
                plugin.getLogger().info(sender.getName() + " hat NPC " + registry.canonical(args[1]) + " angefordert");
                sender.sendMessage("NPC " + registry.canonical(args[1]) + " angefordert; er betritt die Welt, sobald die Runtime verbunden ist.");
            }
            case "despawn" -> {
                if (args.length < 2) return false;
                if (!registry.release(args[1])) {
                    sender.sendMessage("Unbekannter NPC: " + args[1]);
                    return true;
                }
                plugin.despawn(registry.canonical(args[1]), "npc despawn");
                sender.sendMessage("NPC " + registry.canonical(args[1]) + " verlaesst die Welt.");
            }
            case "stop" -> {
                // Notfall-Stopp: wirkt sofort, auch wenn die Runtime nicht reagiert.
                registry.releaseAll();
                int kicked = plugin.kickAllNpcs("Notfall-Stopp durch " + sender.getName());
                plugin.getLogger().warning("Notfall-Stopp durch " + sender.getName() + ", " + kicked + " NPC(s) entfernt");
                sender.sendMessage("Notfall-Stopp: alle NPCs entfernt (" + kicked + ").");
            }
            case "status" -> {
                for (NpcRegistry.Entry entry : registry.entries()) {
                    sender.sendMessage(entry.username() + ": " + (entry.requested() ? "angefordert" : "aus")
                            + ", " + (plugin.isOnline(entry.username()) ? "online" : "offline")
                            + (plugin.isBridgeConfirmed(entry.username()) ? ", Bruecke ok" : ""));
                }
            }
            case "poll" -> {
                // Nur fuer die Runtime ueber RCON bzw. die Konsole gedacht.
                if (!(sender instanceof RemoteConsoleCommandSender) && !(sender instanceof ConsoleCommandSender)) {
                    sender.sendMessage("Nur ueber Konsole oder RCON.");
                    return true;
                }
                sender.sendMessage(BridgeMessages.poll(registry.entries(), plugin::isOnline));
            }
            default -> {
                return false;
            }
        }
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        List<String> out = new ArrayList<>();
        if (args.length == 1) {
            for (String sub : List.of("spawn", "despawn", "stop", "status")) {
                if (sub.startsWith(args[0].toLowerCase())) out.add(sub);
            }
        } else if (args.length == 2 && (args[0].equalsIgnoreCase("spawn") || args[0].equalsIgnoreCase("despawn"))) {
            for (NpcRegistry.Entry entry : plugin.registry().entries()) {
                if (entry.username().toLowerCase().startsWith(args[1].toLowerCase())) out.add(entry.username());
            }
        }
        return out;
    }
}
