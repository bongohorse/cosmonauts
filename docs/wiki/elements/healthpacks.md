# Healthpacks & Pickups

The pickup system manages physical drops in the world, primarily consisting of Healthpacks and Flux (currency).



- **Function:** Restores HP instantly on pickup.
- **Sources:** Dropped primarily by Jungle Creeps when killed. They can also be placed ambiently on the map by designers.
- **Respawn Mechanics:** Map-placed healthpacks adhere to a strict **120-second respawn timer**. 
- **Minimap Logic:** Active healthpacks appear as green dots on the minimap. This also ties into the UI logic for showing allied units near creeps.
- **Boss Creep:** The boss creep provides a massive 3000 HP heal directly to the killer rather than dropping a physical pack.
