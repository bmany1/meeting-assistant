import { describe, it, expect, beforeEach } from "vitest";
import {
  addMeetingNote,
  addProjectUpdate,
  validateDestinationName,
  makeMeeting,
  makeProject,
  nextProjectDot,
  emptyMeetingData,
  emptyProjectData,
  commitMeetingData,
  commitProjectData,
  rebuildLedgerFromRecords,
  ledgerItemKey,
  storage,
  KEY,
  type Item,
} from "../../meeting-assistant";

describe("note routing helpers (pure)", () => {
  it("addMeetingNote prepends a timestamped note to the meeting record", () => {
    const md = addMeetingNote(emptyMeetingData(), "first note", "n1");
    expect(md.notes.length).toBe(1);
    expect(md.notes[0]).toMatchObject({ id: "n1", content: "first note" });
    expect(Number.isNaN(Date.parse(md.notes[0].timestamp))).toBe(false);
  });

  it("addProjectUpdate stores a project update with NO meeting linkage", () => {
    const pd = addProjectUpdate(emptyProjectData(), "direct update", "u1");
    expect(pd.updates.length).toBe(1);
    expect(pd.updates[0]).toMatchObject({ id: "u1", content: "direct update" });
    // a project update has no meeting field by construction
    expect((pd.updates[0] as any).meeting_id).toBeUndefined();
  });

  it("validateDestinationName blocks empty names and flags collisions", () => {
    expect(validateDestinationName("", []).ok).toBe(false);
    expect(validateDestinationName("   ", []).ok).toBe(false);
    expect(validateDestinationName("Team weekly", []).ok).toBe(true);
    const c = validateDestinationName("team WEEKLY", ["Team weekly"]);
    expect(c.ok).toBe(true);
    expect(c.collision).toBe(true);
  });

  it("nextProjectDot cycles the palette by project count", () => {
    expect(nextProjectDot([])).toBeTypeOf("string");
    const one = makeProject("A", nextProjectDot([]));
    expect(nextProjectDot([one])).not.toBe(undefined);
  });
});

describe("routing writes to the correct record (storage shim)", () => {
  beforeEach(async () => {
    for (const k of await storage.list("")) await storage.delete(k);
  });

  it("a project-destination note writes project updates and creates NO meeting (AE1)", async () => {
    const p = makeProject("Atlas migration", "#CE5780");
    await storage.set(KEY.projectsList, [p]);
    await storage.set(KEY.project(p.id), emptyProjectData());

    await commitProjectData(p.id, (cur) => addProjectUpdate(cur, "Talked to Priya about cutover", "u1"));

    const pd = await storage.getJSON<any>(KEY.project(p.id));
    expect(pd.updates.length).toBe(1);
    // No meeting record was created by a project-destination capture.
    const meetingKeys = (await storage.list("meeting:")) || [];
    expect(meetingKeys.length).toBe(0);
  });

  it("a meeting-destination note attaches to the chosen meeting instance", async () => {
    const m = makeMeeting("Team weekly", "Weekly");
    await storage.set(KEY.meetingsList, [m]);
    await storage.set(KEY.meeting(m.id), emptyMeetingData());

    await commitMeetingData(m.id, (cur) => addMeetingNote(cur, "Sprint planning notes", "n1"));

    const md = await storage.getJSON<any>(KEY.meeting(m.id));
    expect(md.notes[0].content).toBe("Sprint planning notes");
  });

  it("a project's direct-captured item appears under that project after rebuild (AE1 target)", () => {
    // U4/U5 produce the items; here we prove a direct (no-meeting) item routes
    // to the project lens via project_id + a 'direct' source.
    const item: Item = {
      id: "it1", key: "", kind: "todo", text: "draft cutover plan", owner: "i_owe", waiting_on: null,
      priority: "High", due_date: null, due_confirmed: false, owner_confirmed: false, interval_confirmed: true,
      status: "open", project_id: "p1", source: { kind: "direct", meeting_id: null, note_id: "u1", date: "2026-06-13T00:00:00Z" },
      quote: "draft the cutover plan", quote_anchored: true, occurrence: 0, created_at: "2026-06-13T00:00:00Z", completed_at: null, last_touched: "2026-06-13T00:00:00Z",
    };
    item.key = ledgerItemKey(item);
    const ledger = rebuildLedgerFromRecords({
      projects: [makeProject("Atlas", "#CE5780") as any].map((p) => ({ ...p, id: "p1" })),
      projectData: { p1: { ...emptyProjectData(), items: [item] } },
      followthrough: { tombstones: [], item_state: {} },
    });
    const found = ledger.items.find((i) => i.id === "it1")!;
    expect(found.project_id).toBe("p1");
    expect(found.source.kind).toBe("direct");
    expect(found.source.meeting_id).toBeNull();
  });
});
