import { describe, it, expect, beforeEach } from "vitest";
import {
  proposalToItem,
  resolveAcceptedTags,
  applyAcceptToMeetingData,
  applyAcceptToProjectData,
  resolveCompletions,
  mergeRerun,
  buildRerunPrompt,
  emptyMeetingData,
  emptyProjectData,
  addMeetingNote,
  addProjectUpdate,
  isUntouchedStale,
  ledgerItemKey,
  rebuildLedgerFromRecords,
  commitMeetingData,
  storage,
  KEY,
  type Proposal,
  type Project,
  type SourceRef,
  type Item,
  type StaleInput,
  type ExtractionContext,
} from "../../meeting-assistant";

const SRC: SourceRef = { kind: "meeting", meeting_id: "m1", note_id: "n1", date: "2026-06-13T00:00:00Z" };
const NOW = "2026-06-13T12:00:00.000Z";
function daysAgo(n: number): string { return new Date(new Date(NOW).getTime() - n * 86400000).toISOString(); }

function prop(p: Partial<Proposal>): Proposal {
  return {
    id: p.id || "p" + Math.random().toString(36).slice(2), kind: "todo", text: "do x", owner: "i_owe", waiting_on: null,
    priority: "Medium", due_date: null, due_confirmed: false, owner_confirmed: false, interval_confirmed: true,
    project_id: null, project_proposed_name: null, is_completion: false, completes_item_id: null,
    quote: "x", quote_anchored: true, anchor_index: 0, anchor_len: 1, occurrence: 0, source: SRC,
    inferred: { due: false, owner: true }, ...p,
  };
}
function proj(name: string, id: string): Project {
  return { id, name, status: "active", target_date: null, dot_color: "#2C2A4A", created_at: NOW };
}
function openItem(text: string, id: string): Item {
  const it: Item = {
    id, key: "", kind: "todo", text, owner: "i_owe", waiting_on: null, priority: "Medium", due_date: null,
    due_confirmed: false, owner_confirmed: false, interval_confirmed: true, status: "open", project_id: null,
    source: SRC, quote: text, quote_anchored: true, occurrence: 0, created_at: NOW, completed_at: null, last_touched: NOW,
  };
  it.key = ledgerItemKey(it);
  return it;
}

describe("proposalToItem", () => {
  it("maps a proposal to an open item with a stable key, preserving inferred flags (R20)", () => {
    const it = proposalToItem(prop({ text: "send the deck", due_date: "2026-06-19T00:00:00Z", due_confirmed: false }), NOW);
    expect(it.status).toBe("open");
    expect(it.due_confirmed).toBe(false); // accept does NOT auto-confirm inference
    expect(it.key).toBe(ledgerItemKey({ text: "send the deck", source: SRC, occurrence: 0 }));
  });
});

describe("U1: resolveAcceptedTags — commit applies only user-confirmed tags (R1/R2/R3, restores R20)", () => {
  const projects = [proj("Apollo", "pr_apollo")];

  it("leaves an unconfirmed row whose proposed name matches an existing project at project_id null (AE1 — deletion regression guard)", () => {
    const rows = [prop({ project_id: null, project_proposed_name: "Apollo" })];
    const out = resolveAcceptedTags(rows, projects);
    // No name-matching at commit: an existing-name match still requires an
    // explicit confirm during verification, so it stays untagged here.
    expect(out[0].project_id).toBe(null);
  });

  it("passes a confirmed row (project_id set) through unchanged", () => {
    const rows = [prop({ project_id: "pr_apollo", project_proposed_name: null })];
    const out = resolveAcceptedTags(rows, projects);
    expect(out[0].project_id).toBe("pr_apollo");
  });

  it("a non-matching (new) proposed name commits untagged with no proposed-name field on the item", () => {
    const rows = [prop({ project_id: null, project_proposed_name: "Brand new project" })];
    const out = resolveAcceptedTags(rows, projects);
    expect(out[0].project_id).toBe(null);
    const item = proposalToItem(out[0], NOW);
    expect(item.project_id).toBe(null);
    expect("project_proposed_name" in item).toBe(false);
  });

  it("a mixed batch keeps only the confirmed project_ids", () => {
    const rows = [
      prop({ id: "a", project_id: "pr_apollo", project_proposed_name: null }),
      prop({ id: "b", project_id: null, project_proposed_name: "Apollo" }),
      prop({ id: "c", project_id: null, project_proposed_name: "Nonexistent" }),
    ];
    const out = resolveAcceptedTags(rows, projects);
    expect(out.map((r) => r.project_id)).toEqual(["pr_apollo", null, null]);
  });
});

describe("applyAcceptToMeetingData", () => {
  it("adds accepted items and decisions to the meeting record (AE5 commit)", () => {
    const md = applyAcceptToMeetingData(emptyMeetingData(), [prop({ text: "alpha" }), prop({ kind: "decision", text: "ship v2" })], NOW);
    expect(md.todos.length).toBe(1);
    expect(md.decisions.length).toBe(1);
    expect(md.decisions[0].text).toBe("ship v2");
  });

  it("an inferred completion marks the matching open to-do done (gated -> accepted)", () => {
    const md = { ...emptyMeetingData(), todos: [openItem("send the budget to finance", "t1")] };
    const completion = prop({ is_completion: true, text: "sent budget" });
    (completion as any)._completesText = "send the budget to finance";
    const next = applyAcceptToMeetingData(md, [completion], NOW);
    expect(next.todos.find((t) => t.id === "t1")!.status).toBe("completed");
  });

  it("a declined completion leaves the to-do open (it is simply not in the accepted set)", () => {
    const md = { ...emptyMeetingData(), todos: [openItem("send the budget", "t1")] };
    const next = applyAcceptToMeetingData(md, [], NOW); // completion declined -> not passed
    expect(next.todos.find((t) => t.id === "t1")!.status).toBe("open");
  });
});

describe("resolveCompletions", () => {
  it("matches a completion to the best open to-do above threshold", () => {
    const items = [openItem("send the cutover plan to Priya", "t1"), openItem("book the venue", "t2")];
    const ids = resolveCompletions(items, ["sent the cutover plan to Priya"]);
    expect(ids.has("t1")).toBe(true);
    expect(ids.has("t2")).toBe(false);
  });
  it("does not match when nothing is similar enough", () => {
    const items = [openItem("book the venue", "t1")];
    expect(resolveCompletions(items, ["refactor the billing service"]).size).toBe(0);
  });
});

describe("mergeRerun (additive re-run)", () => {
  it("keeps the fixed set and appends genuinely new items", () => {
    const fixed = [prop({ id: "f1", text: "send the deck" })];
    const additions = [prop({ id: "a1", text: "book the venue" }), prop({ id: "a2", text: "send the deck" })];
    const merged = mergeRerun(fixed, additions);
    expect(merged.map((m) => m.text).sort()).toEqual(["book the venue", "send the deck"]); // dup dropped
  });
  it("re-run prompt instructs the model not to re-emit the fixed items", () => {
    const ctx: ExtractionContext = { destKind: "meeting", meetingName: "Team weekly", cadence: "Weekly", projectNames: [], openTodos: [], today: "2026-06-13" };
    const p = buildRerunPrompt("the note", [prop({ text: "send the deck" })], "you missed the vendor decision", ctx);
    expect(p).toContain("Do NOT re-emit");
    expect(p).toContain("send the deck");
    expect(p).toContain("vendor decision");
  });
});

describe("accept -> single ledger rebuild reflects the committed set (integration)", () => {
  beforeEach(async () => { for (const k of await storage.list("")) await storage.delete(k); });

  it("commits proposals to the meeting record; one rebuild surfaces exactly them", async () => {
    const m = { id: "m1", name: "Team weekly", cadence: "Weekly" as const, purpose: "", people: "", last_meeting_date: null, next_meeting_date: null, created_at: NOW };
    await storage.set(KEY.meetingsList, [m]);
    await storage.set(KEY.meeting("m1"), emptyMeetingData());
    await commitMeetingData("m1", (cur) => applyAcceptToMeetingData(cur, [prop({ text: "alpha" }), prop({ text: "bravo" })], NOW));
    const md = await storage.getJSON<any>(KEY.meeting("m1"));
    const ledger = rebuildLedgerFromRecords({ meetings: [m], meetingData: { m1: md }, followthrough: { tombstones: [], item_state: {} } }, NOW);
    expect(ledger.items.filter((i) => i.kind !== "decision").map((i) => i.text).sort()).toEqual(["alpha", "bravo"]);
  });
});

describe("U1: event-date seeding of staleness + provenance (R5/R6/R7)", () => {
  const tenDaysAgo = daysAgo(10);
  const srcTenDaysAgo: SourceRef = { kind: "meeting", meeting_id: "m1", note_id: "n1", date: tenDaysAgo };

  it("proposalToItem seeds last_touched from the source (event) date, keeping created_at at the ingestion now (AE2)", () => {
    const it = proposalToItem(prop({ source: srcTenDaysAgo }), NOW);
    expect(it.last_touched).toBe(tenDaysAgo); // ages from the meeting date, not the paste-in time
    expect(it.created_at).toBe(NOW); // a true record of when it was entered
  });

  it("falls back to the ingestion now for last_touched when the proposal has no source date (back-compat)", () => {
    const it = proposalToItem(prop({ source: { ...SRC, date: undefined as any } }), NOW);
    expect(it.last_touched).toBe(NOW);
  });

  it("applyAcceptToMeetingData propagates the seeded last_touched into the stored item", () => {
    const md = applyAcceptToMeetingData(emptyMeetingData(), [prop({ text: "alpha", source: srcTenDaysAgo })], NOW);
    const item = md.todos.find((t) => t.text === "alpha")!;
    expect(item.last_touched).toBe(tenDaysAgo);
    expect(item.created_at).toBe(NOW);
  });

  it("applyAcceptToProjectData propagates the seeded last_touched into the stored item", () => {
    const pd = applyAcceptToProjectData(emptyProjectData(), [prop({ text: "beta", source: { kind: "direct", meeting_id: null, note_id: "u1", date: tenDaysAgo } })], NOW);
    const item = pd.items.find((t) => t.text === "beta")!;
    expect(item.last_touched).toBe(tenDaysAgo);
  });

  it("a backfilled commitment 10 days old with a confirmed 7-day interval is immediately untouched-stale (R7/AE2)", () => {
    const it = proposalToItem(prop({ interval_confirmed: true, source: srcTenDaysAgo }), NOW);
    const stale: StaleInput = {
      status: it.status, due_date: it.due_date, due_confirmed: it.due_confirmed,
      last_touched: it.last_touched, interval_days: 7, interval_confirmed: it.interval_confirmed,
    };
    expect(isUntouchedStale(stale, new Date(NOW))).toBe(true);
  });

  it("addMeetingNote/addProjectUpdate stamp note.timestamp from the optional argument, defaulting to a valid ISO", () => {
    const md = addMeetingNote(emptyMeetingData(), "note body", "note1", tenDaysAgo);
    expect(md.notes[0].timestamp).toBe(tenDaysAgo);
    const pd = addProjectUpdate(emptyProjectData(), "update body", "upd1", tenDaysAgo);
    expect(pd.updates[0].timestamp).toBe(tenDaysAgo);
    const dflt = addMeetingNote(emptyMeetingData(), "x", "note2"); // arg omitted -> defaults to nowISO()
    expect(Number.isNaN(new Date(dflt.notes[0].timestamp).getTime())).toBe(false);
  });
});
