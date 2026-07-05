import { describe, it, expect } from "vitest";
import { classifyProposedTag, confirmExistingTag, type Project } from "../../meeting-assistant";

function proj(name: string, id: string): Project {
  return { id, name, status: "active", target_date: null, dot_color: "#2C2A4A", created_at: "2026-07-03T00:00:00Z" };
}
const projects = [proj("Apollo", "pr_apollo"), proj("Zephyr", "pr_zephyr")];

// A minimal tag-bearing row; classify/confirm only read these two fields.
function row(project_id: string | null, project_proposed_name: string | null) {
  return { id: "r1", project_id, project_proposed_name };
}

describe("classifyProposedTag (U2 — pure tag state)", () => {
  it("confirmed when project_id resolves to an existing project", () => {
    expect(classifyProposedTag(row("pr_apollo", null), projects)).toBe("confirmed");
  });

  it("inferred when the proposed name matches an existing project with project_id null (R4/R5)", () => {
    expect(classifyProposedTag(row(null, "Apollo"), projects)).toBe("inferred");
    expect(classifyProposedTag(row(null, "apollo"), projects)).toBe("inferred"); // case-insensitive
  });

  it("none when neither a resolvable project_id nor a proposed name is present", () => {
    expect(classifyProposedTag(row(null, null), projects)).toBe("none");
  });

  it("a project_id that no longer resolves falls through to the proposed-name check", () => {
    expect(classifyProposedTag(row("gone", "Apollo"), projects)).toBe("inferred");
    expect(classifyProposedTag(row("gone", null), projects)).toBe("none");
  });

  it("does not mutate the row it classifies", () => {
    const r = row(null, "Apollo");
    classifyProposedTag(r, projects);
    expect(r).toEqual({ id: "r1", project_id: null, project_proposed_name: "Apollo" });
  });
});

describe("confirmExistingTag (U2 — one-tap confirm transform, R5)", () => {
  it("sets project_id to the matched project and nulls the proposed name (inferred -> confirmed)", () => {
    const next = confirmExistingTag(row(null, "Apollo"), projects);
    expect(next.project_id).toBe("pr_apollo");
    expect(next.project_proposed_name).toBe(null);
    expect(classifyProposedTag(next, projects)).toBe("confirmed");
  });

  it("case-insensitive match resolves to the canonical project id", () => {
    expect(confirmExistingTag(row(null, "zephyr"), projects).project_id).toBe("pr_zephyr");
  });

  it("leaves a non-matching (new) name untouched — the create path, not confirm", () => {
    const next = confirmExistingTag(row(null, "Brand new"), projects);
    expect(next.project_id).toBe(null);
    expect(next.project_proposed_name).toBe("Brand new");
  });
});

describe("clearing an inferred tag (U2 — R6)", () => {
  it("nulling the proposed name moves the row to the none state", () => {
    const cleared = { ...row(null, "Apollo"), project_proposed_name: null };
    expect(classifyProposedTag(cleared, projects)).toBe("none");
  });
});

describe("tag confirmation is per-row independent (U2 — R7)", () => {
  it("confirming one row does not change another row's state", () => {
    const a = row(null, "Apollo");
    const b = row(null, "Zephyr");
    const aConfirmed = confirmExistingTag(a, projects);
    expect(classifyProposedTag(aConfirmed, projects)).toBe("confirmed");
    expect(classifyProposedTag(b, projects)).toBe("inferred"); // b untouched
    expect(b.project_proposed_name).toBe("Zephyr");
  });
});
