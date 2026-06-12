import { describe, it, expect } from "vitest";
import { encode, decodeClientMessage, type ClientMessage, type ServerMessage } from "./index.js";

describe("protocol encode/decode", () => {
  it("encodes a valid ClientMessage", () => {
    const msg: ClientMessage = {
      type: "hello",
      name: "Alice",
      characterId: "char123",
    };
    const json = encode(msg);
    expect(json).toBe('{"type":"hello","name":"Alice","characterId":"char123"}');
  });

  it("encodes a valid ServerMessage", () => {
    const msg: ServerMessage = {
      type: "join",
      playerId: 1,
      characterId: "char123",
      name: "Bob",
    };
    const json = encode(msg);
    expect(json).toBe('{"type":"join","playerId":1,"characterId":"char123","name":"Bob"}');
  });

  it("decodes a valid ClientMessage string", () => {
    const raw = '{"type":"hello","name":"Alice","characterId":"char123"}';
    const msg = decodeClientMessage(raw);
    expect(msg).toEqual({
      type: "hello",
      name: "Alice",
      characterId: "char123",
    });
  });

  it("decodes a valid input ClientMessage string", () => {
    const raw = '{"type":"input","seq":1,"tick":100,"input":{"moveX":1,"down":false,"jump":true,"jumpHeld":true,"shoot":false,"aimX":0,"aimY":0}}';
    const msg = decodeClientMessage(raw);
    expect(msg).toEqual({
      type: "input",
      seq: 1,
      tick: 100,
      input: {
        moveX: 1,
        down: false,
        jump: true,
        jumpHeld: true,
        shoot: false,
        aimX: 0,
        aimY: 0,
      },
    });
  });

  it("throws when decoding invalid JSON", () => {
    const raw = '{"type":"hello",'; // Incomplete JSON
    expect(() => decodeClientMessage(raw)).toThrow(SyntaxError);
  });

  it("throws when decoding an invalid schema", () => {
    const raw = '{"type":"hello","name":"","characterId":""}'; // Empty strings fail min(1) validation
    expect(() => decodeClientMessage(raw)).toThrow();
  });

  it("throws when decoding missing required fields", () => {
    const raw = '{"type":"hello"}';
    expect(() => decodeClientMessage(raw)).toThrow();
  });

  it("throws when decoding unknown type", () => {
    const raw = '{"type":"unknown"}';
    expect(() => decodeClientMessage(raw)).toThrow();
  });
});
