package de.kenanpehlivan.npcbridge;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class NpcRegistryTest {

    @Test
    void nurEingetrageneNpcsKoennenAngefordertWerden() {
        NpcRegistry registry = new NpcRegistry(List.of("Bjarne"));
        assertFalse(registry.isRequested("bjarne"));
        assertTrue(registry.request("BJARNE"));
        assertTrue(registry.isRequested("Bjarne"));
        assertEquals("Bjarne", registry.canonical("bjarne"));
        assertFalse(registry.request("Fremder"));
    }

    @Test
    void notfallStoppGibtAlleFrei() {
        NpcRegistry registry = new NpcRegistry(List.of("A_npc", "B_npc"));
        registry.request("A_npc");
        registry.request("B_npc");
        registry.releaseAll();
        assertTrue(registry.entries().stream().noneMatch(NpcRegistry.Entry::requested));
    }

    @Test
    void pollAntwortIstEineJsonZeile() {
        NpcRegistry registry = new NpcRegistry(List.of("Bjarne"));
        registry.request("Bjarne");
        String json = BridgeMessages.poll(registry.entries(), name -> false);
        assertEquals("{\"v\":1,\"npcs\":[{\"username\":\"Bjarne\",\"requested\":true,\"online\":false}]}", json);
        assertFalse(json.contains("\n"));
    }

    @Test
    void ungueltigeNachrichtenWerdenErkannt() {
        assertEquals("hello", BridgeMessages.type("{\"type\":\"hello\",\"version\":1}".getBytes()));
        assertEquals(null, BridgeMessages.type("kaputt{".getBytes()));
        assertEquals(null, BridgeMessages.type("[1,2]".getBytes()));
    }
}
