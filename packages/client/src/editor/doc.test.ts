import { describe, expect, it } from "vitest";
import { docFromJson } from "./doc";

describe("docFromJson", () => {
  it("parses valid map JSON successfully", () => {
    const validJson = JSON.stringify({
      id: "test-map",
      name: "Test Map",
      tiles: ["####", "#..#", "####"],
    });

    const doc = docFromJson(validJson);
    expect(doc.id).toBe("test-map");
    expect(doc.name).toBe("Test Map");
    expect(doc.tiles).toEqual(["####", "#..#", "####"]);
  });

  it("throws on invalid JSON string", () => {
    const invalidJson = "{ id: 'test-map', name: 'Test Map' "; // Missing closing brace, invalid keys
    expect(() => docFromJson(invalidJson)).toThrow();
  });

  it("throws validation error on missing required fields", () => {
    // Missing 'tiles' which is required by MapDefSchema
    const missingFieldsJson = JSON.stringify({
      id: "test-map",
      name: "Test Map",
    });

    expect(() => docFromJson(missingFieldsJson)).toThrowError(/tiles/i);
  });

  it("throws validation error on invalid tile data", () => {
    const invalidTilesJson = JSON.stringify({
      id: "test-map",
      name: "Test Map",
      tiles: ["###", "##"], // rows have different lengths, forbidden by MapDefSchema
    });

    expect(() => docFromJson(invalidTilesJson)).toThrowError(/length/i);
  });
});
