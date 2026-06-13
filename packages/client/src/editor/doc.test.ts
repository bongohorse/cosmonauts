import { describe, expect, it } from "vitest";
import { docFromJson } from "./doc";

describe("docFromJson", () => {
  it("parses a valid map document", () => {
    const doc = docFromJson(JSON.stringify({ id: "m", name: "My Map", tiles: ["..", "..", ".."] }));
    expect(doc.id).toBe("m");
    expect(doc.name).toBe("My Map");
    expect(doc.tiles).toHaveLength(3);
  });

  it("throws on malformed JSON", () => {
    expect(() => docFromJson("{ not valid")).toThrow();
  });

  it("rejects a document missing required fields", () => {
    expect(() => docFromJson(JSON.stringify({ id: "m", name: "M" }))).toThrowError(/tiles/i);
  });

  it("rejects tile rows of unequal length", () => {
    expect(() =>
      docFromJson(JSON.stringify({ id: "m", name: "M", tiles: ["##", "#"] })),
    ).toThrowError(/length/i);
  });
});
