import { describe, it, expect } from "vitest";
import {
  chunkNote,
  mergeProposals,
  runExtraction,
  type Proposal,
  type SourceRef,
  type ExtractionContext,
} from "../../meeting-assistant";

const SRC: SourceRef = { kind: "meeting", meeting_id: "m1", note_id: "n1", date: "2026-06-13T00:00:00Z" };
const CTX: ExtractionContext = { destKind: "meeting", meetingName: "Team weekly", cadence: "Weekly", purpose: "", people: "", projectNames: [], openTodos: [], today: "2026-06-13", autoProjectId: null };

function prop(p: Partial<Proposal>): Proposal {
  return {
    id: p.id || "p" + Math.random().toString(36).slice(2),
    kind: "todo", text: "do x", owner: "i_owe", waiting_on: null, priority: "Medium",
    due_date: null, due_confirmed: false, owner_confirmed: false, interval_confirmed: true,
    project_id: null, project_proposed_name: null, is_completion: false, completes_item_id: null,
    quote: "x", quote_anchored: true, anchor_index: 0, anchor_len: 1, occurrence: 0, source: SRC,
    inferred: { due: false, owner: true }, ...p,
  };
}

describe("chunkNote", () => {
  it("returns a single chunk for a short note (single-pass)", () => {
    expect(chunkNote("a short note").length).toBe(1);
  });

  it("segments a long note into multiple chunks at paragraph boundaries", () => {
    const paraA = "A. " + "alpha ".repeat(700); // ~4200 chars
    const paraB = "B. " + "bravo ".repeat(700);
    const chunks = chunkNote(paraA + "\n\n" + paraB);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("hard-splits a single paragraph that exceeds the threshold", () => {
    const huge = "word ".repeat(3000); // ~15000 chars, no blank lines
    const chunks = chunkNote(huge);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });
});

describe("mergeProposals", () => {
  it("merges two paraphrases of the same item via overlapping anchor spans", () => {
    const a = prop({ id: "a", text: "send Priya the timeline", anchor_index: 100, anchor_len: 40, quote_anchored: true });
    const b = prop({ id: "b", text: "get the timeline to Priya", anchor_index: 110, anchor_len: 40, quote_anchored: true });
    const merged = mergeProposals([[a], [b]]);
    expect(merged.length).toBe(1); // overlapping spans -> one item, not text equality
  });

  it("keeps distinct items whose spans do not overlap and text differs", () => {
    const a = prop({ id: "a", text: "send Priya the timeline", anchor_index: 0, anchor_len: 20 });
    const b = prop({ id: "b", text: "book the venue", anchor_index: 500, anchor_len: 20 });
    expect(mergeProposals([[a], [b]]).length).toBe(2);
  });

  it("dedups exact-normalized text across chunks even without anchors", () => {
    const a = prop({ id: "a", text: "Send the report.", anchor_index: null, quote_anchored: false });
    const b = prop({ id: "b", text: "send the report", anchor_index: null, quote_anchored: false });
    expect(mergeProposals([[a], [b]]).length).toBe(1);
  });

  it("prefers the anchored representative when merging a dup", () => {
    const a = prop({ id: "a", text: "send the report", quote_anchored: false, anchor_index: null });
    const b = prop({ id: "b", text: "send the report", quote_anchored: true, anchor_index: 5, anchor_len: 10 });
    const merged = mergeProposals([[a], [b]]);
    expect(merged.length).toBe(1);
    expect(merged[0].quote_anchored).toBe(true);
  });
});

describe("runExtraction (orchestration with a stubbed call)", () => {
  const goodJSON = JSON.stringify({ items: [{ kind: "todo", text: "send the deck", quote: "send the deck", owner: "i_owe", waiting_on: null, priority: "High", due_date: null }] });

  it("runs a short note single-pass and returns proposals", async () => {
    const note = "We agreed to send the deck.";
    const run = await runExtraction(note + " send the deck", SRC, CTX, undefined, async () => goodJSON);
    expect(run.chunkCount).toBe(1);
    expect(run.failedChunks).toEqual([]);
    expect(run.proposals.length).toBe(1);
  });

  it("preserves completed-chunk proposals when a later chunk fails, and flags it for retry", async () => {
    const paraA = "send the deck. " + "alpha ".repeat(700);
    const paraB = "book the venue. " + "bravo ".repeat(700);
    const note = paraA + "\n\n" + paraB;
    let call = 0;
    const run = await runExtraction(note, SRC, CTX, undefined, async () => {
      call++;
      if (call === 2) throw new Error("simulated chunk failure");
      return goodJSON;
    });
    expect(run.chunkCount).toBeGreaterThanOrEqual(2);
    expect(run.failedChunks).toContain(2); // names the failed chunk (1-based)
    expect(run.rawByChunk[1]).toBeNull(); // chunk 2 raw is null -> retry re-runs only it
    expect(run.proposals.length).toBeGreaterThanOrEqual(1); // chunk-one proposals survive
  });

  it("reports a parse error when all chunks return unreadable output", async () => {
    const run = await runExtraction("short note", SRC, CTX, undefined, async () => "not json at all");
    expect(run.parseError).toBe(true);
    expect(run.proposals.length).toBe(0);
  });

  it("emits progress callbacks part N of M", async () => {
    const seen: Array<[number, number]> = [];
    await runExtraction("x", SRC, CTX, (d, t) => seen.push([d, t]), async () => goodJSON);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[seen.length - 1]).toEqual([1, 1]);
  });
});
