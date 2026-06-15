import { describe, it, expect } from "vitest";
import {
  rebuildLedgerFromRecords,
  ledgerItemKey,
  emptyMeetingData,
  emptyProjectData,
  type Item,
  type Meeting,
  type Project,
} from "../../meeting-assistant";

const NOW = "2026-06-13T00:00:00Z";

function tagged(text: string, id: string, meetingId: string): Item {
  const x: Item = { id, key: "", kind: "todo", text, owner: "i_owe", waiting_on: null, priority: "Medium", due_date: null, due_confirmed: false, owner_confirmed: true, interval_confirmed: true, status: "open", project_id: "p1", source: { kind: "meeting", meeting_id: meetingId, note_id: null, date: NOW }, quote: "", quote_anchored: false, occurrence: 0, created_at: NOW, completed_at: null, last_touched: NOW };
  x.key = ledgerItemKey(x);
  return x;
}
function mtg(id: string): Meeting { return { id, name: id, cadence: "Weekly", purpose: "", people: "", last_meeting_date: null, next_meeting_date: null, created_at: NOW }; }

describe("project view: membership derives from the tag (no clobber-prone copy)", () => {
  it("items tagged to one project across two different meetings both appear", () => {
    const ledger = rebuildLedgerFromRecords({
      meetings: [mtg("m1"), mtg("m2")],
      meetingData: {
        m1: { ...emptyMeetingData(), todos: [tagged("from m1", "a", "m1")] },
        m2: { ...emptyMeetingData(), todos: [tagged("from m2", "b", "m2")] },
      },
      projects: [{ id: "p1", name: "Atlas", status: "active", target_date: null, dot_color: "#CE5780", created_at: NOW }],
      projectData: { p1: emptyProjectData() },
      followthrough: { tombstones: [], item_state: {} },
    });
    const inProject = ledger.items.filter((li) => li.project_id === "p1");
    expect(inProject.map((i) => i.id).sort()).toEqual(["a", "b"]);
    // both denormalize their contributing meeting
    expect(new Set(inProject.map((i) => i.source.meeting_name))).toEqual(new Set(["m1", "m2"]));
  });

  it("a done project's still-open items remain in the ledger (a contradiction worth seeing)", () => {
    const done: Project = { id: "p1", name: "Atlas", status: "done", target_date: null, dot_color: "#CE5780", created_at: NOW };
    const ledger = rebuildLedgerFromRecords({
      meetings: [mtg("m1")],
      meetingData: { m1: { ...emptyMeetingData(), todos: [tagged("still open", "a", "m1")] } },
      projects: [done],
      projectData: { p1: emptyProjectData() },
      followthrough: { tombstones: [], item_state: {} },
    });
    // ledger does not suppress by project status -> the cockpit/project view can surface the contradiction
    expect(ledger.items.filter((li) => li.project_id === "p1" && li.status === "open").length).toBe(1);
  });

  it("a direct project update item appears under the project (source.kind direct)", () => {
    const direct: Item = { id: "d1", key: "", kind: "todo", text: "draft plan", owner: "i_owe", waiting_on: null, priority: "High", due_date: null, due_confirmed: false, owner_confirmed: true, interval_confirmed: true, status: "open", project_id: "p1", source: { kind: "direct", meeting_id: null, note_id: "u1", date: NOW }, quote: "", quote_anchored: false, occurrence: 0, created_at: NOW, completed_at: null, last_touched: NOW };
    direct.key = ledgerItemKey(direct);
    const ledger = rebuildLedgerFromRecords({
      projects: [{ id: "p1", name: "Atlas", status: "active", target_date: null, dot_color: "#CE5780", created_at: NOW }],
      projectData: { p1: { ...emptyProjectData(), items: [direct] } },
      followthrough: { tombstones: [], item_state: {} },
    });
    const found = ledger.items.find((i) => i.id === "d1")!;
    expect(found.project_id).toBe("p1");
    expect(found.source.kind).toBe("direct");
  });
});
