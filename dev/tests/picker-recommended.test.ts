import { describe, it, expect } from "vitest";
import { buildRecommendedOptions, type Project } from "../../meeting-assistant";

function proj(name: string, id: string): Project {
  return { id, name, status: "active", target_date: null, dot_color: "#2C2A4A", created_at: "2026-07-03T00:00:00Z" };
}
const projects = [proj("Apollo", "pr_apollo")];

describe("buildRecommendedOptions (U4 — Recommended at top of the retag picker)", () => {
  it("injects the existing project as a Recommended option when the name matches (R11)", () => {
    const opts = buildRecommendedOptions({ name: "Apollo" }, projects, "");
    expect(opts).toHaveLength(1);
    expect(opts[0].group).toBe("Recommended");
    expect(opts[0].destination).toEqual({ kind: "project", id: "pr_apollo" });
  });

  it("injects a create-new destination when the recommended name matches nothing (R11)", () => {
    const opts = buildRecommendedOptions({ name: "Falcon" }, projects, "");
    expect(opts).toHaveLength(1);
    expect(opts[0].group).toBe("Recommended");
    expect(opts[0].destination).toEqual({ kind: "new_project", name: "Falcon" });
    expect(opts[0].label).toContain("Create");
    expect(opts[0].label).toContain("Falcon");
  });

  it("is hidden while a query is being typed, so the normal typed flow resumes (R12)", () => {
    // A typed query that matches no project: Recommended is suppressed, so it
    // cannot keep the list non-empty and defeat the picker's typed behavior.
    expect(buildRecommendedOptions({ name: "Apollo" }, projects, "zzz")).toEqual([]);
    expect(buildRecommendedOptions({ name: "Falcon" }, projects, "fal")).toEqual([]);
  });

  it("returns nothing when there is no recommendation (order unchanged for the capture picker)", () => {
    expect(buildRecommendedOptions(undefined, projects, "")).toEqual([]);
    expect(buildRecommendedOptions(null, projects, "")).toEqual([]);
    expect(buildRecommendedOptions({ name: "   " }, projects, "")).toEqual([]);
  });

  it("a create-new recommendation is produced even though nothing was typed (bypasses the must-type-to-create rule)", () => {
    // The name comes from the recommendation prop, not the search box, so an
    // empty query still yields a create destination for a new name.
    const opts = buildRecommendedOptions({ name: "Falcon" }, projects, "");
    expect(opts[0].destination.kind).toBe("new_project");
  });
});
