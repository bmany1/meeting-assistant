import { describe, it, expect } from "vitest";
import {
  rebuildLedgerFromRecords,
  ledgerItemKey,
  normalize,
  tokenSetSimilarity,
  fuzzyTombstoneMatch,
  mergeFollowthrough,
  pruneItemState,
  makeTombstone,
  type Item,
  type Decision,
  type Meeting,
  type MeetingData,
  type Project,
  type ProjectData,
  type Followthrough,
} from "../../meeting-assistant";

const DATE = "2026-06-13T00:00:00.000Z";
const NOW = "2026-06-13T12:00:00.000Z";

function mkItem(p: Partial<Item> = {}): Item {
  const base: Item = {
    id: p.id || "it_" + Math.abs(hash(JSON.stringify(p))),
    key: "",
    kind: "todo",
    text: "do the thing",
    owner: "i_owe",
    waiting_on: null,
    priority: "Medium",
    due_date: null,
    due_confirmed: false,
    owner_confirmed: false,
    interval_confirmed: true,
    status: "open",
    project_id: null,
    source: { kind: "meeting", meeting_id: "m1", note_id: "n1", date: DATE },
    quote: "the thing",
    quote_anchored: true,
    occurrence: 0,
    created_at: DATE,
    completed_at: null,
    last_touched: DATE,
    ...p,
  };
  base.key = ledgerItemKey(base);
  return base;
}
function mkDecision(p: Partial<Decision> = {}): Decision {
  const base: Decision = {
    id: p.id || "dec_" + Math.abs(hash(JSON.stringify(p))),
    key: "",
    kind: "decision",
    text: "we decided to ship",
    project_id: null,
    source: { kind: "meeting", meeting_id: "m1", note_id: "n1", date: DATE },
    quote: "decided to ship",
    quote_anchored: true,
    occurrence: 0,
    created_at: DATE,
    ...p,
  };
  base.key = ledgerItemKey(base);
  return base;
}
function mkMeeting(id: string, cadence: Meeting["cadence"] = "Weekly", name = id): Meeting {
  return { id, name, cadence, purpose: "", people: "", last_meeting_date: null, next_meeting_date: null, created_at: DATE };
}
function mkMeetingData(p: Partial<MeetingData> = {}): MeetingData {
  return { summary: "", notes: [], todos: [], decisions: [], talking_points: [], chat: [], updated_at: DATE, ...p };
}
function mkProject(id: string, name = id): Project {
  return { id, name, status: "active", target_date: null, dot_color: "#CE5780", created_at: DATE };
}
function mkProjectData(p: Partial<ProjectData> = {}): ProjectData {
  return { summary: "", updates: [], items: [], decisions: [], updated_at: DATE, ...p };
}
function emptyFt(): Followthrough { return { tombstones: [], item_state: {} }; }
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

describe("rebuildLedgerFromRecords", () => {
  it("produces one ledger item per open source item across meetings + projects", () => {
    const m1 = mkMeeting("m1");
    const m2 = mkMeeting("m2", "Monthly");
    const p1 = mkProject("p1", "Atlas");
    const ledger = rebuildLedgerFromRecords(
      {
        meetings: [m1, m2],
        meetingData: {
          m1: mkMeetingData({ todos: [mkItem({ id: "a", text: "alpha", source: { kind: "meeting", meeting_id: "m1", note_id: "n", date: DATE } })] }),
          m2: mkMeetingData({ todos: [mkItem({ id: "b", text: "bravo", source: { kind: "meeting", meeting_id: "m2", note_id: "n", date: DATE } })] }),
        },
        projects: [p1],
        projectData: { p1: mkProjectData({ items: [mkItem({ id: "c", text: "charlie", source: { kind: "direct", meeting_id: null, note_id: "u", date: DATE } })] }) },
        followthrough: emptyFt(),
      },
      NOW
    );
    expect(ledger.items.map((i) => i.id).sort()).toEqual(["a", "b", "c"]);
    // denormalized meeting name + cadence-derived interval carried through
    const a = ledger.items.find((i) => i.id === "a")!;
    expect(a.source.meeting_name).toBe("m1");
    expect(a.interval_days).toBe(7); // Weekly
    const bMonthly = ledger.items.find((i) => i.id === "b")!;
    expect(bMonthly.interval_days).toBe(30);
  });

  it("excludes a tombstoned key; followthrough is an untouched input", () => {
    const it = mkItem({ id: "x", text: "send the report" });
    const ft: Followthrough = { tombstones: [makeTombstone(it, "done")], item_state: { [it.key]: { escalation: 2, snooze_until: null, last_surfaced: 4 } } };
    const ftSnapshot = JSON.parse(JSON.stringify(ft));
    const ledger = rebuildLedgerFromRecords({ meetings: [mkMeeting("m1")], meetingData: { m1: mkMeetingData({ todos: [it] }) }, projects: [], projectData: {}, followthrough: ft }, NOW);
    expect(ledger.items.find((i) => i.id === "x")).toBeUndefined();
    // rebuild never mutates followthrough — tombstones + engine state survive verbatim
    expect(ft).toEqual(ftSnapshot);
  });

  it("excludes completed/dismissed items and carries project_id through", () => {
    const ledger = rebuildLedgerFromRecords(
      {
        meetings: [mkMeeting("m1")],
        meetingData: {
          m1: mkMeetingData({
            todos: [
              mkItem({ id: "open1", status: "open", project_id: "p1" }),
              mkItem({ id: "done1", text: "finished", status: "completed" }),
              mkItem({ id: "dis1", text: "dropped", status: "dismissed" }),
            ],
          }),
        },
        projects: [mkProject("p1", "Atlas")],
        projectData: { p1: mkProjectData() },
        followthrough: emptyFt(),
      },
      NOW
    );
    expect(ledger.items.map((i) => i.id)).toEqual(["open1"]);
    expect(ledger.items[0].project_id).toBe("p1");
    expect(ledger.items[0].project_name).toBe("Atlas");
  });

  it("two meeting records both appear after rebuild (no cross-record clobber)", () => {
    const ledger = rebuildLedgerFromRecords(
      {
        meetings: [mkMeeting("m1"), mkMeeting("m2")],
        meetingData: {
          m1: mkMeetingData({ todos: [mkItem({ id: "m1a", source: { kind: "meeting", meeting_id: "m1", note_id: "n", date: DATE } })] }),
          m2: mkMeetingData({ todos: [mkItem({ id: "m2a", source: { kind: "meeting", meeting_id: "m2", note_id: "n", date: DATE } })] }),
        },
        followthrough: emptyFt(),
      },
      NOW
    );
    expect(ledger.items.map((i) => i.id).sort()).toEqual(["m1a", "m2a"]);
  });

  it("is deterministic and idempotent (running twice yields identical output)", () => {
    const input = {
      meetings: [mkMeeting("m1")],
      meetingData: { m1: mkMeetingData({ todos: [mkItem({ id: "a" }), mkItem({ id: "b", text: "other" })], decisions: [mkDecision({ id: "d1" })] }) },
      followthrough: emptyFt(),
    };
    const one = rebuildLedgerFromRecords(input, NOW);
    const two = rebuildLedgerFromRecords(input, NOW);
    expect(two).toEqual(one);
  });

  it("includes decisions as kind=decision but they carry no owner/due", () => {
    const ledger = rebuildLedgerFromRecords({ meetings: [mkMeeting("m1")], meetingData: { m1: mkMeetingData({ decisions: [mkDecision({ id: "d1", project_id: "p1" })] }) }, projects: [mkProject("p1")], projectData: { p1: mkProjectData() }, followthrough: emptyFt() }, NOW);
    const d = ledger.items.find((i) => i.id === "d1")!;
    expect(d.kind).toBe("decision");
    expect(d.owner).toBeNull();
    expect(d.due_date).toBeNull();
  });

  it("surfaces an extra open item flagged when more items than tombstones share a key", () => {
    // Two open items with the SAME key (same text, source, occurrence) but one tombstone.
    const a = mkItem({ id: "k1", text: "ping dana", occurrence: 0 });
    const b = mkItem({ id: "k2", text: "ping dana", occurrence: 0 }); // same key as a
    expect(a.key).toBe(b.key);
    const ft: Followthrough = { tombstones: [makeTombstone(a, "redundant")], item_state: {} };
    const ledger = rebuildLedgerFromRecords({ meetings: [mkMeeting("m1")], meetingData: { m1: mkMeetingData({ todos: [a, b] }) }, followthrough: ft }, NOW);
    const surfaced = ledger.items.filter((i) => i.text === "ping dana");
    expect(surfaced.length).toBe(1); // one suppressed, one surfaces
    expect(surfaced[0].resurfaced_flag).toBe(true);
  });
});

describe("keys + normalization", () => {
  it("normalize lowercases, trims, collapses whitespace, strips punctuation", () => {
    expect(normalize("  Send  the REPORT, please!! ")).toBe("send the report please");
  });
  it("occurrence index gives same-worded items distinct keys", () => {
    const a = ledgerItemKey({ text: "follow up with maria", source: { kind: "meeting", meeting_id: "m1", note_id: "n", date: DATE }, occurrence: 0 });
    const b = ledgerItemKey({ text: "follow up with maria", source: { kind: "meeting", meeting_id: "m1", note_id: "n", date: DATE }, occurrence: 1 });
    expect(a).not.toBe(b);
  });
  it("different sources give distinct keys", () => {
    const a = ledgerItemKey({ text: "x", source: { kind: "meeting", meeting_id: "m1", note_id: "n", date: DATE }, occurrence: 0 });
    const b = ledgerItemKey({ text: "x", source: { kind: "direct", meeting_id: null, note_id: "u", date: DATE }, occurrence: 0 });
    expect(a).not.toBe(b);
  });
});

describe("fuzzy resurrection guard", () => {
  it("matches a paraphrase of a dismissed item with the same source", () => {
    const dismissed = mkItem({ text: "follow up with Maria about the budget" });
    const ft: Followthrough = { tombstones: [makeTombstone(dismissed, "done")], item_state: {} };
    const para = { text: "follow up with Maria regarding budget", source: dismissed.source };
    expect(fuzzyTombstoneMatch(para, ft)).not.toBeNull();
  });
  it("does NOT match a genuinely different commitment to the same person", () => {
    const dismissed = mkItem({ text: "follow up with Maria about the budget" });
    const ft: Followthrough = { tombstones: [makeTombstone(dismissed, "done")], item_state: {} };
    const fresh = { text: "follow up with Maria about hiring", source: dismissed.source };
    expect(fuzzyTombstoneMatch(fresh, ft, 0.72)).toBeNull();
  });
  it("does not match across different sources", () => {
    const dismissed = mkItem({ text: "send the deck", source: { kind: "meeting", meeting_id: "m1", note_id: "n", date: DATE } });
    const ft: Followthrough = { tombstones: [makeTombstone(dismissed, "done")], item_state: {} };
    const other = { text: "send the deck", source: { kind: "meeting", meeting_id: "m2", note_id: "n", date: DATE } as Item["source"] };
    expect(fuzzyTombstoneMatch(other, ft)).toBeNull();
  });
});

describe("followthrough merge + prune", () => {
  it("set-unions tombstones and takes later snooze/last_surfaced per key", () => {
    const base: Followthrough = { tombstones: [{ key: "k1", original_text: "x", source_ref: "meeting:m1", reason: "done", dismissed_at: "2026-06-01T00:00:00Z" }], item_state: { a: { escalation: 1, snooze_until: "2026-06-10T00:00:00Z", last_surfaced: 2 } } };
    const desired: Followthrough = { tombstones: [{ key: "k2", original_text: "y", source_ref: "meeting:m1", reason: "wrong", dismissed_at: "2026-06-02T00:00:00Z" }], item_state: { a: { escalation: 3, snooze_until: "2026-06-12T00:00:00Z", last_surfaced: 5 } } };
    const merged = mergeFollowthrough(base, desired);
    expect(merged.tombstones.map((t) => t.key).sort()).toEqual(["k1", "k2"]);
    expect(merged.item_state.a).toEqual({ escalation: 3, snooze_until: "2026-06-12T00:00:00Z", last_surfaced: 5 });
  });
  it("prune drops item_state for tombstoned or non-open keys, retains tombstones", () => {
    const ft: Followthrough = { tombstones: [{ key: "dead", original_text: "x", source_ref: "meeting:m1", reason: "done", dismissed_at: DATE }], item_state: { dead: { escalation: 1, snooze_until: null, last_surfaced: 1 }, alive: { escalation: 0, snooze_until: null, last_surfaced: 2 }, gone: { escalation: 0, snooze_until: null, last_surfaced: 3 } } };
    const pruned = pruneItemState(ft, new Set(["alive"]));
    expect(Object.keys(pruned.item_state)).toEqual(["alive"]);
    expect(pruned.tombstones.length).toBe(1);
  });
});

describe("tokenSetSimilarity", () => {
  it("identical strings score 1, disjoint score 0", () => {
    expect(tokenSetSimilarity("send the report", "send the report")).toBe(1);
    expect(tokenSetSimilarity("alpha beta", "gamma delta")).toBe(0);
  });
});
