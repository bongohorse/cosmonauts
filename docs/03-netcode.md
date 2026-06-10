# 03 — Netcode Design

**Status:** v1, 2026-06-10. The contract for `packages/protocol` + `packages/server` and the
client prediction layer. Implementation target: the netcode milestone (M7 in the revised
roadmap, doc 01 §8 — deliberately after creation tools).

## 1. Architecture recap

Authoritative server + client-side prediction (decision in doc 01 §2):

- The server runs the **identical `sim` package** at 60 Hz. It is the only truth.
- Clients send inputs; the server applies them and broadcasts snapshots.
- Each client **predicts its own naut** by running `sim` locally on its own inputs the
  instant they happen → zero perceived input latency.
- Remote entities render from an **interpolation buffer** ~100 ms in the past.

## 2. Server

- **Runtime: Node 24+** (LTS, runs everywhere, zero exotic dependencies; revisit Bun only
  if profiling demands it). Dev via `tsx`, prod via compiled JS. Ships as one Docker image.
- One process hosts: a lobby (create/join via short room codes) and N match rooms, each an
  independent `GameState` stepped at 60 Hz (`setTimeout`-corrected loop; drift-compensated).
- Snapshot broadcast at **20 Hz** (every 3rd tick). Full-state snapshots first — at our
  entity counts a full JSON snapshot is a few KB; delta compression is a later optimization,
  not a prerequisite.

## 3. Protocol (`packages/protocol`)

All messages are zod-validated. JSON over the wire first; the codec sits behind one
`encode/decode` pair so a binary format can replace it without touching game code.

```
client → server
  hello     { name, characterId }
  input     { seq, tick, input: PlayerInput }     // sent every sim tick (60 Hz, tiny)

server → client
  welcome   { playerId, map, players, serverTick }
  snapshot  { tick, state: GameState, acks: { [playerId]: lastProcessedSeq } }
  join/leave { player }
```

Input messages are sent unbatched at 60 Hz (~50 bytes each); if measurement shows overhead,
batch 2–3 per packet. Each input carries a client sequence number; `acks` in snapshots tell
each client which of its inputs the authoritative state already includes.

## 4. Client prediction & reconciliation

Per the analysis (§6), the glue is small because the sim was built for it:

```
on local tick:
  sample input → send to server → push (seq, input) into pending ring buffer
  step(predictedState, { me: input })            // predict self only

on snapshot(tick T, acks):
  drop pending inputs with seq ≤ acks[me]
  predictedState = cloneState(snapshot.state)
  for each pending input: step(predictedState, { me: input })   // replay
  // smooth any visible correction: exponentially blend render position
  // toward predicted position over ~100 ms instead of snapping
```

- **Prediction scope: own naut only** (movement, jumps, facing, cooldowns). Own projectiles
  are spawned predictively for instant muzzle feedback but reconcile to server truth.
- **Remote entities:** keep the last ~10 snapshots; render at `renderTime = serverTime −
  interpolationDelay` (default 100 ms, tunable) by lerping between bracketing snapshots.
- **Clock sync:** client tracks estimated server tick via snapshot arrival + RTT/2 (simple
  EWMA), and paces its input ticks to stay slightly ahead of the server.

## 5. Transport

```ts
interface Transport {
  send(bytes: Uint8Array | string): void;
  onMessage(cb): void; onClose(cb): void;
}
```

1. **v1: WebSocket** (`ws` on server, native in browser). Works everywhere today, including
   behind every NAT/proxy. Cost: TCP head-of-line blocking under loss — accepted for v1.
2. **v2 candidates** behind the same interface: WebRTC DataChannel in unreliable/unordered
   mode (needs signaling, which the lobby already is) or WebTransport (datagram support,
   pending Safari coverage — evaluate at M3 time, not before).

Because inputs are idempotent-per-seq and snapshots are full-state, the protocol already
tolerates loss/reorder — switching to an unreliable transport changes latency behavior, not
correctness.

## 6. Misc policies

- **Late join / reconnect:** server keeps slots open for a grace period; rejoining gets
  `welcome` + next snapshot — full-state snapshots make this free (a Galactron lesson).
- **Cheating posture (MVP):** server validates input shape and rate-limits; it does not try
  to detect inhuman play. Authoritative state means clients can't lie about position/damage.
- **Tab throttling:** a hidden tab stops rendering and sending inputs; the server treats
  missing inputs as neutral (sim doc §6) and the client fast-forwards from snapshots on
  return.
- **Network debug overlay (ships with M3):** RTT, snapshot age, pending-input count,
  corrections/sec, bytes in/out. Tuning interpolation delay without this is guesswork.
