import { describe, it, expect, beforeEach } from "vitest";
import { storage, safeParseJSON, stripJSONFences, uid, nowISO, KEY, SCHEMA_VERSION } from "../../meeting-assistant";

// These run against the in-memory window.storage shim that activates under
// jsdom (no real window.storage). They prove the wrapper contract the whole
// app relies on. AI behavior is NOT tested here (no key locally).

describe("storage wrapper (in-memory shim)", () => {
  beforeEach(async () => {
    // clear any keys touched by prior tests
    for (const k of await storage.list("")) await storage.delete(k);
  });

  it("round-trips an object through set/getJSON", async () => {
    const obj = { a: 1, b: ["x", "y"], nested: { ok: true } };
    const ok = await storage.set("meeting:test", obj);
    expect(ok).toBe(true);
    const back = await storage.getJSON<typeof obj>("meeting:test");
    expect(back).toEqual(obj);
  });

  it("returns null for a missing key (does not throw)", async () => {
    const back = await storage.getJSON("does:not:exist");
    expect(back).toBeNull();
  });

  it("stores strings verbatim and stringifies non-strings", async () => {
    await storage.set("k:str", "plain");
    expect(await storage.get("k:str")).toBe("plain");
    await storage.set("k:num", { n: 2 });
    expect(JSON.parse((await storage.get("k:num"))!)).toEqual({ n: 2 });
  });

  it("delete removes a key", async () => {
    await storage.set("k:del", { x: 1 });
    await storage.delete("k:del");
    expect(await storage.get("k:del")).toBeNull();
  });
});

describe("JSON helpers", () => {
  it("strips markdown fences and preamble", () => {
    expect(stripJSONFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("safeParseJSON recovers an object from fenced/preamble-wrapped text", () => {
    expect(safeParseJSON('```json\n{"a":1}\n```', null)).toEqual({ a: 1 });
    expect(safeParseJSON('Here you go: {"a":2} cheers', null)).toEqual({ a: 2 });
    expect(safeParseJSON('[1,2,3]', null)).toEqual([1, 2, 3]);
  });

  it("safeParseJSON returns fallback on garbage", () => {
    expect(safeParseJSON("not json at all", "FB")).toBe("FB");
    expect(safeParseJSON("", { d: 1 })).toEqual({ d: 1 });
  });
});

describe("primitive helpers", () => {
  it("uid is unique across calls and carries the prefix", () => {
    const a = uid("todo");
    const b = uid("todo");
    expect(a).not.toBe(b);
    expect(a.startsWith("todo_")).toBe(true);
  });

  it("nowISO is a parseable ISO timestamp", () => {
    expect(Number.isNaN(Date.parse(nowISO()))).toBe(false);
  });

  it("KEY builders namespace correctly", () => {
    expect(KEY.meeting("m1")).toBe("meeting:m1");
    expect(KEY.project("p1")).toBe("project:p1");
    expect(SCHEMA_VERSION).toBe(2);
  });
});
