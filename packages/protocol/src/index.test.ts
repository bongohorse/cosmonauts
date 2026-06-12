import { describe, it, expect } from "vitest";
import { decodeClientMessage } from "./index.js";
import type { ClientMessage } from "./index.js";
import { ZodError } from "zod";

describe("decodeClientMessage", () => {
  it("should successfully decode a valid hello message", () => {
    const raw = JSON.stringify({
      type: "hello",
      name: "TestUser",
      characterId: "char1",
    });

    const result = decodeClientMessage(raw);

    expect(result).toEqual({
      type: "hello",
      name: "TestUser",
      characterId: "char1",
    });
  });

  it("should successfully decode a valid input message", () => {
    const raw = JSON.stringify({
      type: "input",
      seq: 1,
      tick: 100,
      input: {
        moveX: 1,
        down: false,
        jump: true,
        jumpHeld: true,
        shoot: false,
        aimX: 0.5,
        aimY: 0.5,
      },
    });

    const result = decodeClientMessage(raw);

    expect(result).toEqual({
      type: "input",
      seq: 1,
      tick: 100,
      input: {
        moveX: 1,
        down: false,
        jump: true,
        jumpHeld: true,
        shoot: false,
        aimX: 0.5,
        aimY: 0.5,
      },
    });
  });

  it("should throw SyntaxError if input is invalid JSON", () => {
    const raw = "{ invalid_json: ";
    expect(() => decodeClientMessage(raw)).toThrow(SyntaxError);
  });

  it("should throw ZodError if valid JSON but missing required fields", () => {
    const raw = JSON.stringify({
      type: "hello",
      // missing name and characterId
    });

    expect(() => decodeClientMessage(raw)).toThrow(ZodError);
  });

  it("should throw ZodError if valid JSON but wrong types", () => {
    const raw = JSON.stringify({
      type: "hello",
      name: 123, // should be string
      characterId: "char1",
    });

    expect(() => decodeClientMessage(raw)).toThrow(ZodError);
  });

  it("should throw ZodError if type discriminator is unknown", () => {
    const raw = JSON.stringify({
      type: "unknown_type",
    });

    expect(() => decodeClientMessage(raw)).toThrow(ZodError);
  });
});
