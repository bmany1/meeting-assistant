import { describe, it, expect } from "vitest";
import {
  parseExtraction,
  buildProposalsFromParsed,
  anchorQuote,
  buildExtractionPrompt,
  type SourceRef,
  type ExtractionContext,
} from "../../meeting-assistant";

const SRC: SourceRef = { kind: "meeting", meeting_id: "m1", note_id: "n1", date: "2026-06-13T00:00:00Z" };
const CTX: ExtractionContext = { destKind: "meeting", meetingName: "Team weekly", cadence: "Weekly", purpose: "ship Atlas", people: "Priya, Maria", projectNames: ["Atlas migration"], openTodos: ["draft the plan"], today: "2026-06-13", autoProjectId: null };

describe("parseExtraction", () => {
  it("parses a well-formed items array", () => {
    const r = parseExtraction('{"items":[{"kind":"todo","text":"x","quote":"x"}]}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.items.length).toBe(1);
  });
  it("parses a bare array too", () => {
    const r = parseExtraction('[{"kind":"todo","text":"x","quote":"x"}]');
    expect(r.ok).toBe(true);
  });
  it("flags truncated/invalid JSON as recoverable", () => {
    const r = parseExtraction('{"items":[{"kind":"todo","text":"x"');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("truncated");
  });
});

describe("anchorQuote", () => {
  it("anchors an exact substring and returns the span from the note", () => {
    const note = "Today we will send the deck to Priya.";
    const a = anchorQuote(note, "send the deck");
    expect(a.anchored).toBe(true);
    expect(a.span).toBe("send the deck");
  });
  it("anchors case-insensitively", () => {
    expect(anchorQuote("SEND THE DECK", "send the deck").anchored).toBe(true);
  });
  it("returns unanchored when the quote is absent", () => {
    expect(anchorQuote("nothing relevant here", "send the deck").anchored).toBe(false);
  });
  it("advances past prior matches via fromIndex (occurrence disambiguation)", () => {
    const note = "ping dana. then ping dana again.";
    const first = anchorQuote(note, "ping dana", 0);
    const second = anchorQuote(note, "ping dana", first.index + 1);
    expect(second.index).toBeGreaterThan(first.index);
  });
});

describe("buildProposalsFromParsed", () => {
  const note = "We will send the deck to Priya by Friday. Maria will share the budget.";

  it("maps well-formed items to typed proposals with anchored quotes + source", () => {
    const items = [{ kind: "todo", text: "send the deck to Priya", quote: "send the deck to Priya", owner: "i_owe", waiting_on: null, priority: "High", due_date: "2026-06-19" }];
    const props = buildProposalsFromParsed(items, note, SRC, CTX);
    expect(props.length).toBe(1);
    expect(props[0].quote_anchored).toBe(true);
    expect(props[0].source.meeting_id).toBe("m1");
    expect(props[0].due_date).toBe("2026-06-19");
    expect(props[0].inferred.due).toBe(true); // extracted date is inferred (R20)
    expect(props[0].due_confirmed).toBe(false);
  });

  it("defaults ambiguous owner to i_owe and flags owner inferred", () => {
    const items = [{ kind: "todo", text: "follow up", quote: "follow up", owner: "unknown" }];
    const props = buildProposalsFromParsed(items, note, SRC, CTX);
    expect(props[0].owner).toBe("i_owe");
    expect(props[0].inferred.owner).toBe(true);
    expect(props[0].owner_confirmed).toBe(false);
  });

  it("classifies waiting_for with a person and sets kind", () => {
    const items = [{ kind: "todo", text: "budget", quote: "share the budget", owner: "waiting_for", waiting_on: "Maria" }];
    const props = buildProposalsFromParsed(items, note, SRC, CTX);
    expect(props[0].owner).toBe("waiting_for");
    expect(props[0].waiting_on).toBe("Maria");
    expect(props[0].kind).toBe("waiting_for");
  });

  it("surfaces a shape warning for missing required fields (never a silent pass)", () => {
    const items = [{ kind: "todo" }]; // missing text + quote
    const props = buildProposalsFromParsed(items, note, SRC, CTX);
    expect(props[0].shape_warning).toBeTruthy();
    expect(props[0].shape_warning).toContain("text");
    expect(props[0].shape_warning).toContain("quote");
  });

  it("flags a proposal whose quote is not in the note as unanchored", () => {
    const items = [{ kind: "todo", text: "ghost item", quote: "this phrase is not in the note" }];
    const props = buildProposalsFromParsed(items, note, SRC, CTX);
    expect(props[0].quote_anchored).toBe(false);
  });

  it("anchors a repeated phrase to two distinct occurrences", () => {
    const n2 = "ping dana about budget. later, ping dana about hiring.";
    const items = [
      { kind: "todo", text: "ping dana re budget", quote: "ping dana" },
      { kind: "todo", text: "ping dana re hiring", quote: "ping dana" },
    ];
    const props = buildProposalsFromParsed(items, n2, SRC, CTX);
    expect(props[0].occurrence).toBe(0);
    expect(props[1].occurrence).toBe(1);
    expect(props[0].anchor_index).not.toBe(props[1].anchor_index);
  });

  it("resolves a model-proposed project name against existing projects (proposal, not auto)", () => {
    const items = [{ kind: "todo", text: "x", quote: "send the deck", project: "Atlas migration" }];
    const props = buildProposalsFromParsed(items, note, SRC, CTX);
    expect(props[0].project_proposed_name).toBe("Atlas migration");
    expect(props[0].project_id).toBeNull(); // meeting items only PROPOSE a tag
  });

  it("auto-tags project-destination items with no proposal", () => {
    const projCtx: ExtractionContext = { ...CTX, destKind: "project", autoProjectId: "p1", projectName: "Atlas migration", projectStatus: "active" };
    const items = [{ kind: "todo", text: "x", quote: "send the deck" }];
    const props = buildProposalsFromParsed(items, note, SRC, projCtx);
    expect(props[0].project_id).toBe("p1");
    expect(props[0].project_proposed_name).toBeNull();
  });
});

describe("buildExtractionPrompt", () => {
  it("includes the binding instructions (JSON only, no em dashes, item cap, verbatim quote)", () => {
    const p = buildExtractionPrompt("some note text", CTX);
    expect(p).toContain("ONLY valid JSON");
    expect(p.toLowerCase()).toContain("no em dashes");
    expect(p).toContain("verbatim");
    expect(p).toContain("Atlas migration"); // existing project offered for tagging
    expect(p).toContain("draft the plan"); // open todo context injected
  });
  it("for a project destination, tells the model items are already tagged", () => {
    const p = buildExtractionPrompt("x", { ...CTX, destKind: "project", projectName: "Atlas migration", projectStatus: "active", autoProjectId: "p1" });
    expect(p).toContain("already tagged to this project");
  });
});
