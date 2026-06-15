import { describe, it, expect, beforeEach } from "vitest";
import {
  emptyMeetingData,
  commitMeetingData,
  rebuildLedgerFromRecords,
  itemToLedgerItem,
  ledgerItemKey,
  storage,
  KEY,
  type Item,
  type Meeting,
  type MeetingData,
} from "../../meeting-assistant";

const NOW = "2026-06-13T00:00:00Z";
const M: Meeting = { id: "m1", name: "Team weekly", cadence: "Weekly", purpose: "", people: "", last_meeting_date: null, next_meeting_date: null, created_at: NOW };

function it1(text: string, id: string, status: Item["status"] = "open"): Item {
  const x: Item = { id, key: "", kind: "todo", text, owner: "i_owe", waiting_on: null, priority: "Medium", due_date: null, due_confirmed: false, owner_confirmed: true, interval_confirmed: true, status, project_id: null, source: { kind: "meeting", meeting_id: "m1", note_id: null, date: NOW }, quote: "", quote_anchored: false, occurrence: 0, created_at: NOW, completed_at: null, last_touched: NOW };
  x.key = ledgerItemKey(x);
  return x;
}

describe("meeting view: record + ledger consistency", () => {
  beforeEach(async () => { for (const k of await storage.list("")) await storage.delete(k); });

  it("completing a to-do updates the record and removes it from the open ledger", async () => {
    await storage.set(KEY.meeting("m1"), { ...emptyMeetingData(), todos: [it1("alpha", "a"), it1("bravo", "b")] });
    // complete "a"
    await commitMeetingData("m1", (md) => ({ ...md, todos: md.todos.map((t) => (t.id === "a" ? { ...t, status: "completed", completed_at: NOW } : t)) }));
    const md = await storage.getJSON<MeetingData>(KEY.meeting("m1"));
    expect(md!.todos.find((t) => t.id === "a")!.status).toBe("completed");
    const ledger = rebuildLedgerFromRecords({ meetings: [M], meetingData: { m1: md! }, followthrough: { tombstones: [], item_state: {} } });
    expect(ledger.items.map((i) => i.id)).toEqual(["b"]); // only the open one
  });

  it("editing a to-do's text is reflected on the record", async () => {
    await storage.set(KEY.meeting("m1"), { ...emptyMeetingData(), todos: [it1("draft", "a")] });
    await commitMeetingData("m1", (md) => ({ ...md, todos: md.todos.map((t) => (t.id === "a" ? { ...t, text: "draft the plan" } : t)) }));
    const md = await storage.getJSON<MeetingData>(KEY.meeting("m1"));
    expect(md!.todos[0].text).toBe("draft the plan");
  });

  it("deleting a note removes it without affecting unrelated items", async () => {
    await storage.set(KEY.meeting("m1"), { ...emptyMeetingData(), notes: [{ id: "n1", timestamp: NOW, content: "keep" }, { id: "n2", timestamp: NOW, content: "drop" }], todos: [it1("alpha", "a")] });
    await commitMeetingData("m1", (md) => ({ ...md, notes: md.notes.filter((n) => n.id !== "n2") }));
    const md = await storage.getJSON<MeetingData>(KEY.meeting("m1"));
    expect(md!.notes.map((n) => n.id)).toEqual(["n1"]);
    expect(md!.todos.length).toBe(1); // unrelated to-do untouched
  });

  it("itemToLedgerItem carries the meeting name + cadence-derived interval", () => {
    const li = itemToLedgerItem(it1("x", "a"), M, null);
    expect(li.source.meeting_name).toBe("Team weekly");
    expect(li.interval_days).toBe(7);
  });
});
