import { describe, it, expect } from "vitest";
import {
  classifyImport,
  validateImportStructure,
  normalizeImport,
  planImportWrites,
  rebuildLedgerFromRecords,
  SCHEMA_VERSION,
  KEY,
} from "../../meeting-assistant";

const NOW = "2026-06-13T00:00:00Z";

const v2Payload = {
  schema_version: 2,
  meetings: [{ id: "m1", name: "Team weekly", cadence: "Weekly", purpose: "", people: "", last_meeting_date: null, next_meeting_date: null, created_at: NOW }],
  meetingData: { m1: { summary: "s", notes: [], todos: [{ id: "t1", key: "k", kind: "todo", text: "alpha", owner: "i_owe", waiting_on: null, priority: "High", due_date: null, due_confirmed: false, owner_confirmed: true, interval_confirmed: true, status: "open", project_id: null, source: { kind: "meeting", meeting_id: "m1", note_id: null, date: NOW }, quote: "", quote_anchored: false, occurrence: 0, created_at: NOW, completed_at: null, last_touched: NOW }], decisions: [], talking_points: [], chat: [], updated_at: NOW } },
  projects: [{ id: "p1", name: "Atlas", status: "active", target_date: null, dot_color: "#CE5780", created_at: NOW }],
  projectData: { p1: { summary: "", updates: [], items: [], decisions: [], updated_at: NOW } },
  followthrough: { tombstones: [{ key: "dead::meeting:m1::0", original_text: "x", source_ref: "meeting:m1", reason: "done", dismissed_at: NOW }], item_state: { "k": { escalation: 2, snooze_until: null, last_surfaced: 3 } } },
  meta: { schema_version: 2 },
};

// A real v1 export: no schema_version field, legacy Todo shape.
const v1Payload = {
  exported_at: NOW,
  meetings: [{ id: "m1", name: "1:1 with Maria", cadence: "Biweekly", purpose: "", people: "Maria", last_meeting_date: null, next_meeting_date: null, created_at: NOW }],
  meetingData: { m1: { summary: "", notes: [{ id: "n1", timestamp: NOW, content: "raw" }], todos: [{ id: "t1", text: "legacy todo", priority: "Medium", due_date: "2026-06-20", source_meeting_id: "m1", source_note_id: "n1", source_snippet: "do the legacy thing", status: "open", created_at: NOW, completed_at: null }], decisions: [{ id: "d1", text: "legacy decision", source_note_id: "n1", timestamp: NOW }], talking_points: [], chat: [] } },
};

describe("classifyImport", () => {
  it("classifies v2 and v1 explicitly", () => {
    expect(classifyImport(v2Payload)).toMatchObject({ ok: true, version: 2 });
    expect(classifyImport({ schema_version: 1, meetings: [] })).toMatchObject({ ok: true, version: 1 });
  });
  it("classifies a version-LESS v1-shaped export as v1 (not reject)", () => {
    expect(classifyImport(v1Payload)).toMatchObject({ ok: true, version: 1 });
  });
  it("rejects a newer version and unrecognized files", () => {
    expect(classifyImport({ schema_version: 99, meetings: [] }).ok).toBe(false);
    expect(classifyImport({ foo: "bar" }).ok).toBe(false);
    expect(classifyImport(null).ok).toBe(false);
  });
});

describe("validateImportStructure (whole-payload before any write)", () => {
  it("passes a well-formed payload", () => {
    expect(validateImportStructure(v2Payload).ok).toBe(true);
  });
  it("fails on malformed meeting records", () => {
    expect(validateImportStructure({ meetings: [{ id: "m1" }] }).ok).toBe(false); // missing name
    expect(validateImportStructure({ meetings: "nope" }).ok).toBe(false);
  });
});

describe("normalizeImport", () => {
  it("v2 round-trips records + followthrough (tombstones + engine state survive)", () => {
    const n = normalizeImport(v2Payload, 2, NOW);
    expect(n.meetings.length).toBe(1);
    expect(n.meetingData.m1.todos[0].text).toBe("alpha");
    expect(n.projects.length).toBe(1);
    expect(n.followthrough.tombstones.length).toBe(1);
    expect(n.followthrough.item_state["k"].escalation).toBe(2);
    // a rebuilt ledger excludes the tombstoned key, keeps the open item
    const ledger = rebuildLedgerFromRecords(n, NOW);
    expect(ledger.items.find((i) => i.id === "t1")).toBeTruthy();
  });

  it("migrates v1 forward with defaulted fields and a correct rebuilt ledger", () => {
    const n = normalizeImport(v1Payload, 1, NOW);
    const item = n.meetingData.m1.todos[0];
    expect(item.owner).toBe("i_owe"); // default
    expect(item.due_confirmed).toBe(false); // legacy dates are inferred
    expect(item.project_id).toBeNull();
    expect(item.interval_confirmed).toBe(true);
    expect(item.quote).toBe("do the legacy thing"); // source_snippet carried as quote
    expect(item.key).toBeTruthy();
    expect(n.meetingData.m1.decisions[0].kind).toBe("decision");
    expect(n.followthrough.tombstones.length).toBe(0); // v1 has none
    const ledger = rebuildLedgerFromRecords(n, NOW);
    expect(ledger.items.filter((i) => i.kind !== "decision").map((i) => i.text)).toEqual(["legacy todo"]);
  });
});

describe("planImportWrites", () => {
  it("plans lists, records, followthrough, and meta v2 (validate-before-write order)", () => {
    const n = normalizeImport(v2Payload, 2, NOW);
    const writes = planImportWrites(n, "acc_1");
    const keys = writes.map((w) => w.key);
    expect(keys).toContain(KEY.meetingsList);
    expect(keys).toContain(KEY.meeting("m1"));
    expect(keys).toContain(KEY.projectsList);
    expect(keys).toContain(KEY.project("p1"));
    expect(keys).toContain(KEY.followthrough);
    expect(keys).toContain(KEY.meta);
    const meta = writes.find((w) => w.key === KEY.meta)!.value;
    expect(meta.schema_version).toBe(SCHEMA_VERSION);
  });
});
