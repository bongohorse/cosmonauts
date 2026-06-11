import { describe, expect, it } from "vitest";
import { DT, FLUX_INTERVAL_TICKS } from "./constants";
import { ARENA, entity, input, makeWorld, player, run } from "./test-helpers";

describe("map entities", () => {
  it("jumper launches the player", () => {
    const TALL_ARENA = [
      "##########",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "#S.......#",
      "##########",
    ];
    const world = makeWorld(
      TALL_ARENA,
      [],
      [
        {
          id: "j1",
          type: "jumper",
          pos: { x: 3, y: 8.5 },
          size: { w: 2, h: 1 },
          enabled: true,
          params: { direction: 90, strength: 20 },
        },
      ],
    );

    // Walk into the jumper (at x=3, player starts at x=1.5, y=8.2)
    run(world, 20, input({ moveX: 1 }));
    expect(player(world).vel.y).toBeLessThan(-9);
    expect(player(world).grounded).toBe(false);
  });

  it("forceField applies constant force", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "f1",
          type: "forceField",
          pos: { x: 3, y: 5 },
          size: { w: 2, h: 2 },
          enabled: true,
          params: { forceX: 10, forceY: -50 }, // Stronger than gravity (38)
        },
      ],
    );

    run(world, 20, input({ moveX: 1 })); // Inside the field
    const v1y = player(world).vel.y;
    run(world, 1, input({ moveX: 1 }));
    // Force field adds 10*DT, but stepPlayer might approach(v1, 8, accel*DT)
    expect(player(world).vel.x).not.toBe(8);
    expect(player(world).vel.y).toBeCloseTo(v1y + (38 - 50) * DT);
  });

  it("teleporter moves the player to the target", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "t1",
          type: "teleporter",
          pos: { x: 3, y: 5.5 },
          size: { w: 1, h: 1 },
          enabled: true,
          params: { targetId: "t2", preserveVelocity: false },
        },
        {
          id: "t2",
          type: "teleporter",
          pos: { x: 7, y: 5.5 },
          size: { w: 1, h: 1 },
          enabled: true,
          params: { targetId: "t1" },
        },
      ],
    );

    // Run until we are past t1's x=3.
    run(world, 40, input({ moveX: 1 }));
    expect(player(world).pos.x).toBeGreaterThan(8);
  });

  it("fireField damages the player", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "fire",
          type: "fireField",
          pos: { x: 3, y: 5.5 },
          size: { w: 2, h: 2 },
          enabled: true,
          params: { dps: 100 },
        },
      ],
    );

    run(world, 20, input({ moveX: 1 }));
    const h1 = player(world).health;
    run(world, 1, input({ moveX: 1 }));
    expect(player(world).health).toBeLessThan(h1);
  });

  it("healField heals the player", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "heal",
          type: "healField",
          pos: { x: 3, y: 5.5 },
          size: { w: 2, h: 2 },
          enabled: true,
          params: { hps: 50 },
        },
      ],
    );

    player(world).health = 50;
    run(world, 20, input({ moveX: 1 }));
    const h1 = player(world).health;
    run(world, 1, input({ moveX: 1 }));
    expect(player(world).health).toBeGreaterThan(h1);
  });

  it("killZone kills the player and triggers respawn", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "kill",
          type: "killZone",
          pos: { x: 3, y: 5.5 },
          size: { w: 1, h: 1 },
          enabled: true,
          params: {},
        },
      ],
    );

    run(world, 20, input({ moveX: 1 }));
    expect(player(world).pos.x).toBeLessThan(3);
    expect(player(world).health).toBeGreaterThan(0);
  });

  it("disabled entities have no effect", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "j1",
          type: "jumper",
          pos: { x: 3, y: 5.5 },
          size: { w: 2, h: 1 },
          enabled: false,
          params: { direction: 90, strength: 20 },
        },
      ],
    );

    run(world, 30, input({ moveX: 1 }));
    expect(player(world).vel.y).toBe(0);
  });

  it("door blocks movement when enabled and lets players pass when disabled", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "door1",
          type: "door",
          pos: { x: 3, y: 5.5 },
          size: { w: 1, h: 3 },
          enabled: true,
          params: { rotation: 0 },
        },
      ],
    );

    // Player starts at x=1.5. A door is at x=3.
    // Try to run right, player should be blocked by the door.
    run(world, 20, input({ moveX: 1 }));
    expect(player(world).pos.x).toBeLessThan(2.6);

    // Now disable the door
    const door = world.state.mapEntities[0];
    if (door) door.enabled = false;
    run(world, 20, input({ moveX: 1 }));
    expect(player(world).pos.x).toBeGreaterThan(4);
  });

  it("activator in toggle mode toggles door state when player enters it", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "act1",
          type: "activator",
          pos: { x: 2.5, y: 5.5 },
          size: { w: 1, h: 1 },
          enabled: true,
          params: { mode: "toggle", trigger: "touch", cooldownTicks: 30 },
          targets: ["door1"],
        },
        {
          id: "door1",
          type: "door",
          pos: { x: 5, y: 5.5 },
          size: { w: 1, h: 3 },
          enabled: true,
          params: {},
        },
      ],
    );

    // Door starts enabled (solid)
    expect(world.state.mapEntities[1]?.enabled).toBe(true);

    // Player runs right. When player overlaps with act1 (at x=2.5), it should toggle the door to disabled.
    run(world, 20, input({ moveX: 1 }));

    // Door should now be open
    expect(world.state.mapEntities[1]?.enabled).toBe(false);

    // Player should be able to walk right past x=5
    run(world, 20, input({ moveX: 1 }));
    expect(player(world).pos.x).toBeGreaterThan(6);
  });

  it("activator in momentary mode opens the door only while player is inside", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "act1",
          type: "activator",
          pos: { x: 3.5, y: 5.5 },
          size: { w: 2, h: 2 },
          enabled: true,
          params: { mode: "momentary", trigger: "touch" },
          targets: ["door1"],
        },
        {
          id: "door1",
          type: "door",
          pos: { x: 6, y: 5.5 },
          size: { w: 1, h: 3 },
          enabled: true,
          params: {},
        },
      ],
    );

    // Player starts at x=1.5, runs right.
    // At x=1.5, not in activator. Door is enabled.
    expect(world.state.mapEntities[1]?.enabled).toBe(true);

    // Run 20 ticks. Player should be in the activator (around x=3.5). Door should be disabled (open).
    run(world, 20, input({ moveX: 1 }));
    expect(world.state.mapEntities[1]?.enabled).toBe(false);

    // Run further right. Player will leave the activator (x > 4.5).
    // Door should become enabled again.
    run(world, 30, input({ moveX: 1 }));
    expect(player(world).pos.x).toBeGreaterThan(4.5);
    // Since player is past activator, door should be enabled (closed)
    expect(world.state.mapEntities[1]?.enabled).toBe(true);
  });

  it("timer enables/disables targets periodically", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "timer1",
          type: "timer",
          pos: { x: 0, y: 0 },
          size: { w: 1, h: 1 },
          enabled: true,
          params: { periodTicks: 40, onDurationTicks: 20, startDelayTicks: 10 },
          targets: ["door1"],
        },
        {
          id: "door1",
          type: "door",
          pos: { x: 5, y: 5.5 },
          size: { w: 1, h: 3 },
          enabled: true,
          params: {},
        },
      ],
    );

    // Ticks 0..9: delay phase. Timer not active, door remains enabled (true)
    for (let t = 0; t < 9; t++) {
      run(world, 1);
      expect(world.state.mapEntities[1]?.enabled).toBe(true);
    }

    // Tick 10: timer becomes active, door is disabled (false)
    run(world, 1);
    expect(world.state.mapEntities[1]?.enabled).toBe(false);

    // Ticks 10..28: timer active, door remains disabled
    for (let t = 11; t < 29; t++) {
      run(world, 1);
      expect(world.state.mapEntities[1]?.enabled).toBe(false);
    }

    // Tick 29: last active tick
    run(world, 1);
    expect(world.state.mapEntities[1]?.enabled).toBe(false);

    // Tick 30: timer cycle goes to off, door is enabled (true)
    run(world, 1);
    expect(world.state.mapEntities[1]?.enabled).toBe(true);
  });

  it("teamBarrier blocks enemies and allows own team, and downgrades when disabled", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "barrier1",
          type: "teamBarrier",
          pos: { x: 3, y: 5.5 },
          size: { w: 1, h: 3 },
          enabled: true,
          params: { team: "RED", downgradeTo: "glass" },
        },
      ],
    );

    const spawnY = player(world).pos.y;

    // Default player is Team A. Team A player should walk straight through.
    run(world, 40, input({ moveX: 1 }));
    expect(player(world).pos.x).toBeGreaterThan(4);

    // Reset player position and change team to B.
    player(world).pos.x = 1.5;
    player(world).pos.y = spawnY;
    player(world).vel.x = 0;
    player(world).vel.y = 0;
    player(world).team = "BLU";

    // Team B player should be blocked by the Team A barrier.
    run(world, 20, input({ moveX: 1 }));
    expect(player(world).pos.x).toBeLessThan(2.6);

    // Now disable the barrier. It should downgrade to glass.
    const barrier = world.state.mapEntities[0];
    if (barrier) barrier.enabled = false;

    // Team B player should now be able to walk through the barrier since it's glass
    // (from the side it acts as glass, which has no side collision).
    run(world, 20, input({ moveX: 1 }));
    expect(player(world).pos.x).toBeGreaterThan(4);

    // And they should be able to stand on top of it.
    player(world).pos.x = 3;
    player(world).pos.y = 2; // above the barrier (barrier is at y=5.5, top is at y=4.0)
    player(world).vel.x = 0;
    player(world).vel.y = 0;
    run(world, 20); // fall down
    expect(player(world).grounded).toBe(true);
    expect(player(world).groundGlass).toBe(true);
  });

  it("activator in damage mode triggers when hit by a projectile", () => {
    const world = makeWorld(
      ARENA,
      [],
      [
        {
          id: "act1",
          type: "activator",
          pos: { x: 4, y: 5.5 },
          size: { w: 1, h: 1 },
          enabled: true,
          params: { mode: "toggle", trigger: "damage", cooldownTicks: 30 },
          targets: ["door1"],
        },
        {
          id: "door1",
          type: "door",
          pos: { x: 6, y: 5.5 },
          size: { w: 1, h: 3 },
          enabled: true,
          params: {},
        },
      ],
    );

    // Shoot projectile to the right (towards act1 at x=4)
    run(world, 1, input({ shoot: true, aimX: 1, aimY: 0 }));
    expect(world.state.projectiles).toHaveLength(1);

    // Run until projectile hits activator and is destroyed, toggling the door
    run(world, 20);
    expect(world.state.projectiles).toHaveLength(0);
    expect(world.state.mapEntities[1]?.enabled).toBe(false); // Door is open!
  });

  describe("pickups & economy", () => {
    it("ambient fluxCube and healthPickup can be collected and respawn", () => {
      const world = makeWorld(
        ARENA,
        [],
        [
          {
            id: "flux1",
            type: "fluxCube",
            pos: { x: 3, y: 5.5 },
            size: { w: 1, h: 1 },
            enabled: true,
            params: { denomination: "5", respawnTimeTicks: 60 },
          },
          {
            id: "hp1",
            type: "healthPickup",
            pos: { x: 4, y: 5.5 },
            size: { w: 1, h: 1 },
            enabled: true,
            params: { amount: 30, respawnTimeTicks: 60 },
          },
        ],
      );

      // Reduce player health first
      player(world).health = 50;
      expect(player(world).flux).toBe(0);

      // Walk through flux1 (at x=3)
      run(world, 20, input({ moveX: 1 }));
      expect(player(world).flux).toBe(5);
      expect(world.state.mapEntities[0]?.enabled).toBe(false);
      expect(world.state.mapEntities[0]?.cooldown).toBe(49);

      // Walk through hp1 (at x=4)
      run(world, 10, input({ moveX: 1 }));
      expect(player(world).health).toBe(80);
      expect(world.state.mapEntities[1]?.enabled).toBe(false);
      expect(world.state.mapEntities[1]?.cooldown).toBe(46);

      // Wait for respawn (50 ticks)
      run(world, 50);
      expect(world.state.mapEntities[0]?.enabled).toBe(true);
      expect(world.state.mapEntities[1]?.enabled).toBe(true);
    });

    it("dropped pickups home towards the player and get collected", () => {
      const world = makeWorld(ARENA, [], []);
      world.state.pickups.push({
        id: world.state.nextEntityId++,
        kind: "flux",
        pos: { x: 5, y: 3 },
        vel: { x: 0, y: 0 },
        amount: 1,
        homingPlayerId: player(world).id,
        ticksLeft: 100,
      });

      expect(world.state.pickups).toHaveLength(1);

      // Run several ticks, pickup should fly to the player and get collected
      run(world, 20);
      expect(world.state.pickups).toHaveLength(0);
      expect(player(world).flux).toBe(1);
    });

    it("dummy death drops pickups on hero projectile hit", () => {
      const DUMMY_ARENA = [
        "##########",
        "#........#",
        "#........#",
        "#........#",
        "#........#",
        "#S....D..#",
        "##########",
      ];
      const world = makeWorld(DUMMY_ARENA, [], []);
      // Ensure a dummy is alive
      expect(world.state.dummies).toHaveLength(1);
      const dummy = world.state.dummies[0];
      if (dummy === undefined) throw new Error("no dummy");
      dummy.health = 5; // make it low health

      // Shoot projectile at it (dummy is at x=5.5, y=5.5)
      player(world).pos.x = 2;
      player(world).pos.y = 5.5;
      run(world, 1, input({ shoot: true, aimX: 1, aimY: 0 }));

      // Run until hit
      run(world, 20);
      expect(dummy.health).toBeLessThanOrEqual(0);
      // It should have dropped 2 flux cubes (homing to hero) and 1 health pickup (non-homing)
      expect(world.state.pickups).toHaveLength(3);

      const fluxCubes = world.state.pickups.filter((p) => p.kind === "flux");
      const hpPickups = world.state.pickups.filter((p) => p.kind === "health");
      expect(fluxCubes).toHaveLength(2);
      expect(hpPickups).toHaveLength(1);

      expect(fluxCubes[0]?.homingPlayerId).toBe(player(world).id);
      expect(hpPickups[0]?.homingPlayerId).toBeUndefined();
    });

    it("does not collect health pickups if health is full", () => {
      const world = makeWorld(
        ARENA,
        [],
        [
          {
            id: "hp1",
            type: "healthPickup",
            pos: { x: 3, y: 5.5 },
            size: { w: 1, h: 1 },
            enabled: true,
            params: { amount: 30, respawnTimeTicks: 60 },
          },
        ],
      );

      // Player has full health (100)
      expect(player(world).health).toBe(100);

      // Walk through hp1 (at x=3)
      run(world, 20, input({ moveX: 1 }));
      expect(player(world).health).toBe(100);
      expect(world.state.mapEntities[0]?.enabled).toBe(true); // Left untouched
    });

    it("dropped pickups collide with solid platforms", () => {
      // Put a solid rect platform at y=4, and drop a health pack above it
      const world = makeWorld(
        ARENA,
        [
          {
            id: "plat",
            kind: "rect",
            solidity: "solid",
            pos: [5, 4.5],
            size: [4, 1],
          },
        ],
        [],
      );

      // Add a live health pickup at x=5, y=2 (above platform) falling down
      world.state.pickups.push({
        id: world.state.nextEntityId++,
        kind: "health",
        pos: { x: 5, y: 2 },
        vel: { x: 0, y: 1 },
        amount: 20,
        ticksLeft: 100,
      });

      // Run simulation so pickup falls and hits the platform
      run(world, 50);

      const pk = world.state.pickups[0];
      expect(pk).toBeDefined();
      if (pk) {
        // Platform is at y=4.5 (size 1 means top edge is at y=4.0).
        // With pickup radius 0.25, it should land around y = 4.0 - 0.25 = 3.75.
        expect(pk.pos.y).toBeCloseTo(3.75, 1);
        expect(pk.vel.y).toBe(0);
      }
    });

    it("shop heals teammate inside it but not if they are at full health", () => {
      // Base at x=3, y=5 (RED team, heals 50 hps)
      const shop = entity("shop", 3, 5, { team: "RED", hps: 50 }, { size: { w: 4, h: 4 } });
      const world = makeWorld(ARENA, [], [shop]);

      const p = player(world);
      p.team = "RED";
      p.health = 40;
      p.pos.x = 3;
      p.pos.y = 5; // inside shop bounds

      // Run 6 ticks (0.1 seconds at 60Hz)
      // healing: 50 hps * 0.1s = 5 health.
      // So player health should become 45.
      run(world, 6);
      expect(p.health).toBeCloseTo(45, 1);

      // Now run 100 ticks to heal fully (should cap at 100)
      run(world, 100);
      expect(p.health).toBe(100);
    });

    it("shop does not heal enemy team or players outside shop bounds", () => {
      const shop = entity("shop", 3, 5, { team: "RED", hps: 50 }, { size: { w: 4, h: 4 } });
      const world = makeWorld(ARENA, [], [shop]);

      const p = player(world);
      p.team = "BLU"; // enemy team
      p.health = 40;
      p.pos.x = 3;
      p.pos.y = 5;

      run(world, 6);
      expect(p.health).toBe(40); // no healing for enemy team

      p.team = "RED"; // teammate again
      p.pos.x = 8;
      p.pos.y = 5; // outside shop bounds (shop is x=3 w=4 => bounds [1, 5], player is at x=8)

      run(world, 6);
      expect(p.health).toBe(40); // no healing outside shop
    });

    it("upgrade purchase works only inside team shop with enough flux", () => {
      const shop = entity("shop", 3, 5, { team: "RED", hps: 50 }, { size: { w: 4, h: 4 } });
      const world = makeWorld(ARENA, [], [shop]);

      const p = player(world);
      p.team = "RED";
      p.pos.x = 3;
      p.pos.y = 5; // inside shop
      p.flux = 4; // not enough for speed level 1 (costs 5)

      // Try to buy speed upgrade
      run(world, 1, input({ buyUpgrade: "speed" }));
      expect(p.upgrades.speed).toBe(0);
      expect(p.flux).toBe(4);

      // Add flux and try again
      p.flux = 15;
      run(world, 1, input({ buyUpgrade: "speed" }));
      expect(p.upgrades.speed).toBe(1);
      expect(p.flux).toBe(10); // cost 5 spent

      // Move player out of shop
      p.pos.x = 8;
      run(world, 1, input({ buyUpgrade: "speed" }));
      expect(p.upgrades.speed).toBe(1); // no change because outside shop
      expect(p.flux).toBe(10);
    });

    it("passive flux income awards 1 flux every 2 seconds", () => {
      const world = makeWorld(ARENA, [], []);
      const p = player(world);
      expect(p.flux).toBe(0);

      // After FLUX_INTERVAL_TICKS steps, state.tick has reached 120 but
      // the check for tick 120 fires during step 121 (tick is checked
      // before incrementing). So we need one extra step.
      run(world, FLUX_INTERVAL_TICKS);
      expect(p.flux).toBe(0); // not yet
      run(world, 1);
      expect(p.flux).toBe(1); // now tick=120 was checked

      // Run another full interval
      run(world, FLUX_INTERVAL_TICKS);
      expect(p.flux).toBe(2);

      // Half an interval more — no additional flux
      run(world, FLUX_INTERVAL_TICKS / 2);
      expect(p.flux).toBe(2);
    });
  });
});
