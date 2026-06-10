import type { GameState, PlayerInput } from "@cosmonauts/sim";
import { z } from "zod";

// Wire protocol v0 (doc 03 §3). JSON now; encode/decode is the single seam
// where a binary codec can replace it. Implementation target: Milestone 3.
//
// Validation policy: the server zod-validates everything clients send (the
// trust boundary); clients trust server messages, which are typed only.

export const PlayerInputSchema = z.object({
  moveX: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  jump: z.boolean(),
  jumpHeld: z.boolean(),
  shoot: z.boolean(),
  aimX: z.number().min(-1).max(1),
  aimY: z.number().min(-1).max(1),
}) satisfies z.ZodType<PlayerInput>;

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    name: z.string().min(1).max(24),
    characterId: z.string().min(1),
  }),
  z.object({
    type: z.literal("input"),
    seq: z.number().int().nonnegative(),
    tick: z.number().int().nonnegative(),
    input: PlayerInputSchema,
  }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export interface WelcomeMessage {
  type: "welcome";
  playerId: number;
  serverTick: number;
  state: GameState;
}

export interface SnapshotMessage {
  type: "snapshot";
  tick: number;
  state: GameState;
  /** Per player: highest input seq included in this state (doc 03 §4). */
  acks: Record<number, number>;
}

export interface JoinMessage {
  type: "join";
  playerId: number;
  characterId: string;
  name: string;
}

export interface LeaveMessage {
  type: "leave";
  playerId: number;
}

export type ServerMessage = WelcomeMessage | SnapshotMessage | JoinMessage | LeaveMessage;

export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

export function decodeClientMessage(raw: string): ClientMessage {
  return ClientMessageSchema.parse(JSON.parse(raw));
}
