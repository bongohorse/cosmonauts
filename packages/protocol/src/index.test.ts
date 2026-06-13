import { describe, expect, it } from "vitest";
import { type ClientMessage, decodeClientMessage, encode } from "./index";

const hello: ClientMessage = { type: "hello", name: "Alice", characterId: "nova" };
const inputMsg: ClientMessage = {
  type: "input",
  seq: 3,
  tick: 7,
  input: {
    moveX: 1,
    down: false,
    jump: true,
    jumpHeld: false,
    shoot: false,
    aimX: 0.5,
    aimY: -0.5,
  },
};

describe("encode", () => {
  it("serializes a client message to JSON", () => {
    expect(encode(hello)).toBe('{"type":"hello","name":"Alice","characterId":"nova"}');
  });
  it("serializes a server message to JSON", () => {
    expect(encode({ type: "join", playerId: 1, characterId: "nova", name: "Bob" })).toBe(
      '{"type":"join","playerId":1,"characterId":"nova","name":"Bob"}',
    );
  });
});

describe("decodeClientMessage", () => {
  it("round-trips valid hello and input messages", () => {
    expect(decodeClientMessage(encode(hello))).toEqual(hello);
    expect(decodeClientMessage(encode(inputMsg))).toEqual(inputMsg);
  });
  it("throws on malformed JSON", () => {
    expect(() => decodeClientMessage("{not json")).toThrow();
  });
  it("rejects unknown message types", () => {
    expect(() => decodeClientMessage('{"type":"bye"}')).toThrow();
  });
  it("rejects missing and empty required fields", () => {
    expect(() => decodeClientMessage('{"type":"hello"}')).toThrow();
    expect(() => decodeClientMessage('{"type":"hello","name":"","characterId":"x"}')).toThrow();
  });
  it("rejects out-of-range aim input", () => {
    const bad =
      '{"type":"input","seq":0,"tick":0,"input":{"moveX":0,"down":false,"jump":false,"jumpHeld":false,"shoot":false,"aimX":2,"aimY":0}}';
    expect(() => decodeClientMessage(bad)).toThrow();
  });
});
